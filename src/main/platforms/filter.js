/* eslint-disable global-require */
module.exports = (() => {
    /**
     * @typedef {object} OptimizationConfig
     * @property {number} filterId - Filter identifier
     * @property {number} percent - Expected optimization percent
     * `~= (rules count in optimized filter) / (rules count in original filter) * 100`
     * @property {number} minPercent - Lower bound of `percent` value
     * @property {number} maxPercent - Upper bound of `percent` value
     * @property {boolean} strict - If `percent < minPercent || percent  > maxPercent`
     * and strict mode is on then filter compilation should fail, otherwise original rules must be used
     */

    const logger = require('../utils/log');
    const Workaround = require('../utils/workaround');
    const RuleMasks = require('../rule/rule-masks');
    const optimization = require('../optimization');

    const HINT_MASK = `${RuleMasks.MASK_HINT} `;
    const COMMENT_REGEXP = '^\\!($|[^#])';

    const PLATFORM_HINT_REGEXP = /(^| )PLATFORM\(([^)]+)\)/g;
    const NOT_PLATFORM_HINT_REGEXP = /(.*)NOT_PLATFORM\(([^)]+)\)/g;

    const NOT_OPTIMIZED_HINT = 'NOT_OPTIMIZED';

    /**
     * Parses rule hints
     *
     * @param rules rules
     * @param platform Platform
     */
    const splitRuleHintLines = function (rules, platform) {
        const result = [];
        if (rules) {
            for (let i = 0; i < rules.length; i += 1) {
                let rule = rules[i].trim();
                if (rule.startsWith(HINT_MASK)) {
                    continue;
                }

                rule = Workaround.overrideRule(rule, platform);

                const hint = i > 0 ? rules[i - 1] : null;
                result.push({
                    rule,
                    hint: (hint && hint.startsWith(HINT_MASK)) ? hint : null,
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
            const group = match[2];
            const split = group.split(',');
            // eslint-disable-next-line no-restricted-syntax
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
        const { hint } = rule;
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
        const { hint } = rule;
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
     * @param filterId
     * @returns {boolean}
     */
    const shouldOmitRule = function (rule, config, filterId) {
        const ruleText = rule.rule;

        if (!ruleText) {
            return true;
        }

        // Omit rules by filtration settings
        if (!config.configuration.ignoreRuleHints && !isPlatformSupported(rule, config.platform)) {
            logger.log(`${ruleText} removed with platform hint ${rule.hint}`);
            return true;
        }

        if (config.configuration.removeRulePatterns) {
            // eslint-disable-next-line no-restricted-syntax
            for (const pattern of config.configuration.removeRulePatterns) {
                if (ruleText.match(new RegExp(pattern))) {
                    // eslint-disable-next-line max-len
                    logger.log(`${ruleText} removed with removeRulePattern ${pattern} in filter ${filterId} for ${config.platform} platform`);
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
     * @param {OptimizationConfig} optimizationConfig
     */
    const shouldOmitRuleWithOptimization = function (ruleLine, optimizationConfig) {
        const ruleText = ruleLine.rule;

        if (!ruleText) {
            return true;
        }

        if (!isOptimizationSupported(ruleLine)) {
            return false;
        }

        return optimization.skipRuleWithOptimization(ruleText, optimizationConfig);
    };

    /**
     * We want to be sure that our mobile optimization is correct and didn't remove valuable rules
     *
     * @param filterId
     * @param rules
     * @param optimizedRules
     * @param {OptimizationConfig} optimizationConfig
     */
    const isOptimizationCorrect = function (filterId, rules, optimizedRules, optimizationConfig) {
        const filterRulesCount = rules.length;
        const optimizedRulesCount = optimizedRules.length;

        // do not count decimal part of number
        const resultOptimizationPercent = Math.floor((optimizedRulesCount / filterRulesCount) * 100);

        const expectedOptimizationPercent = optimizationConfig.percent;
        const minOptimizationPercent = optimizationConfig.minPercent;
        const maxOptimizationPercent = optimizationConfig.maxPercent;
        const { strict } = optimizationConfig;

        const tooLow = resultOptimizationPercent < minOptimizationPercent;
        const tooHigh = resultOptimizationPercent > maxOptimizationPercent;

        const incorrect = tooLow || tooHigh;

        if (incorrect) {
            const message = `Unable to optimize filter ${filterId} with configuration`
                + `[~=${expectedOptimizationPercent}%, min=${minOptimizationPercent}%, max=${maxOptimizationPercent}%],`
                + `calculated = ${resultOptimizationPercent.toFixed(2)}%! `
                + `Filter rules count: ${filterRulesCount}. Optimized rules count: ${optimizedRulesCount}.`;
            if (strict) {
                throw new Error(message);
            } else {
                logger.error(message);
            }
        }

        logger.info(`Filter ${filterId} optimization: ${filterRulesCount} => ${optimizedRulesCount},`
            + `${expectedOptimizationPercent}% => ${resultOptimizationPercent}%.`);

        return !incorrect;
    };

    /**
     * Filters set of rules with configuration
     *
     * @param rules
     * @param filterId
     * @param config
     */
    const cleanupRules = function (rules, config, filterId) {
        const ruleLines = splitRuleHintLines(rules, config.platform);

        const filtered = ruleLines.filter((r) => !shouldOmitRule(r, config, filterId));

        return joinRuleHintLines(filtered);
    };

    /**
     * Filters set of rules with configuration and optimization
     *
     * @param rules
     * @param config
     * @param {OptimizationConfig} optimizationConfig
     * @param filterId
     */
    const cleanupAndOptimizeRules = function (rules, config, optimizationConfig, filterId) {
        config.configuration.removeRulePatterns = config.configuration.removeRulePatterns || [];
        config.configuration.removeRulePatterns.push(COMMENT_REGEXP);

        const ruleLines = splitRuleHintLines(rules, config.platform);

        const filtered = ruleLines.filter((r) => !shouldOmitRule(r, config, filterId));

        const optimized = filtered.filter((r) => !shouldOmitRuleWithOptimization(r, optimizationConfig));

        let result;
        // We check that our optimization is correct and didn't remove valuable rules
        // We do it via comparing expected optimization percent
        // with real (ratio between optimized rules number and all rules number)
        if (optimizationConfig && !isOptimizationCorrect(filterId, filtered, optimized, optimizationConfig)) {
            // Back to default OPTIMIZATION
            result = joinRuleHintLines(filtered);
        } else {
            result = joinRuleHintLines(optimized);
        }

        config.configuration.removeRulePatterns.pop();
        return result;
    };

    return {
        cleanupRules,
        cleanupAndOptimizeRules,
    };
})();
