/* globals require */

module.exports = (() => {

    'use strict';

    const Workaround = require('../utils/workaround.js');
    const RuleMasks = require('../rule/rule-masks.js');

    const HINT_MASK = RuleMasks.MASK_HINT + " ";

    const ADG_SCRIPT_HACK = "adg_start_script_inject";
    const ADG_STYLE_HACK = "adg_start_style_inject";
    const LOADED_SCRIPT_STRING = "loaded-script=\"true\"";

    const PLATFORM_HINT_REGEXP = /(^| )PLATFORM\(([^)]+)\)/g;
    const NOT_PLATFORM_HINT_REGEXP = /(.*)NOT_PLATFORM\(([^)]+)\)/g;

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

        const stripped = hint.substring(HINT_MASK.length).trim();

        const supportedPlatforms = parsePlatforms(stripped, PLATFORM_HINT_REGEXP);
        const unsupportedPlatforms = parsePlatforms(stripped, NOT_PLATFORM_HINT_REGEXP);

        if (!platform) {
            return true;
        }

        const supported = supportedPlatforms.length === 0 || supportedPlatforms.indexOf(platform) >= 0;
        const unsupported = unsupportedPlatforms.length > 0 && unsupportedPlatforms.indexOf(platform) >= 0;

        return supported && !unsupported;
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

        if (config.configuration.omitCommentRules && ruleText.startsWith(RuleMasks.MASK_COMMENT)) {
            return true;
        }

        if (config.configuration.omitAdgHackRules &&
            (ruleText.includes(ADG_SCRIPT_HACK) ||
            ruleText.includes(ADG_STYLE_HACK) ||
            ruleText.includes(LOADED_SCRIPT_STRING))) {

            return true;
        }

        if (config.configuration.omitContentRules &&
            (ruleText.includes(RuleMasks.MASK_CONTENT) ||
            ruleText.includes(RuleMasks.MASK_CONTENT_EXCEPTION))) {
            return true;
        }

        if (config.configuration.omitRulePatterns) {
            for (let pattern of config.configuration.omitRulePatterns) {
                if (ruleText.includes(pattern)) {
                    return true;
                }
            }
        }

        return false;
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

        const result = [];
        filtered.forEach((f) => {
            if (f.hint) {
                result.push(f.hint);
            }
            result.push(f.rule);
        });

        return result;
    };

    return {
        cleanupRules: cleanupRules
    };
})();