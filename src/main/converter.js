/* globals require */

module.exports = (() => {
    'use strict';

    const logger = require("./utils/log.js");
    const RuleMasks = require('./rule/rule-masks.js');

    const CSS_RULE_REPLACE_PATTERN = /(.*):style\((.*)\)/g;

    const FIRST_PARTY_REGEX = /([$,])first-party/i;
    const FIRST_PARTY_REPLACEMENT = `$1~third-party`;

    const XHR_REGEX = /([$,])xhr/i;
    const XHR_REPLACEMENT = `$1xmlhttprequest`;

    const CSS_REGEX = /([$,])css/i;
    const CSS_REPLACEMENT = `$1stylesheet`;

    const FRAME_REGEX = /([$,])frame/i;
    const FRAME_REPLACEMENT = `$1subdocument`;

    const SCRIPT_HAS_TEXT_REGEX = /(##\^script:(has-text|contains))\((?!\/.+\/\))/i;
    const SCRIPT_HAS_TEXT_REPLACEMENT = '$$$$script[tag-content="';

    const THIRD_PARTY_1P_3P_REGEX = /\$[^#]?(.*,)?(1p|3p)/;
    const THIRD_PARTY_1P = '1p';
    const THIRD_PARTY_1P_REPLACEMENT = '~third-party';
    const THIRD_PARTY_3P = '3p';
    const THIRD_PARTY_3P_REPLACEMENT = 'third-party';

    const scriptlets = require('scriptlets');

    /**
     * Executes rule css conversion
     *
     * @param rule
     * @param parts
     * @param ruleMark
     * @param excluded
     */
    const executeConversion = function (rule, parts, ruleMark, excluded) {
        let result = rule;
        const domain = parts[0];

        if (domain) {
            let rulePart = parts[1];
            if (rulePart.match(CSS_RULE_REPLACE_PATTERN)) {
                const groups = CSS_RULE_REPLACE_PATTERN.exec(rulePart);
                if (groups.length !== 3) {
                    logger.warn(`Cannot convert ${rule}`);
                } else {
                    result = domain + ruleMark;
                    result += `${groups[1]} \{ ${groups[2]} }`;

                    let message = `Rule "${rule}" converted to: ${result}`;
                    logger.log(message);

                    if (excluded) {
                        excluded.push(`! ${message}`);
                        excluded.push(rule);
                    }
                }
            }
        }

        return result;
    };

    /**
     * Convert UBO and ABP scriptlets to AdGuard scriptlets
     * @param {string} rule
     * @return {string|array|undefined} convertedRule
     */
    const convertUboAndAbpScriptletsToAdg = (rule) => {
        if (!(scriptlets.isUboScriptletRule(rule) || scriptlets.isAbpSnippetRule(rule))) {
            return;
        }
        const result = scriptlets.convertScriptletToAdg(rule);
        if (!result) {
            logger.error(`Unable to convert scriptlet to Adguard syntax: "${rule}" `);
            return;
        }
        logger.log(`Rule "${rule}" converted to: ${result}`);
        return result;
    };

    /**
     * Convert ##^script:has-text and ##^script:contains to $$script[tag-content="..."][max-length="262144"]
     * @param {string} rule
     * @return {string} convertedRule
     */
    const convertScriptHasTextToScriptTagContent = (rule) => {
        if (SCRIPT_HAS_TEXT_REGEX.test(rule)) {
            const result = rule.replace(SCRIPT_HAS_TEXT_REGEX, SCRIPT_HAS_TEXT_REPLACEMENT).slice(0, -1) + '"]';
            logger.log(`Rule "${rule}" converted to: ${result}`);
            return `${result}[max-length="262144"]`;
        }
        return rule;
    };

    /**
     * Convert $1p to $~third-party and $3p to $third-party
     * @param {string} rule
     * @return {string} convertedRule
     */
    const convertToThirdParty = (rule) => {
        if (THIRD_PARTY_1P_3P_REGEX.test(rule)) {
            const result = rule.replace(THIRD_PARTY_1P, THIRD_PARTY_1P_REPLACEMENT)
                .replace(THIRD_PARTY_3P, THIRD_PARTY_3P_REPLACEMENT);
            logger.log(`Rule "${rule}" converted to: ${result}`);
            return result;
        }
        return rule;
    };

    /**
     * Replace the following options:
     * $xhr -> $xmlhttprequest
     * ,xhr -> ,xmlhttprequest
     * $css -> $stylesheet
     * ,css -> ,stylesheet
     * $frame -> $subdocument
     * ,frame -> ,subdocument
     * $first-party -> $~third-party
     * ,first-party -> ,~third-party
     *
     * @param {string} rule
     * @return {string} convertedRule
     */
    const replaceOptions = (rule) => {
        if (FIRST_PARTY_REGEX.test(rule) ||
            XHR_REGEX.test(rule) ||
            CSS_REGEX.test(rule) ||
            FRAME_REGEX.test(rule)) {
            let result = rule.replace(FIRST_PARTY_REGEX, FIRST_PARTY_REPLACEMENT)
                .replace(XHR_REGEX, XHR_REPLACEMENT)
                .replace(CSS_REGEX, CSS_REPLACEMENT)
                .replace(FRAME_REGEX, FRAME_REPLACEMENT);
            logger.log(`Rule "${rule}" converted to: ${result}`);
            return result;
        }
        return rule;
    };

    /**
     * Convert CSS injection
     * example.com##h1:style(background-color: blue !important)
     * into
     * example.com#$#h1 { background-color: blue !important }
     * <p>
     * OR (for exceptions):
     * example.com#@#h1:style(background-color: blue !important)
     * into
     * example.com#@$#h1 { background-color: blue !important }
     *
     * @param {string} rule
     * @param {array} excluded
     * @return {string} convertedRule
     */
    const convertCssInjection = (rule, excluded) => {
        if (rule.includes(':style')) {
            let parts, result;
            if (rule.includes(RuleMasks.MASK_CSS_EXTENDED_CSS_RULE)) {
                parts = rule.split(RuleMasks.MASK_CSS_EXTENDED_CSS_RULE, 2);
                result = executeConversion(rule, parts, RuleMasks.MASK_CSS_INJECT_EXTENDED_CSS_RULE, excluded);
            } else if (rule.includes(RuleMasks.MASK_CSS_EXCEPTION_EXTENDED_CSS_RULE)) {
                parts = rule.split(RuleMasks.MASK_CSS_EXCEPTION_EXTENDED_CSS_RULE, 2);
                result = executeConversion(rule, parts, RuleMasks.MASK_CSS_EXCEPTION_INJECT_EXTENDED_CSS_RULE, excluded);
            } else if (rule.includes(RuleMasks.MASK_ELEMENT_HIDING)) {
                parts = rule.split(RuleMasks.MASK_ELEMENT_HIDING, 2);
                result = executeConversion(rule, parts, RuleMasks.MASK_CSS, excluded);
            } else if (rule.includes(RuleMasks.MASK_ELEMENT_HIDING_EXCEPTION)) {
                parts = rule.split(RuleMasks.MASK_ELEMENT_HIDING_EXCEPTION, 2);
                result = executeConversion(rule, parts, RuleMasks.MASK_CSS_EXCEPTION, excluded);
            }
            return result;
        }
        return rule;
    };

    /**
     * Converts different types of rules
     * @param {array} rulesList
     * @param {array} excluded
     * @return {array} result
     */
    const convertRulesToAdgFormat = function (rulesList, excluded) {
        const result = [];

        for (let rule of rulesList) {
            rule = convertCssInjection(rule, excluded);
            rule = replaceOptions(rule);
            rule = convertScriptHasTextToScriptTagContent(rule);
            rule = convertToThirdParty(rule);

            const scriptletRule = convertUboAndAbpScriptletsToAdg(rule);
            if (scriptletRule) {
                result.push(...scriptletRule);
                continue;
            }

            result.push(rule);
        }

        return result;
    };

    /**
     * Convert Adguard scriptlets to UBlock syntax
     * https://github.com/AdguardTeam/FiltersCompiler/issues/56
     * @param {array} rules
     * @return {array} result - modified rules
     */
    const convertAdgScriptletsToUbo = (rules) => {
        const result = [];
        rules.forEach(rule => {
            if (rule.includes(RuleMasks.MASK_SCRIPTLET) || rule.includes(RuleMasks.MASK_SCRIPTLET_EXCEPTION)) {
                const convertedRule = scriptlets.convertAdgToUbo(rule);
                if (!convertedRule) {
                    logger.error(`Cannot convert Adguard scriptlet to Ublock: ${rule}`);
                    return rule;
                }
                logger.log(`Adguard scriptlet "${rule}" converted to Ublock: ${convertedRule}`);
                rule = convertedRule;
            }
            result.push(rule);
        });
        return result;
    };

    return {
        convertRulesToAdgFormat: convertRulesToAdgFormat,
        convertAdgScriptletsToUbo: convertAdgScriptletsToUbo
    };
})();
