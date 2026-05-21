/* eslint-disable global-require */
import fs from 'fs';
import path from 'path';
import { downloadFile } from './utils/webutils';

// Here we can access optimizable filters and its optimization percentages
const OPTIMIZATION_KEY = '4DDBE80A3DA94D819A00523252FB6380';
export const OPTIMIZATION_PERCENT_URL = `https://chrome.adtidy.org/optimization_config/percent.json?key=${OPTIMIZATION_KEY}`;

// Path segment constants for the local config directory layout:
//   <configPath>/percent.json
//   <configPath>/filters/<filterId>/stats.json
const PERCENT_JSON = 'percent.json';
const STATS_JSON = 'stats.json';
const FILTERS_DIR = 'filters';

const downloadOptimizationPercent = async () => downloadFile(OPTIMIZATION_PERCENT_URL);

const downloadOptimizationStats = async (filterId) => {
    const optimizationStatsUrl = `https://chrome.adtidy.org/filters/${filterId}/stats.json?key=${OPTIMIZATION_KEY}`;

    return downloadFile(optimizationStatsUrl);
};

let optimizationEnabled = true;

let optimizationStatsCache = {};

/**
 * Set of filter IDs that have optimization stats on the server.
 * Populated lazily from percent.json (remote download) or eagerly by
 * `downloadStatsFromPercentJson` (local cache path).
 * `null` means not yet loaded.
 *
 * @type {Set<number>|null}
 */
let optimizableFilterIds = null;

/**
 * Manages a local on-disk cache of optimization configuration files.
 *
 * Expected directory layout under `configPath`:
 * ```
 * <configPath>/
 *   percent.json                   — list of optimizable filter IDs and percentages
 *   filters/
 *     <filterId>/
 *       stats.json                 — per-filter hit-count stats used during compilation
 * ```
 *
 * Typical usage:
 * 1. `downloadPercentJson(configPath)` — download and save `percent.json` once
 *    so it can be inspected / edited before the build.
 * 2. `downloadStatsFromPercentJson(configPath)` — fill in any missing
 *    `stats.json` files and load all stats into the in-memory cache.
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

        await fs.promises.mkdir(configPath, { recursive: true });
        await fs.promises.writeFile(path.join(configPath, PERCENT_JSON), percentContent, 'utf-8');
    },

    /**
     * Reads the local `percent.json`, downloads any missing `stats.json` files
     * for each listed filter, and loads all stats into the in-memory cache.
     * Existing `stats.json` files are not overwritten (preserves user edits).
     *
     * @param {string} configPath - Directory containing `percent.json`.
     * @returns {Promise<void>}
     */
    downloadStatsFromPercentJson: async (configPath) => {
        const percentContent = fs.readFileSync(path.join(configPath, PERCENT_JSON), 'utf-8');
        const percent = JSON.parse(percentContent);

        optimizableFilterIds = new Set(percent.config.map(({ filterId }) => filterId));

        await Promise.all(
            percent.config.map(async ({ filterId }) => {
                const statsPath = path.join(configPath, FILTERS_DIR, filterId.toString(), STATS_JSON);
                let content;
                if (fs.existsSync(statsPath)) {
                    content = fs.readFileSync(statsPath, 'utf-8');
                } else {
                    content = await downloadOptimizationStats(filterId);
                    const dir = path.join(configPath, FILTERS_DIR, filterId.toString());
                    fs.mkdirSync(dir, { recursive: true });
                    fs.writeFileSync(statsPath, content, 'utf-8');
                }
                optimizationStatsCache[filterId] = JSON.parse(content);
            }),
        );
    },

    /**
     * Removes the cache directory and clears in-memory state.
     *
     * @param {string} configPath - Directory to remove.
     * @returns {Promise<void>}
     */
    async reset(configPath) {
        await fs.promises.rm(configPath, { recursive: true, force: true });
        optimizationStatsCache = {};
        optimizableFilterIds = null;
    },
};

/**
 * Returns the optimization stats for the given filter, or `null` when
 * optimization is disabled or the filter is not listed in `percent.json`.
 *
 * On the first call for an uncached filter the function lazily downloads
 * `percent.json` from the remote server to determine whether the filter
 * participates in optimization. If the filter is listed, its `stats.json` is
 * then downloaded, validated, and cached in memory.
 *
 * @param {number} filterId - Numeric filter identifier.
 * @returns {object|null} Parsed stats object, or `null` when the filter has no
 *   optimization stats.
 * @throws {Error} When the downloaded stats are missing or malformed.
 */
export const getOptimizationStats = async (filterId) => {
    if (!optimizationEnabled) {
        return null;
    }

    if (optimizationStatsCache[filterId] !== undefined) {
        return optimizationStatsCache[filterId];
    }

    // Lazily load the set of optimizable filter IDs from percent.json so that
    // filters not listed there return null without hitting the stats endpoint.
    if (optimizableFilterIds === null) {
        const raw = await downloadOptimizationPercent();
        optimizableFilterIds = new Set(JSON.parse(raw).config.map(({ filterId: id }) => id));
    }

    if (!optimizableFilterIds.has(filterId)) {
        return null;
    }

    const content = await downloadOptimizationStats(filterId);

    if (!content) {
        throw new Error(`Unable to retrieve optimization stats for ${filterId}`);
    }

    const stats = JSON.parse(content);

    if (!Array.isArray(stats.groups) || stats.groups.length === 0) {
        throw new Error(`Invalid optimization stats for ${filterId}: missing or empty groups`);
    }

    return stats;
};

/**
 * Checks if rule should be skipped, because optimization is enabled for this filter
 * and hits of this rule is lower than some value
 * @param ruleText Rule text
 * @param optimizationConfig Optimization config for this filter (retrieved with getFilterOptimizationConfig)
 */
export const skipRuleWithOptimization = (ruleText, optimizationConfig) => {
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
