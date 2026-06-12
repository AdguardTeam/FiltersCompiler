import fs from 'fs/promises';
import path from 'path';
import { downloadFile } from './utils/webutils';

// Here we can access optimizable filters and its optimization percentages
const OPTIMIZATION_KEY = '4DDBE80A3DA94D819A00523252FB6380';
export const OPTIMIZATION_PERCENT_URL = `https://chrome.adtidy.org/optimization_config/percent.json?key=${OPTIMIZATION_KEY}`;

// Path segment constants for the local config directory layout:
//   <configPath>/percent.json
//   <configPath>/filters/<filterId>/stats.json
export const PERCENT_JSON = 'percent.json';
export const STATS_JSON = 'stats.json';
export const FILTERS_DIR = 'filters';

const downloadOptimizationPercent = async () => downloadFile(OPTIMIZATION_PERCENT_URL);

/**
 * Downloads optimization stats for a single filter from the remote server.
 *
 * @param {number} filterId - Numeric filter identifier.
 * @returns {Promise<string>} Raw JSON string of the stats file.
 */
const downloadOptimizationStats = async (filterId) => {
    const optimizationStatsUrl = `https://chrome.adtidy.org/filters/${filterId}/stats.json?key=${OPTIMIZATION_KEY}`;

    return downloadFile(optimizationStatsUrl);
};

let optimizationEnabled = true;

/**
 * When set, `getOptimizationStats` reads stats from local files under this
 * directory instead of fetching from the remote server.
 *
 * @type {string|null}
 */
let localConfigPath = null;

/**
 * Resolves to the set of filter IDs that have optimization stats on the server.
 * Populated lazily on the first `getOptimizationStats` call.
 * Shared across concurrent callers to avoid redundant percent.json fetches.
 *
 * @type {Promise<Set<number>>|null}
 */
let optimizableFilterIdsPromise = null;

/**
 * Returns a promise that resolves to the set of optimizable filter IDs.
 *
 * Lazily initializes a shared promise singleton on first call so that
 * concurrent callers (e.g. via `Promise.all`) share one in-flight fetch of
 * `percent.json` instead of each issuing a separate download.
 * When `useLocalConfig` has been called the IDs are read from the local file.
 *
 * @returns {Promise<Set<number>>}
 */
const getOptimizableFilterIds = async () => {
    if (optimizableFilterIdsPromise === null) {
        const raw = localConfigPath !== null
            ? await fs.readFile(path.join(localConfigPath, PERCENT_JSON), 'utf-8')
            : await downloadOptimizationPercent();
        optimizableFilterIdsPromise = new Set(JSON.parse(raw).config.map(({ filterId: id }) => id));
    }
    return optimizableFilterIdsPromise;
};

/**
 * Validates that stats have non-empty groups.
 *
 * @param {number} filterId
 * @param {object} stats
 * @throws {Error} if stats.groups is missing or empty
 */
export const assertValidStats = (filterId, stats) => {
    if (!Array.isArray(stats.groups) || stats.groups.length === 0) {
        throw new Error(`Invalid optimization stats for ${filterId}: missing or empty groups`);
    }
};

/**
 * Manages a local on-disk cache of optimization configuration files.
 *
 * Typical usage for generating the cache:
 * 1. `downloadPercentJson(configPath)` — download and save `percent.json` once
 *    so it can be inspected / edited before the build.
 * 2. `downloadStatsFromPercentJson(configPath, filterIds)` — fill in any missing
 *    `stats.json` files for the listed filters.
 *
 * Typical usage for using the cache:
 * 1. `useLocalConfig(configPath)` — tells `getOptimizationStats` to read stats
 *    from local files lazily during compilation instead of fetching remotely.
 *
 * 3. `reset(configPath)` — remove the cache directory and clear in-memory state.
 */
export const localOptimizationConfig = {
    /**
     * Downloads `percent.json` from the remote server and saves it to `configPath`.
     * Creates `configPath` if it does not exist.
     *
     * @param {string} configPath - Directory where `percent.json` will be written.
     * @returns {Promise<void>}
     */
    downloadPercentJson: async (configPath) => {
        const percentContent = await downloadOptimizationPercent();

        await fs.mkdir(configPath, { recursive: true });
        await fs.writeFile(path.join(configPath, PERCENT_JSON), percentContent, 'utf-8');
    },

    /**
     * Reads the local `percent.json`, downloads any missing `stats.json` files
     * for each listed filter, and saves them to disk.
     * Existing `stats.json` files are not overwritten (preserves user edits).
     *
     * When `filterIds` is a non-empty array only those filters are processed;
     * pass an empty array to process all filters listed in `percent.json`.
     *
     * @param {string} configPath - Directory containing `percent.json`.
     * @param {number[]} filterIds - Filter IDs to process; empty array processes all.
     * @returns {Promise<void>}
     */
    downloadStatsFromPercentJson: async (configPath, filterIds) => {
        const percentContent = await fs.readFile(path.join(configPath, PERCENT_JSON), 'utf-8');
        const percent = JSON.parse(percentContent);

        const configs = filterIds.length > 0
            ? percent.config.filter(({ filterId }) => filterIds.includes(filterId))
            : percent.config;

        await Promise.all(
            configs.map(async ({ filterId }) => {
                const dir = path.join(configPath, FILTERS_DIR, filterId.toString());
                const statsPath = path.join(dir, STATS_JSON);
                try {
                    await fs.access(statsPath);
                } catch {
                    const content = await downloadOptimizationStats(filterId);
                    await fs.mkdir(dir, { recursive: true });
                    await fs.writeFile(statsPath, content, 'utf-8');
                }
            }),
        );
    },

    /**
     * Configures `getOptimizationStats` to read stats from local files under
     * `configPath` instead of fetching from the remote server.
     * Stats are loaded lazily on demand during compilation.
     *
     * @param {string} configPath - Directory containing `percent.json` and
     *   `filters/<filterId>/stats.json`.
     */
    useLocalConfig(configPath) {
        localConfigPath = configPath;
    },

    /**
     * Removes the cache directory and clears in-memory state.
     *
     * @param {string} configPath - Directory to remove.
     * @returns {Promise<void>}
     */
    async reset(configPath) {
        await fs.rm(configPath, { recursive: true, force: true });
        localConfigPath = null;
    },
};

/**
 * Returns the optimization stats for the given filter, or `null` when
 * optimization is disabled or the filter is not listed in `percent.json`.
 *
 * When `localOptimizationConfig.useLocalConfig(path)` has been called, stats
 * are read lazily from local files. Otherwise stats are fetched from the
 * remote server.
 *
 * @param {number} filterId - Numeric filter identifier.
 * @returns {object|null} Parsed stats object, or `null` when the filter has no
 *   optimization stats.
 * @throws {Error} When the stats are missing or malformed.
 */
export const getOptimizationStats = async (filterId) => {
    if (!optimizationEnabled) {
        return null;
    }

    const optimizableFilterIds = await getOptimizableFilterIds();

    if (!optimizableFilterIds.has(filterId)) {
        return null;
    }

    const content = localConfigPath !== null
        ? await fs.readFile(path.join(localConfigPath, FILTERS_DIR, String(filterId), STATS_JSON), 'utf-8')
        : await downloadOptimizationStats(filterId);

    if (!content) {
        throw new Error(`Unable to retrieve optimization stats for ${filterId}`);
    }

    const stats = JSON.parse(content);

    assertValidStats(filterId, stats);

    return stats;
};

/**
 * Checks if rule should be skipped, because optimization is enabled for this filter
 * and hits of this rule is lower than some value
 * @param ruleText Rule text
 * @param optimizationConfig Optimization config for this filter (retrieved with getOptimizationStats)
 */
export const shouldSkipRule = (ruleText, optimizationConfig) => {
    if (!optimizationConfig) {
        return false;
    }

    // eslint-disable-next-line no-restricted-syntax
    for (const group of optimizationConfig.groups) {
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
