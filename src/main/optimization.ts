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

export interface PercentOptions {
    /**
     * Local JSON file holding an array of `{ filterId }` entries, such as the
     * registry's `optimization_config.json`, to use instead of fetching the
     * remote `percent.json`.
     */
    percentPath?: string;
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
 * Thrown by `getOptimizationStatistics` when a filter's stats are unusable,
 * either because they could not be retrieved (local file or remote server)
 * or because retrieved stats failed structural validation.
 *
 * Carries `filterId` and `sourcePath` as structured fields so callers can
 * build their own actionable message, and a `code` so callers can branch on
 * the failure kind, instead of matching on `error.message`. When `options.cause`
 * is an `Error`, its message is folded into this error's own `message` too, so
 * the specific reason survives even for callers that only log `error.message`
 * and never walk the `cause` chain.
 */
export class OptimizationStatsError extends Error {
    code: 'OPTIMIZATION_STATS_UNAVAILABLE' | 'OPTIMIZATION_STATS_INVALID';

    constructor(
        public filterId: number,
        public sourcePath: string,
        reason: 'retrieval' | 'validation',
        options?: ErrorOptions,
    ) {
        const causeMessage = options?.cause instanceof Error ? options.cause.message : undefined;
        const detail = causeMessage !== undefined ? ` ${causeMessage}` : '';
        super(
            reason === 'validation'
                ? `Invalid optimization stats for ${filterId}, at ${sourcePath}.${detail}`
                : `Unable to retrieve optimization stats for ${filterId}, at ${sourcePath}. `
                    + `Please ensure the stats file exists and is accessible.${detail}`,
            options,
        );
        this.code = reason === 'validation' ? 'OPTIMIZATION_STATS_INVALID' : 'OPTIMIZATION_STATS_UNAVAILABLE';
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
 * When set, `percent.json` is read from this local file instead of being
 * fetched from the remote server.
 */
let localPercentPath: string | null = null;

/**
 * Cached optimizable filter entries, keyed by the local path they were read from
 * (`null` for the remote fetch). Populated lazily on the first `getPercentEntries`
 * call and shared across concurrent callers, so the file is read (or fetched) once.
 */
let percentEntriesCache: { percentPath: string | null; promise: Promise<PercentEntry[]> } | null = null;

/**
 * Validates that a parsed value is an array of entries with an integer `filterId`.
 *
 * @param entries - Parsed JSON value.
 * @param source - Where the value came from, for the error message.
 * @returns The entries, narrowed to `PercentEntry[]`.
 * @throws {TypeError} If the value is not an array of entries with an integer `filterId`.
 */
const assertPercentEntries = (entries: unknown, source: string): PercentEntry[] => {
    const isValidEntry = (entry: unknown) => (
        entry !== null
        && typeof entry === 'object'
        && Number.isInteger((entry as { filterId?: unknown }).filterId)
    );

    if (!Array.isArray(entries) || !entries.every(isValidEntry)) {
        throw new TypeError(
            `Invalid percent config at ${source}: expected an array of { "filterId": <number> } entries`,
        );
    }

    return entries.map(({ filterId }: PercentEntry) => ({ filterId }));
};

/**
 * Loads the optimizable filter entries from a local file when `percentPath`
 * is given (an array of entries), otherwise from the remote `percent.json`
 * (an object whose `config` holds the entries).
 *
 * @param percentPath - Local file path, or `null` to fetch remotely.
 * @returns Optimizable filter entries.
 */
const loadPercentEntries = async (percentPath: string | null): Promise<PercentEntry[]> => {
    if (percentPath === null) {
        const { config } = JSON.parse(await downloadOptimizationPercent()) as PercentJson;
        return assertPercentEntries(config, 'the remote percent.json');
    }
    return assertPercentEntries(JSON.parse(await fs.readFile(percentPath, 'utf-8')), percentPath);
};

/**
 * Returns the optimizable filter entries, loading them once per `percentPath`.
 *
 * Lazily initializes a shared singleton on first call so that concurrent
 * callers share one in-flight read or fetch.
 *
 * @param percentPath - Local file path, or `null` to fetch remotely.
 * @returns Optimizable filter entries.
 */
const getPercentEntries = async (percentPath: string | null): Promise<PercentEntry[]> => {
    if (percentEntriesCache === null || percentEntriesCache.percentPath !== percentPath) {
        const promise = loadPercentEntries(percentPath);
        const entry = { percentPath, promise };
        percentEntriesCache = entry;
        // Clear the singleton on rejection so a transient network error
        // doesn't poison the cache for all subsequent callers.
        promise.catch(() => {
            if (percentEntriesCache === entry) {
                percentEntriesCache = null;
            }
        });
    }
    return percentEntriesCache.promise;
};

/**
 * Returns the set of optimizable filter IDs.
 *
 * `percent.json` is read from the path given to `use` when one was provided,
 * otherwise fetched remotely — only the per-filter stats content is read
 * from local files by `use` alone.
 *
 * @returns Set of filter IDs that have optimization stats available.
 */
const getOptimizableFilterIds = async () => {
    const entries = await getPercentEntries(localPercentPath);
    return new Set(entries.map(({ filterId: id }) => id));
};

/**
 * `JSON.stringify` with a safe fallback for values it can't represent: it
 * throws on `BigInt`, and returns `undefined` (not a string) for
 * `symbol`/`function`, which would otherwise print as the misleading
 * literal text "undefined".
 *
 * @param stats - Value to describe for an error message.
 * @returns A printable representation of `stats`.
 */
const describeInvalidStats = (stats: unknown): string => {
    if (typeof stats === 'number' && !Number.isFinite(stats)) {
        return String(stats);
    }
    let printed: string;
    try {
        const json = JSON.stringify(stats);
        printed = json === undefined ? String(stats) : json;
    } catch {
        printed = String(stats);
    }
    return printed.slice(0, 200);
};

/**
 * Validates that stats have non-empty groups, and that every group has the
 * shape `skipRuleWithOptimization` relies on. Only validates — does not
 * know where `stats` came from, so it throws a plain `TypeError`; the
 * caller (`getOptimizationStatistics`) decorates it with `filterId` and
 * `sourcePath` as an `OptimizationStatsError`.
 *
 * @param filterId - Numeric filter identifier.
 * @param stats - Parsed optimization stats object.
 * @throws {TypeError} if stats is not an object, if stats.groups is missing, not an
 * array, or empty, or if any group lacks a `rules` object or a numeric `config.hits`.
 */
export function assertValidStats(filterId: number, stats: unknown): asserts stats is OptimizationStats {
    /**
     * @param defect - What's wrong, e.g. `"groups must be a non-empty array"`.
     * @param value - The offending value, folded into the message via `describeInvalidStats`.
     * @returns The `TypeError` to throw.
     */
    const invalidStatsError = (defect: string, value: unknown): TypeError => (
        new TypeError(`Optimization stats for ${filterId}: ${defect}, but got ${describeInvalidStats(value)}`)
    );

    if (stats === null || typeof stats !== 'object') {
        throw invalidStatsError('must be a non-null object', stats);
    }
    if (!('groups' in stats) || !Array.isArray(stats.groups) || stats.groups.length === 0) {
        throw invalidStatsError('groups must be a non-empty array', (stats as { groups?: unknown }).groups);
    }

    /**
     * Checks that a single group has the shape `skipRuleWithOptimization` relies
     * on: a `rules` object to index into, and a numeric `config.hits` to compare
     * against.
     *
     * @param group - Value to check.
     * @returns Whether `group` has a valid shape.
     */
    const isValidOptimizationGroup = (group: unknown): boolean => {
        if (group === null || typeof group !== 'object') {
            return false;
        }
        const { rules, config } = group as { rules?: unknown; config?: unknown };
        if (rules === null || typeof rules !== 'object' || Array.isArray(rules)) {
            return false;
        }
        if (config === null || typeof config !== 'object') {
            return false;
        }
        return Number.isFinite((config as { hits?: unknown }).hits);
    };

    const { groups } = stats;
    const invalidGroupIndex = groups.findIndex((group) => !isValidOptimizationGroup(group));
    if (invalidGroupIndex !== -1) {
        throw invalidStatsError(
            `groups[${invalidGroupIndex}] must have a "rules" object and a numeric "config.hits"`,
            groups[invalidGroupIndex],
        );
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
     * `percent.json` and saves them to disk. Downloads into a staged
     * directory first and swaps it in only after all downloads succeed,
     * so a failed refresh leaves any previously cached stats intact.
     *
     * When both `includedFilterIds` and `excludedFilterIds` are non-empty,
     * a filter is processed only if it is in `includedFilterIds` and not in
     * `excludedFilterIds`.
     *
     * @param basePath - Directory to save `filters/<filterId>/stats.json` into.
     * @param includedFilterIds - Filter IDs to process; empty (default) processes all.
     * @param excludedFilterIds - Filter IDs to exclude; empty (default) excludes none.
     * @param options - Optional settings.
     * @param options.percentPath - Local `percent.json` to use instead of fetching it remotely.
     */
    download: async (
        basePath: string,
        includedFilterIds: number[] = [],
        excludedFilterIds: number[] = [],
        options: PercentOptions = {},
    ) => {
        const percentEntries = await getPercentEntries(options.percentPath ?? null);

        const configs = percentEntries.filter(
            ({ filterId }) => (includedFilterIds.length === 0 || includedFilterIds.includes(filterId))
            && (excludedFilterIds.length === 0 || !excludedFilterIds.includes(filterId)),
        );

        const FILTERS_PATH = path.join(basePath, FILTERS_DIR_NAME);
        const STAGED_PREFIX = `${process.pid}_${Date.now()}`;
        const STAGED_FILTERS_PATH = path.join(basePath, `${STAGED_PREFIX}_${FILTERS_DIR_NAME}`);

        /**
         * Bounds concurrency so a large `percent.json` cannot fan out into unbounded
         * parallel requests if the underlying transport ever becomes truly async.
         */
        const DOWNLOAD_CONCURRENCY = 8;

        try {
            await fs.mkdir(STAGED_FILTERS_PATH, { recursive: true });
            await mapWithConcurrency(configs, DOWNLOAD_CONCURRENCY, async ({ filterId }) => {
                const dir = path.join(STAGED_FILTERS_PATH, String(filterId));
                const statsPath = path.join(dir, STATS_JSON);
                const content = await downloadOptimizationStats(filterId);
                await fs.mkdir(dir, { recursive: true });
                await fs.writeFile(statsPath, content, 'utf-8');
            });
        } catch (error) {
            // Downloads incomplete: staged dir is garbage, safe to discard.
            await fs.rm(STAGED_FILTERS_PATH, { recursive: true, force: true });
            throw error;
        }

        // Swap only after every fetch succeeded. From here on, staged dir is
        // a complete cache — never rm it on failure, that'd destroy the only
        // remaining valid copy once the old FILTERS_PATH is gone.
        await fs.rm(FILTERS_PATH, { recursive: true, force: true });
        await fs.rename(STAGED_FILTERS_PATH, FILTERS_PATH);
    },

    /**
     * Configures `getOptimizationStatistics` to read stats from local files under
     * `basePath` instead of fetching from the remote server.
     * Stats are loaded lazily on demand during compilation. `percent.json`
     * (which determines which filters are optimizable) is read from
     * `options.percentPath` when given, otherwise fetched remotely.
     *
     * @param basePath - Directory containing `filters/<filterId>/stats.json`.
     * @param options - Optional settings.
     * @param options.percentPath - Local `percent.json` to use instead of fetching it remotely.
     */
    use(basePath: string, options: PercentOptions = {}) {
        localStatsPath = basePath;
        localPercentPath = options.percentPath ?? null;
        percentEntriesCache = null;
    },

    /**
     * Removes the cache directory and clears in-memory state.
     *
     * @param basePath - Directory to remove.
     */
    async reset(basePath: string) {
        await fs.rm(basePath, { recursive: true, force: true });
        localStatsPath = null;
        localPercentPath = null;
        percentEntriesCache = null;
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
 * @throws {OptimizationStatsError} When the stats are missing or malformed.
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

    const statsPath = localStatsPath === null
        ? getOptimizationStatsUrl(filterId)
        : path.join(localStatsPath, FILTERS_DIR_NAME, String(filterId), STATS_JSON);

    try {
        const content = localStatsPath !== null
            ? await fs.readFile(statsPath, 'utf-8')
            : await downloadOptimizationStats(filterId);
        stats = JSON.parse(content);
    } catch (originalError) {
        throw new OptimizationStatsError(filterId, statsPath, 'retrieval', { cause: originalError });
    }

    try {
        assertValidStats(filterId, stats);
    } catch (originalError) {
        throw new OptimizationStatsError(filterId, statsPath, 'validation', { cause: originalError });
    }

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
