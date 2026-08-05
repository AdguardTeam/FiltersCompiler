/**
 * Optimizes filters by removing low-hit rules using each filter's hit-counts
 * collected from AdGuard users who opted into filter rules statistics.
 * Statistics are fetched remotely or read from a local cache.
 *
 * @see {@link https://github.com/AdguardTeam/FiltersRegistry#optimization} for more information.
 *
 * @see localOptimizationStatistics for managing a local cache of optimization stats files.
 * @see getOptimizationStatistics for retrieving optimization stats for a filter.
 * @see skipRuleWithOptimization for checking if a rule should be skipped based on optimization stats.
 */
import fs from 'fs/promises';
import path from 'path';
import { downloadFile } from './utils/webutils';
import { mapWithConcurrency } from './utils/concurrent';

// Here we can access optimizable filters and its optimization percentages
const OPTIMIZATION_KEY = '4DDBE80A3DA94D819A00523252FB6380';
const OPTIMIZATION_PERCENT_URL = `https://chrome.adtidy.org/optimization_config/percent.json?key=${OPTIMIZATION_KEY}`;

// Path segment constants for the local config directory layout:
//   <basePath>/filters/<filterId>/stats.json
export const STATS_JSON = 'stats.json';
export const FILTERS_DIR_NAME = 'filters';

interface PercentEntry {
    filterId: number;
}

export interface PercentJson {
    config: PercentEntry[];
}

interface GroupConfig {
    hits: number;
}

interface OptimizationGroup {
    config: GroupConfig;
    rules: Record<string, number>;
}

export interface OptimizationStats {
    groups: OptimizationGroup[];
}

/**
 * Thrown by `getOptimizationStatistics` when a filter's stats cannot be
 * retrieved, from either a local file or the remote server.
 *
 * Carries `filterId` and `sourcePath` as structured fields so callers can
 * build their own actionable message instead of matching on `error.message`.
 */
export class OptimizationStatsError extends Error {
    code = 'OPTIMIZATION_STATS_UNAVAILABLE' as const;

    constructor(
        public filterId: number,
        public sourcePath: string,
        options?: ErrorOptions,
    ) {
        super(
            `Unable to retrieve optimization stats for ${filterId}, at ${sourcePath}. `
            + 'Please ensure the stats file exists and is accessible.',
            options,
        );
        this.name = 'OptimizationStatsError';
    }
}

const downloadOptimizationPercent = async () => downloadFile(OPTIMIZATION_PERCENT_URL);

const getOptimizationStatsUrl = (filterId: number) => `https://chrome.adtidy.org/filters/${filterId}/stats.json?key=${OPTIMIZATION_KEY}`;

/**
 * Downloads optimization stats for a single filter from the remote server.
 *
 * @param filterId - Numeric filter identifier.
 * @returns Raw JSON string of the stats file.
 */
const downloadOptimizationStats = async (filterId: number) => {
    const optimizationStatsUrl = getOptimizationStatsUrl(filterId);
    return downloadFile(optimizationStatsUrl);
};

let optimizationEnabled = true;

/**
 * When set, `getOptimizationStatistics` reads stats from local files under this
 * directory instead of fetching from the remote server.
 */
let localStatsPath: string | null = null;

/**
 * Cached set of filter IDs that have optimization stats available.
 * Populated lazily on the first `getOptimizableFilterIds` call.
 * Shared across concurrent callers to avoid redundant percent.json fetches.
 */
let optimizableFilterIdsPromise: Promise<Set<number>> | null = null;

/**
 * Returns the set of optimizable filter IDs.
 *
 * Lazily initializes a shared singleton on first call so that concurrent
 * callers share one in-flight fetch of `percent.json`.
 * `percent.json` is always fetched remotely, even when `use` has
 * been called — only the per-filter stats content is read from local files.
 *
 * @returns Set of filter IDs that have optimization stats available.
 */
const getOptimizableFilterIds = async () => {
    if (optimizableFilterIdsPromise === null) {
        optimizableFilterIdsPromise = (async () => {
            const percent = JSON.parse(await downloadOptimizationPercent()) as PercentJson;
            return new Set(percent.config.map(({ filterId: id }) => id));
        })();
        // Clear the singleton on rejection so a transient network error
        // doesn't poison the cache for all subsequent callers.
        optimizableFilterIdsPromise.catch(() => {
            optimizableFilterIdsPromise = null;
        });
    }
    return optimizableFilterIdsPromise;
};

/**
 * Validates that stats have non-empty groups.
 *
 * @param filterId - Numeric filter identifier.
 * @param stats - Parsed optimization stats object.
 * @throws {Error} if stats is not an object, or if stats.groups is missing or empty.
 */
export function assertValidStats(filterId: number, stats: unknown): asserts stats is OptimizationStats {
    if (stats === null || typeof stats !== 'object') {
        throw new Error(`Invalid optimization stats for ${filterId}: expected an object`);
    }
    if (!('groups' in stats) || !Array.isArray(stats.groups) || stats.groups.length === 0) {
        throw new Error(`Invalid optimization stats for ${filterId}: missing or empty groups`);
    }
}

/**
 * Manages a local on-disk cache of optimization stats files.
 *
 * Typical usage for generating the cache:
 * 1. `download(basePath, includedFilterIds, excludedFilterIds)` — save
 *    `stats.json` for filters listed in the remote `percent.json`.
 *
 * Typical usage for using the cache:
 * 1. `use(basePath)` — tells `getOptimizationStatistics` to read stats
 *    from local files lazily during compilation instead of fetching remotely.
 * 2. `reset(basePath)` — remove the cache directory and clear in-memory state.
 */
export const localOptimizationStatistics = {
    /**
     * Downloads `stats.json` files for filters listed in the remote
     * `percent.json` and saves them to disk.
     * Existing `stats.json` files will be overwritten.
     *
     * `includedFilterIds` and `excludedFilterIds` cannot both be non-empty.
     *
     * @param basePath - Directory to save `filters/<filterId>/stats.json` into.
     * @param includedFilterIds - Filter IDs to process; empty (default) processes all.
     * @param excludedFilterIds - Filter IDs to exclude; empty (default) excludes none.
     * @throws {Error} When both `includedFilterIds` and `excludedFilterIds` are non-empty.
     */
    download: async (basePath: string, includedFilterIds: number[] = [], excludedFilterIds: number[] = []) => {
        if (includedFilterIds.length > 0 && excludedFilterIds.length > 0) {
            throw new Error('includedFilterIds and excludedFilterIds cannot both be non-empty');
        }

        const percent = JSON.parse(await downloadOptimizationPercent()) as PercentJson;

        const configs = percent.config.filter(({ filterId }) => {
            if (includedFilterIds.length > 0) {
                return includedFilterIds.includes(filterId);
            }
            if (excludedFilterIds.length > 0) {
                return !excludedFilterIds.includes(filterId);
            }
            return true;
        });

        const FILTERS_PATH = path.join(basePath, FILTERS_DIR_NAME);

        /**
         * Bounds concurrency so a large `percent.json` cannot fan out into unbounded
         * parallel requests if the underlying transport ever becomes truly async.
         */
        const DOWNLOAD_CONCURRENCY = 8;

        await mapWithConcurrency(configs, DOWNLOAD_CONCURRENCY, async ({ filterId }) => {
            const dir = path.join(FILTERS_PATH, String(filterId));
            const statsPath = path.join(dir, STATS_JSON);
            const content = await downloadOptimizationStats(filterId);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(statsPath, content, 'utf-8');
        });
    },

    /**
     * Configures `getOptimizationStatistics` to read stats from local files under
     * `basePath` instead of fetching from the remote server.
     * Stats are loaded lazily on demand during compilation. `percent.json` is
     * still fetched remotely to determine which filters are optimizable.
     *
     * @param basePath - Directory containing `filters/<filterId>/stats.json`.
     */
    use(basePath: string) {
        localStatsPath = basePath;
        optimizableFilterIdsPromise = null;
    },

    /**
     * Removes the cache directory and clears in-memory state.
     *
     * @param basePath - Directory to remove.
     */
    async reset(basePath: string) {
        await fs.rm(basePath, { recursive: true, force: true });
        localStatsPath = null;
        optimizableFilterIdsPromise = null;
    },
};

/**
 * Returns the optimization stats for the given filter, or `null` when
 * optimization is disabled or the filter is not listed in `percent.json`.
 *
 * When `localOptimizationStatistics.use(path)` has been called, stats
 * are read lazily from local files. Otherwise stats are fetched from the
 * remote server.
 *
 * @param filterId - Numeric filter identifier.
 * @returns Parsed stats object, or `null` when the filter has no optimization stats.
 * @throws {Error} When the stats are missing or malformed.
 */
export const getOptimizationStatistics = async (filterId: number) => {
    if (!optimizationEnabled) {
        return null;
    }

    const ids = await getOptimizableFilterIds();

    if (!ids.has(filterId)) {
        return null;
    }

    let stats: unknown;

    try {
        const content = localStatsPath !== null
            ? await fs.readFile(path.join(localStatsPath, FILTERS_DIR_NAME, String(filterId), STATS_JSON), 'utf-8')
            : await downloadOptimizationStats(filterId);
        stats = JSON.parse(content);
    } catch (originalError) {
        const statsPath = localStatsPath === null
            ? getOptimizationStatsUrl(filterId)
            : `${localStatsPath}/filters/${filterId}/stats.json`;

        throw new OptimizationStatsError(filterId, statsPath, { cause: originalError });
    }

    assertValidStats(filterId, stats);

    return stats;
};

/**
 * Checks if rule should be skipped because optimization is enabled for this filter
 * and the hit count for this rule is below the configured threshold.
 *
 * @param ruleText - Rule text to check.
 * @param optimizationStats - Optimization config for this filter.
 * @returns `true` if the rule should be skipped, `false` otherwise.
 */
export const skipRuleWithOptimization = (
    ruleText: string,
    optimizationStats: OptimizationStats | null,
): boolean => {
    if (!optimizationStats) {
        return false;
    }

    // eslint-disable-next-line no-restricted-syntax
    for (const group of optimizationStats.groups) {
        const hits = group.rules[ruleText];
        if (hits !== undefined && hits < group.config.hits) {
            return true;
        }
    }

    return false;
};

/**
 * Disables optimized filter builds
 */
export const disableOptimization = () => {
    optimizationEnabled = false;
};

/**
 * Enables optimized filter builds
 */
export const enableOptimization = () => {
    optimizationEnabled = true;
};
