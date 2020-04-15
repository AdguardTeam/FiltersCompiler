/* eslint-disable global-require */
module.exports = (() => {
    const webutils = require('./utils/webutils.js');

    // Here we can access optimizable filters and its optimization percentages
    // eslint-disable-next-line max-len
    const OPTIMIZATION_PERCENT_URL = 'https://chrome.adtidy.org/optimization_config/percent.json?key=4DDBE80A3DA94D819A00523252FB6380';
    // eslint-disable-next-line max-len
    const OPTIMIZATION_STATS_URL = 'https://chrome.adtidy.org/filters/{0}/stats.json?key=4DDBE80A3DA94D819A00523252FB6380';

    let optimizationEnabled = true;

    let filtersOptimizationPercent = null;

    /**
     * Downloads and caches filters optimization percentages configuration
     */
    const getFiltersOptimizationPercent = () => {
        if (!optimizationEnabled) {
            return null;
        }

        if (filtersOptimizationPercent === null) {
            filtersOptimizationPercent = JSON.parse(webutils.downloadFile(OPTIMIZATION_PERCENT_URL));
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
    const getFilterOptimizationConfig = (filterId) => {
        if (!optimizationEnabled) {
            return null;
        }

        // config: [{filterId: 1, percent: 45}, ...]
        const filterOptimizationPercent = getFiltersOptimizationPercent().config
            .find((config) => config.filterId === filterId);

        let optimizationConfig = null;
        if (optimizationEnabled && filterOptimizationPercent) {
            optimizationConfig = JSON.parse(webutils.downloadFile(OPTIMIZATION_STATS_URL.replace('{0}', filterId)));
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
    const skipRuleWithOptimization = (ruleText, optimizationConfig) => {
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
    const disableOptimization = function () {
        optimizationEnabled = false;
    };

    return {
        getFiltersOptimizationPercent,
        getFilterOptimizationConfig,
        skipRuleWithOptimization,
        disableOptimization,
    };
})();
