/* globals require */

module.exports = (() => {

    'use strict';

    const logger = require("../utils/log.js");
    const Workaround = require('../utils/workaround.js');
    const RuleMasks = require('../rule/rule-masks.js');

    const HINT_MASK = RuleMasks.MASK_HINT + " ";
    const COMMENT_REGEXP = "^\\!";

    const PLATFORM_HINT_REGEXP = /(^| )PLATFORM\(([^)]+)\)/g;
    const NOT_PLATFORM_HINT_REGEXP = /(.*)NOT_PLATFORM\(([^)]+)\)/g;

    const NOT_OPTIMIZED_HINT = "NOT_OPTIMIZED";

    const SUPPRESS_INCORRECT_OPTIMIZATION_FILTER_ID = 208; // 'Malware Domains' filter

    /**
     * Parses rule hints
     *
     * @param rules rules
     * @param platform Platform
     */
    const splitRuleHintLines = function(rules, platform) {
        const result = [];
        if (rules) {
            for (let i = 0; i < rules.length; i++) {
                let rule = rules[i].trim();
                if (rule.startsWith(HINT_MASK)) {
                    continue;
                }

                rule = Workaround.overrideRule(rule, platform);

                const hint = i > 0 ? rules[i - 1] : null;
                result.push({
                    rule: rule,
                    hint: (hint && hint.startsWith(HINT_MASK)) ? hint : null
                });
            }
        }

        return result;
    };

    /**
     * Joins hint rules
     *
     * @param hintLines
     * @returns {Array}
     */
    const joinRuleHintLines = function (hintLines) {
        const result = [];
        hintLines.forEach((f) => {
            if (f.hint) {
                result.push(f.hint);
            }
            result.push(f.rule);
        });

        return result;
    };

    /**
     * Parses platforms by pattern
     *
     *
     * @param hint    stripped hint
     * @param pattern regexp
     */
    const parsePlatforms = function (hint, pattern) {
        const result = [];

        if (!hint) {
            return result;
        }

        let match = pattern.exec(hint);
        while (match !== null) {
            let group = match[2];
            let split = group.split(",");
            for (let s of split) {
                s = s.trim();
                result.push(s);
            }

            match = pattern.exec(hint);
        }

        return result;
    };

    /**
     * Is rule supported with platform hint
     *
     * @param rule
     * @param platform
     */
    const isPlatformSupported = function (rule, platform) {
        const hint = rule.hint;
        if (!hint || !hint.startsWith(HINT_MASK)) {
            return true;
        }

        if (!platform) {
            return true;
        }

        const stripped = hint.substring(HINT_MASK.length).trim();

        const supportedPlatforms = parsePlatforms(stripped, PLATFORM_HINT_REGEXP);
        const unsupportedPlatforms = parsePlatforms(stripped, NOT_PLATFORM_HINT_REGEXP);

        const supported = supportedPlatforms.length === 0 || supportedPlatforms.indexOf(platform) >= 0;
        const unsupported = unsupportedPlatforms.length > 0 && unsupportedPlatforms.indexOf(platform) >= 0;

        return supported && !unsupported;
    };

    /**
     * Checks if rule supports optimization
     *
     * @param rule
     * @returns {boolean}
     */
    const isOptimizationSupported = function (rule) {
        const hint = rule.hint;
        if (!hint || !hint.startsWith(HINT_MASK)) {
            return true;
        }

        const stripped = hint.substring(HINT_MASK.length).trim();

        return !stripped.includes(NOT_OPTIMIZED_HINT);
    };

    /**
     * Checks if rule should be omitted with specified configuration
     *
     * @param rule
     * @param config
     * @returns {boolean}
     */
    const shouldOmitRule = function (rule, config) {
        const ruleText = rule.rule;

        if (!ruleText) {
            return true;
        }

        // Omit rules by filtration settings
        if (!config.configuration.ignoreRuleHints && !isPlatformSupported(rule, config.platform)) {
            return true;
        }

        if (config.configuration.removeRulePatterns) {
            for (let pattern of config.configuration.removeRulePatterns) {
                if (ruleText.match(new RegExp(pattern))) {
                    return true;
                }
            }
        }

        return false;
    };

    /**
     * Checks if rule should be omitted with specified configuration
     *
     * @param ruleLine
     * @param optimizationConfig
     */
    const shouldOmitRuleWithOptimization = function (ruleLine, optimizationConfig) {
        const ruleText = ruleLine.rule;

        if (!ruleText) {
            return true;
        }

        if (!isOptimizationSupported(ruleLine)) {
            return false;
        }

        if (!optimizationConfig || !optimizationConfig.groups) {
            return false;
        }

        for (let group of optimizationConfig.groups) {
            let hits = group.rules[ruleText];
            if (hits !== undefined && hits < group.config.hits) {
                return true;
            }
        }

        return false;
    };

    /**
     * low bound = percent - 20. For some filters: low bound = percent - 30
     * <p>
     * Calculation of low bound depends on filter
     *
     * @param expectedOptimizationPercent Expected optimization percent
     * @return int bound after which optimization is incorrect
     */
    const getOptimizationPercentLowBound = function (expectedOptimizationPercent) {
        return Math.max(expectedOptimizationPercent - 20, 25);
    };

    /**
     * upper bound = percent + 10
     * <p>
     * Calculation of upper bound doesn't depend on filter
     *
     * @param expectedOptimizationPercent Expected optimization percent
     * @return int upper bound after which optimization is incorrect
     */
    const getOptimizationPercentUpperBound = function (expectedOptimizationPercent) {
        return Math.min(expectedOptimizationPercent + 10, 100);
    };

    /**
     * We want to be sure that our mobile optimization is correct and didn't remove valuable rules
     *
     * @param filterId
     * @param rules
     * @param optimizedRules
     * @param optimizationConfig
     */
    const isOptimizationCorrect = function (filterId, rules, optimizedRules, optimizationConfig) {
        if (optimizationConfig.percent === null) {
            return true;
        }

        const filterRulesCount = rules.length;
        const optimizedRulesCount = optimizedRules.length;

        const resultOptimizationPercent = optimizedRulesCount / filterRulesCount * 100;
        const expectedOptimizationPercent = optimizationConfig.percent;

        const tooLow = resultOptimizationPercent < getOptimizationPercentLowBound(expectedOptimizationPercent);
        const tooHigh = resultOptimizationPercent > getOptimizationPercentUpperBound(expectedOptimizationPercent);

        if (filterId !== SUPPRESS_INCORRECT_OPTIMIZATION_FILTER_ID && (tooLow || tooHigh)) {
            logger.error(`We want to get optimized mobile filter ${filterId} which less than original on ${expectedOptimizationPercent}%, but on practice we have ${resultOptimizationPercent}%! ` +
                `Filter rules count: ${filterRulesCount}. Optimized rules count: ${optimizedRulesCount}.`);
        }

        logger.log(`Filter ${filterId} optimization: ${filterRulesCount} => ${optimizedRulesCount}, ${expectedOptimizationPercent}% => ${resultOptimizationPercent}%.`);

        return filterId === SUPPRESS_INCORRECT_OPTIMIZATION_FILTER_ID || !tooLow;
    };

    /**
     * Filters set of rules with configuration
     *
     * @param rules
     * @param config
     */
    const cleanupRules = function (rules, config) {
        const ruleLines = splitRuleHintLines(rules, config.platform);

        const filtered = ruleLines.filter((r) => {
            return !shouldOmitRule(r, config);
        });

        return joinRuleHintLines(filtered);
    };

    /**
     * Filters set of rules with configuration and optimization
     *
     * @param rules
     * @param config
     * @param optimizationConfig
     * @param filterId
     */
    const cleanupAndOptimizeRules = function (rules, config, optimizationConfig, filterId) {

        config.configuration.removeRulePatterns = config.configuration.removeRulePatterns || [];
        config.configuration.removeRulePatterns.push(COMMENT_REGEXP);

        const ruleLines = splitRuleHintLines(rules, config.platform);

        const filtered = ruleLines.filter((r) => {
            return !shouldOmitRule(r, config);
        });

        const optimized = filtered.filter((r) => {
            return !shouldOmitRuleWithOptimization(r, optimizationConfig);
        });

        // We check that our optimization is correct and didn't remove valuable rules
        // We do it via comparing expected optimization percent with real (ratio between optimized rules number and all rules number)
        if (optimizationConfig && !isOptimizationCorrect(filterId, filtered, optimized, optimizationConfig)) {
            // Back to default OPTIMIZATION
            return joinRuleHintLines(filtered);
        }

        return joinRuleHintLines(optimized);
    };

    return {
        cleanupRules: cleanupRules,
        cleanupAndOptimizeRules: cleanupAndOptimizeRules
    };
})();