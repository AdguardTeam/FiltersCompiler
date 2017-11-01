/* globals require */

module.exports = (() => {

    'use strict';

    const Rule = require('./rule.js');
    const RuleTypes = require('./rule-types.js');

    const MASK_REGEX_RULE = "/";
    const MASK_WHITE_LIST = "@@";
    const MASK_ELEMENT_HIDING = "##";
    const MASK_ELEMENT_HIDING_EXCEPTION = "#@#";
    const MASK_CSS = "#$#";
    const MASK_CSS_EXCEPTION = "#@$#";
    const MASK_SCRIPT = "#%#";
    const MASK_SCRIPT_EXCEPTION = "#@%#";
    const MASK_CONTENT = "$$";
    const MASK_COMMENT = "!";

    const REPLACE_OPTION = "replace";
    const OPTIONS_DELIMITER = "$";
    const ESCAPE_CHARACTER = '\\';

    /**
     * Parses rule css selector
     *
     * @param line
     * @returns {string}
     */
    const parseCssSelector = function (line) {
        return line.substring(line.indexOf(MASK_ELEMENT_HIDING) + 2);
    };

    /**
     * Parses url rule modifiers
     *
     * @param line
     * @returns {{}}
     */
    const parseUrlRuleModifiers = function (line) {

        // Regexp rule may contain dollar sign which also is options delimiter
        if (line.startsWith(MASK_REGEX_RULE) && line.endsWith(MASK_REGEX_RULE) &&
            line.indexOf(REPLACE_OPTION + '=') < 0) {
            return {};
        }

        if (line.indexOf('#$#') >= 0) {
            return {};
        }

        let startIndex = 0;
        if (line.startsWith(MASK_WHITE_LIST)) {
            startIndex = MASK_WHITE_LIST.length;
        }

        let optionsPart = null;
        let foundEscaped = false;
        // Start looking from the prev to the last symbol
        // If dollar sign is the last symbol - we simply ignore it.
        for (let i = (line.length - 2); i >= startIndex; i--) {
            let c = line.charAt(i);
            if (c === OPTIONS_DELIMITER) {
                if (i > 0 && line.charAt(i - 1) === ESCAPE_CHARACTER) {
                    foundEscaped = true;
                } else {
                    optionsPart = line.substring(i + 1);

                    if (foundEscaped) {
                        // Find and replace escaped options delimiter
                        optionsPart = optionsPart.replace(ESCAPE_CHARACTER + OPTIONS_DELIMITER, OPTIONS_DELIMITER);
                    }

                    // Options delimiter was found, doing nothing
                    break;
                }
            }
        }

        if (!optionsPart) {
            return {};
        }

        let options = optionsPart.split(',');

        const result = {};
        options.forEach((m) => {
            const separatorIndex = m.indexOf('=');
            let name = m;
            let values = '';

            if (separatorIndex >= 0) {
                name = m.substring(0, separatorIndex);
                values = m.substring(separatorIndex + 1).split('|');
            }

            if (!result[name]) {
                result[name] = [];
            }

            if (values) {
                result[name] = result[name].concat(values);
            }
        });

        return result;
    };

    /**
     * Checks if rule is url blocking rule
     *
     * @param ruleText
     */
    const isUrlBlockingRule = function (ruleText) {
        return !ruleText.includes(MASK_ELEMENT_HIDING_EXCEPTION) &&
            !ruleText.includes(MASK_CSS) &&
            !ruleText.includes(MASK_CSS_EXCEPTION) &&
            !ruleText.includes(MASK_SCRIPT) &&
            !ruleText.includes(MASK_SCRIPT_EXCEPTION) &&
            !ruleText.includes(MASK_CONTENT) &&
            !ruleText.startsWith(MASK_COMMENT);
    };

    /**
     * Parses rule type from string
     *
     * @param ruleText
     */
    const parseRuleType = function (ruleText) {
        if (ruleText.startsWith(MASK_COMMENT)) {
            return RuleTypes.Comment;
        } else if (ruleText.indexOf(MASK_ELEMENT_HIDING) >= 0) {
            return RuleTypes.ElementHiding;
        } else if (ruleText.includes(MASK_CONTENT)) {
            return RuleTypes.Content;
        } else if (isUrlBlockingRule(ruleText)) {
            return RuleTypes.UrlBlocking;
        } else {
            return RuleTypes.Other;
        }
    };

    /**
     * Parses rule object from string
     *
     * @param ruleText
     * @returns {Rule}
     */
    const parseRule = function (ruleText) {
        const ruleType = parseRuleType(ruleText);
        const rule = new Rule(ruleText, ruleType);

        if (ruleType === RuleTypes.ElementHiding) {
            rule.cssSelector = parseCssSelector(ruleText);
            rule.cssDomains = ruleText.substring(0, ruleText.indexOf('#')).split(',');
        } else if (ruleType === RuleTypes.UrlBlocking) {
            rule.modifiers = parseUrlRuleModifiers(ruleText);
            rule.url = ruleText.substring(0, ruleText.indexOf('$'));
        }

        return rule;
    };

    return {
        parseRule: parseRule
    };
})();