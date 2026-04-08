/* eslint-disable global-require */
import fs from 'fs';
import path from 'path';
import { downloadFile } from './utils/webutils';

// Here we can access optimizable filters and its optimization percentages
export const OPTIMIZATION_PERCENT_URL = 'https://chrome.adtidy.org/optimization_config/percent.json';

const downloadOptimizationPercent = () => downloadFile(OPTIMIZATION_PERCENT_URL);

const downloadOptimizationStats = (filterId) => {
    const optimizationStatsUrl = `https://chrome.adtidy.org/filters/${filterId}/stats.json?key=4DDBE80A3DA94D819A00523252FB6380`;

    return downloadFile(optimizationStatsUrl);
};

let optimizationEnabled = true;

let filtersOptimizationPercent = null;

let localOptimizationConfigPath = null;

export const optimizationConfigLocal = {
    setPath: (path) => {
        localOptimizationConfigPath = path;
    },
    generate: async (filePath) => {
        const percentContent = await downloadOptimizationPercent();

        await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
        await fs.promises.writeFile(filePath, percentContent, 'utf-8');
    },
};

/**
 * Downloads and caches filters optimization percentages configuration
 */
export const getFiltersOptimizationPercent = () => {
    if (!optimizationEnabled) {
        return null;
    }

    if (filtersOptimizationPercent === null) {
        const content = localOptimizationConfigPath
            ? fs.readFileSync(localOptimizationConfigPath, 'utf-8')
            : downloadOptimizationPercent();

        filtersOptimizationPercent = JSON.parse(content);
    }

    if (filtersOptimizationPercent.config.length === 0) {
        // eslint-disable-next-line no-throw-literal
        throw 'Invalid configuration';
    }

    return filtersOptimizationPercent;
};

/**
 * Downloads filter optimization config for the filter
 */
export const getFilterOptimizationConfig = (filterId) => {
    if (!optimizationEnabled) {
        return null;
    }

    // config: [{filterId: 1, percent: 45}, ...]
    const filterOptimizationPercent = getFiltersOptimizationPercent().config
        .find((config) => config.filterId === filterId);

    let optimizationConfig = null;
    if (optimizationEnabled && filterOptimizationPercent) {
        const content = downloadOptimizationStats(filterId);

        optimizationConfig = JSON.parse(content);
        if (!optimizationConfig || !optimizationConfig.groups || optimizationConfig.groups.length === 0) {
            throw new Error(`Unable to retrieve optimization stats for ${filterId}`);
        }
    }

    return optimizationConfig;
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
