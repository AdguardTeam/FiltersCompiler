/* eslint-disable global-require */

module.exports = (() => {
    const Rule = require('./rule.js');
    const RuleTypes = require('./rule-types.js');
    const RuleMasks = require('./rule-masks.js');

    const REPLACE_OPTION = 'replace';
    const OPTIONS_DELIMITER = '$';
    const ESCAPE_CHARACTER = '\\';

    const ATTRIBUTE_START_MARK = '[';
    const ATTRIBUTE_END_MARK = ']';
    const QUOTES = '"';

    /**
     * Splits string by a delimiter, ignoring escaped delimiters
     * @param str               String to split
     * @param delimiter         Delimiter
     * @param escapeCharacter   Escape character
     * @param preserveAllTokens If true - preserve empty entries.
     */
    const splitByDelimiterWithEscapeCharacter = function (str, delimiter, escapeCharacter, preserveAllTokens) {
        const parts = [];

        if (!str) {
            return parts;
        }

        let sb = [];
        for (let i = 0; i < str.length; i += 1) {
            const c = str.charAt(i);

            if (c === delimiter) {
                if (i === 0) { // jshint ignore:line
                    // Ignore
                } else if (str.charAt(i - 1) === escapeCharacter) {
                    sb.push(c);
                } else if (preserveAllTokens || sb.length > 0) {
                    const part = sb.join('');
                    parts.push(part);
                    sb = [];
                }
            } else {
                sb.push(c);
            }
        }

        if (preserveAllTokens || sb.length > 0) {
            parts.push(sb.join(''));
        }

        return parts;
    };

    /**
     * Parses url rule modifiers
     *
     * @param line
     * @returns {{}}
     */
    const parseUrlRule = function (line) {
        const result = {
            urlRuleText: line,
        };

        // Regexp rule may contain dollar sign which also is options delimiter
        if (line.startsWith(RuleMasks.MASK_REGEX_RULE) && line.endsWith(RuleMasks.MASK_REGEX_RULE)
            && line.indexOf(`${REPLACE_OPTION}=`) < 0) {
            return result;
        }

        let startIndex = 0;
        if (line.startsWith(RuleMasks.MASK_WHITE_LIST)) {
            startIndex = RuleMasks.MASK_WHITE_LIST.length;
            result.whiteList = true;
        }

        result.urlRuleText = line.substring(startIndex);

        let optionsPart = null;
        // Start looking from the prev to the last symbol
        // If dollar sign is the last symbol - we simply ignore it.
        for (let i = (line.length - 2); i >= startIndex; i -= 1) {
            const c = line.charAt(i);
            if (c === OPTIONS_DELIMITER) {
                if (i > 0 && line.charAt(i - 1) === ESCAPE_CHARACTER) {
                    // Do nothing
                } else {
                    result.urlRuleText = line.substring(startIndex, i);
                    optionsPart = line.substring(i + 1);

                    // Options delimiter was found, doing nothing
                    break;
                }
            }
        }

        if (!optionsPart) {
            return result;
        }

        const options = splitByDelimiterWithEscapeCharacter(optionsPart, ',', ESCAPE_CHARACTER, false);

        result.modifiers = {};
        options.forEach((m) => {
            const separatorIndex = m.indexOf('=');
            let name = m;
            let values = '';

            if (separatorIndex >= 0) {
                name = m.substring(0, separatorIndex);
                values = m.substring(separatorIndex + 1).split('|');
            }

            if (!result.modifiers[name]) {
                result.modifiers[name] = [];
            }

            if (values) {
                result.modifiers[name] = result.modifiers[name].concat(values);
            }
        });

        return result;
    };

    const getQuoteIndex = function (text, startIndex) {
        let nextChar = '"';
        let quoteIndex = startIndex - 2;

        while (nextChar === '"') {
            quoteIndex = text.indexOf(QUOTES, quoteIndex + 2);
            if (quoteIndex === -1) {
                return -1;
            }
            nextChar = text.length === (quoteIndex + 1) ? '0' : text.charAt(quoteIndex + 1);
        }

        return quoteIndex;
    };

    /**
     * Parses content rule attributes
     */
    const parseContentRuleAttributes = function (line) {
        const result = [];

        let ruleStartIndex = line.indexOf(ATTRIBUTE_START_MARK);

        while (ruleStartIndex !== -1) {
            const equalityIndex = line.indexOf('=', ruleStartIndex + 1);
            const quoteStartIndex = line.indexOf(QUOTES, equalityIndex + 1);
            const quoteEndIndex = getQuoteIndex(line, quoteStartIndex + 1);
            if (quoteStartIndex === -1 || quoteEndIndex === -1) {
                break;
            }

            const ruleEndIndex = line.indexOf(ATTRIBUTE_END_MARK, quoteEndIndex + 1);

            const attributeName = line.substring(ruleStartIndex + 1, equalityIndex);
            let attributeValue = line.substring(quoteStartIndex + 1, quoteEndIndex);
            attributeValue = attributeValue.replace(/""/g, '"');

            result.push({
                attributeName,
                attributeValue,
            });

            if (ruleEndIndex === -1) {
                break;
            }

            ruleStartIndex = line.indexOf(ATTRIBUTE_START_MARK, ruleEndIndex + 1);
        }

        return result;
    };

    /**
     * Parses rule type from string
     *
     * @param ruleText
     */

    const parseRuleType = function (ruleText) {
        if (ruleText.startsWith(RuleMasks.MASK_WHITE_LIST)) {
            return RuleTypes.UrlBlocking;
        } if (ruleText.startsWith(RuleMasks.MASK_COMMENT)) {
            return RuleTypes.Comment;
        } if (ruleText.includes(RuleMasks.MASK_CSS) || ruleText.includes(RuleMasks.MASK_CSS_EXCEPTION)) {
            return RuleTypes.Css;
        } if (ruleText.includes(RuleMasks.MASK_CSS_EXTENDED_CSS_RULE)
            || ruleText.includes(RuleMasks.MASK_CSS_EXCEPTION_EXTENDED_CSS_RULE)
            || ruleText.includes(RuleMasks.MASK_CSS_INJECT_EXTENDED_CSS_RULE)
            || ruleText.includes(RuleMasks.MASK_CSS_EXCEPTION_INJECT_EXTENDED_CSS_RULE)
        ) {
            return RuleTypes.ExtCss;
        } if (ruleText.includes(RuleMasks.MASK_ELEMENT_HIDING)
            || ruleText.includes(RuleMasks.MASK_ELEMENT_HIDING_EXCEPTION)) {
            return RuleTypes.ElementHiding;
        } if (ruleText.includes(RuleMasks.MASK_CONTENT) || ruleText.includes(RuleMasks.MASK_CONTENT_EXCEPTION)) {
            return RuleTypes.Content;
        } if (ruleText.includes(RuleMasks.MASK_SCRIPT) || ruleText.includes(RuleMasks.MASK_SCRIPT_EXCEPTION)) {
            return RuleTypes.Script;
        }
        return RuleTypes.UrlBlocking;
    };

    /**
     * Parses rule type mask from string
     *
     * @param ruleText
     */

    const parseRuleMask = function (ruleText) {
        if (ruleText.startsWith(RuleMasks.MASK_COMMENT)) {
            return RuleMasks.MASK_COMMENT;
        } if (ruleText.includes(RuleMasks.MASK_CSS)) {
            return RuleMasks.MASK_CSS;
        } if (ruleText.includes(RuleMasks.MASK_CSS_EXCEPTION)) {
            return RuleMasks.MASK_CSS_EXCEPTION;
        } if (ruleText.includes(RuleMasks.MASK_CSS_EXTENDED_CSS_RULE)) {
            return RuleMasks.MASK_CSS_EXTENDED_CSS_RULE;
        } if (ruleText.includes(RuleMasks.MASK_CSS_EXCEPTION_EXTENDED_CSS_RULE)) {
            return RuleMasks.MASK_CSS_EXCEPTION_EXTENDED_CSS_RULE;
        } if (ruleText.includes(RuleMasks.MASK_CSS_INJECT_EXTENDED_CSS_RULE)) {
            return RuleMasks.MASK_CSS_INJECT_EXTENDED_CSS_RULE;
        } if (ruleText.includes(RuleMasks.MASK_CSS_EXCEPTION_INJECT_EXTENDED_CSS_RULE)) {
            return RuleMasks.MASK_CSS_EXCEPTION_INJECT_EXTENDED_CSS_RULE;
        } if (ruleText.includes(RuleMasks.MASK_ELEMENT_HIDING_EXCEPTION)) {
            return RuleMasks.MASK_ELEMENT_HIDING_EXCEPTION;
        } if (ruleText.includes(RuleMasks.MASK_ELEMENT_HIDING)) {
            return RuleMasks.MASK_ELEMENT_HIDING;
        } if (ruleText.includes(RuleMasks.MASK_CONTENT)) {
            return RuleMasks.MASK_CONTENT;
        } if (ruleText.includes(RuleMasks.MASK_CONTENT_EXCEPTION)) {
            return RuleMasks.MASK_CONTENT_EXCEPTION;
        } if (ruleText.includes(RuleMasks.MASK_SCRIPT)) {
            return RuleMasks.MASK_SCRIPT;
        } if (ruleText.includes(RuleMasks.MASK_SCRIPT_EXCEPTION)) {
            return RuleMasks.MASK_SCRIPT_EXCEPTION;
        }
        return null;
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
            rule.url = parseResult.urlRuleText;
            rule.whiteList = parseResult.whiteList;
        } else if (ruleType === RuleTypes.ElementHiding || ruleType === RuleTypes.Css
            || ruleType === RuleTypes.Content || ruleType === RuleTypes.Script || ruleType === RuleTypes.ExtCss) {
            rule.contentPart = ruleText.substring(ruleText.indexOf(mask) + mask.length);
            rule.domains = ruleText.substring(0, ruleText.indexOf(mask)).split(',');
            rule.mask = mask;

            if (ruleType === RuleTypes.Content) {
                rule.contentAttributes = parseContentRuleAttributes(ruleText);
            }
        }

        return rule;
    };

    return {
        parseRule,
    };
})();
