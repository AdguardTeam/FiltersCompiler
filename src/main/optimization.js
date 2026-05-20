/* eslint-disable global-require */
import fs from 'fs';
import path from 'path';
import { downloadFile } from './utils/webutils';

// Here we can access optimizable filters and its optimization percentages
const OPTIMIZATION_KEY = '4DDBE80A3DA94D819A00523252FB6380';
export const OPTIMIZATION_PERCENT_URL = `https://chrome.adtidy.org/optimization_config/percent.json?key=${OPTIMIZATION_KEY}`;

const downloadOptimizationPercent = () => downloadFile(OPTIMIZATION_PERCENT_URL);

const downloadOptimizationStats = (filterId) => {
    const optimizationStatsUrl = `https://chrome.adtidy.org/filters/${filterId}/stats.json?key=${OPTIMIZATION_KEY}`;

    return downloadFile(optimizationStatsUrl);
};

let optimizationEnabled = true;

let optimizationStatsCache = {};

export const localOptimizationConfig = {
    downloadPercentJson: async (configPath) => {
        const percentContent = await downloadOptimizationPercent();

        await fs.promises.mkdir(configPath, { recursive: true });
        await fs.promises.writeFile(path.join(configPath, 'percent.json'), percentContent, 'utf-8');
    },
    downloadStatsFromPercentJson: async (configPath) => {
        const percentContent = fs.readFileSync(path.join(configPath, 'percent.json'), 'utf-8');
        const percent = JSON.parse(percentContent);
        await Promise.all(
            percent.config.map(async ({ filterId }) => {
                const statsPath = path.join(configPath, 'filters', filterId.toString(), 'stats.json');
                let content;
                if (fs.existsSync(statsPath)) {
                    content = fs.readFileSync(statsPath, 'utf-8');
                } else {
                    content = downloadOptimizationStats(filterId);
                    const dir = path.join(configPath, 'filters', filterId.toString());
                    fs.mkdirSync(dir, { recursive: true });
                    fs.writeFileSync(statsPath, content, 'utf-8');
                }
                optimizationStatsCache[filterId] = JSON.parse(content);
            }),
        );
    },
    async reset(configPath) {
        await fs.promises.rm(configPath, { recursive: true, force: true });
        optimizationStatsCache = {};
    },
};

/**
 * Downloads filter optimization stats for the specified filter
 */
export const getOptimizationStats = (filterId) => {
    if (!optimizationEnabled) {
        return null;
    }

    if (optimizationEnabled) {
        if (optimizationStatsCache[filterId]) {
            return optimizationStatsCache[filterId];
        }

        const content = downloadOptimizationStats(filterId);

        if (content) {
            return JSON.parse(content);
        }
    }

    throw new Error(`Unable to retrieve optimization stats for ${filterId}`);
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
