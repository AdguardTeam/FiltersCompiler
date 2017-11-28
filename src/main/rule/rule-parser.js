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
    const MASK_CONTENT_EXCEPTION = "$@$";
    const MASK_COMMENT = "!";

    const REPLACE_OPTION = "replace";
    const OPTIONS_DELIMITER = "$";
    const ESCAPE_CHARACTER = '\\';

    /**
     * Parses url rule modifiers
     *
     * @param line
     * @returns {{}}
     */
    const parseUrlRule = function (line) {

        // Regexp rule may contain dollar sign which also is options delimiter
        if (line.startsWith(MASK_REGEX_RULE) && line.endsWith(MASK_REGEX_RULE) &&
            line.indexOf(REPLACE_OPTION + '=') < 0) {
            return {};
        }

        let startIndex = 0;
        if (line.startsWith(MASK_WHITE_LIST)) {
            startIndex = MASK_WHITE_LIST.length;
        }

        let urlRuleText = line.substring(startIndex);

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
                    urlRuleText = line.substring(startIndex, i);
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

        return {
            modifiers: result,
            urlRuleText: urlRuleText
        };
    };

    /**
     * Parses rule type from string
     *
     * @param ruleText
     */
    const parseRuleType = function (ruleText) {
        if (ruleText.startsWith(MASK_WHITE_LIST)) {
            return RuleTypes.UrlBlocking;
        } else if (ruleText.startsWith(MASK_COMMENT)) {
            return RuleTypes.Comment;
        } else if (ruleText.includes(MASK_CSS) || ruleText.includes(MASK_CSS_EXCEPTION)) {
            return RuleTypes.Css;
        } else if (ruleText.includes(MASK_ELEMENT_HIDING) || ruleText.includes(MASK_ELEMENT_HIDING_EXCEPTION)) {
            return RuleTypes.ElementHiding;
        } else if (ruleText.includes(MASK_CONTENT) || ruleText.includes(MASK_CONTENT_EXCEPTION)) {
            return RuleTypes.Content;
        } else if (ruleText.includes(MASK_SCRIPT) || ruleText.includes(MASK_SCRIPT_EXCEPTION)) {
            return RuleTypes.Script;
        } else {
            return RuleTypes.UrlBlocking;
        }
    };

    /**
     * Parses rule type mask from string
     *
     * @param ruleText
     */
    const parseRuleMask = function (ruleText) {
        if (ruleText.startsWith(MASK_COMMENT)) {
            return MASK_COMMENT;
        } else if (ruleText.includes(MASK_CSS)) {
            return MASK_CSS;
        } else if (ruleText.includes(MASK_CSS_EXCEPTION)) {
            return MASK_CSS_EXCEPTION;
        } else if (ruleText.includes(MASK_ELEMENT_HIDING_EXCEPTION)) {
            return MASK_ELEMENT_HIDING_EXCEPTION;
        } else if (ruleText.includes(MASK_ELEMENT_HIDING)) {
            return MASK_ELEMENT_HIDING;
        } else if (ruleText.includes(MASK_CONTENT)) {
            return MASK_CONTENT;
        } if (ruleText.includes(MASK_CONTENT_EXCEPTION)) {
            return MASK_CONTENT_EXCEPTION;
        } else if (ruleText.includes(MASK_SCRIPT)) {
            return MASK_SCRIPT;
        } else if (ruleText.includes(MASK_SCRIPT_EXCEPTION)) {
            return MASK_SCRIPT_EXCEPTION;
        } else {
            return null;
        }
    };

    /**
     * Parses rule object from string
     *
     * @param ruleText
     * @returns {Rule}
     */
    const parseRule = function (ruleText) {
        const mask = parseRuleMask(ruleText);
        const ruleType = parseRuleType(ruleText);
        const rule = new Rule(ruleText, ruleType);

        if (ruleType === RuleTypes.UrlBlocking) {
            const parseResult = parseUrlRule(ruleText);
            rule.modifiers = parseResult.modifiers || [];
            rule.url = parseResult.urlRuleText || ruleText;
        } else if (ruleType === RuleTypes.ElementHiding || ruleType === RuleTypes.Css ||
            ruleType === RuleTypes.Content || ruleType === RuleTypes.Script) {

            rule.contentPart = ruleText.substring(ruleText.indexOf(mask) + mask.length);
            rule.domains = ruleText.substring(0, ruleText.indexOf(mask)).split(',');
            rule.mask = mask;
        }

        return rule;
    };

    return {
        parseRule: parseRule
    };
})();