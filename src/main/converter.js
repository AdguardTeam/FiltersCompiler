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
    const { redirects } = scriptlets;

    const GHIDE_REGEX = /(.+[^#]\$.*)(ghide)($|,.+)/i;
    const GENERICHIDE = 'generichide';
    const EHIDE_REGEX = /(.+[^#]\$.*)(ehide)($|,.+)/i;
    const ELEMHIDE = 'elemhide';

    /**
     * Excludes rule
     * @param {string} rule
     * @param {array} excluded
     * @param {string} message
     */
    const excludeRule = (rule, excluded, message) => {
        if (excluded) {
            excluded.push(`! ${message}`);
            excluded.push(rule);
        }
    };

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
                    excludeRule(rule, excluded, message);
                }
            }
        }

        return result;
    };


    /**
     * Converts CSS injection
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
     * Replaces the following options:
     * $first-party -> $~third-party
     * $xhr -> $xmlhttprequest
     * $css -> $stylesheet
     * $frame -> $subdocument
     * $1p -> $~third-party
     * $3p -> $third-party
     * ghide -> generichide
     * ehide -> elemhide
     *
     * @param {string} rule
     * @return {string} convertedRule
     */
    const replaceOptions = (rule) => {
        if (!rule.startsWith(RuleMasks.MASK_COMMENT) &&
            (FIRST_PARTY_REGEX.test(rule) ||
            XHR_REGEX.test(rule) ||
            CSS_REGEX.test(rule) ||
            FRAME_REGEX.test(rule) ||
            THIRD_PARTY_1P_3P_REGEX.test(rule) ||
            GHIDE_REGEX.test(rule) ||
            EHIDE_REGEX.test(rule))) {
            const result = rule
                .replace(FIRST_PARTY_REGEX, FIRST_PARTY_REPLACEMENT)
                .replace(XHR_REGEX, XHR_REPLACEMENT)
                .replace(CSS_REGEX, CSS_REPLACEMENT)
                .replace(FRAME_REGEX, FRAME_REPLACEMENT)
                .replace(THIRD_PARTY_1P, THIRD_PARTY_1P_REPLACEMENT)
                .replace(THIRD_PARTY_3P, THIRD_PARTY_3P_REPLACEMENT)
                .replace(GHIDE_REGEX, `$1${GENERICHIDE}$3`)
                .replace(EHIDE_REGEX, `$1${ELEMHIDE}$3`);
            logger.log(`Rule "${rule}" converted to: ${result}`);
            return result;
        }
        return rule;
    };

    /**
     * Converts ##^script:has-text and ##^script:contains to $$script[tag-content="..."][max-length="262144"]
     * @param {string} rule
     * @return {string} convertedRule
     */
    const convertScriptHasTextToScriptTagContent = (rule) => {
        if (!rule.startsWith(RuleMasks.MASK_COMMENT) && SCRIPT_HAS_TEXT_REGEX.test(rule)) {
            const result = rule.replace(SCRIPT_HAS_TEXT_REGEX, SCRIPT_HAS_TEXT_REPLACEMENT).slice(0, -1) + '"][max-length="262144"]';
            logger.log(`Rule "${rule}" converted to: ${result}`);
            return result;
        }
        return rule;
    };

    /**
     * Converts UBO and ABP redirect rules to AdGuard redirect rules
     * @param {string} rule
     * @param {array} excluded
     * @return {string} convertedRule
     */
    const convertUboAndAbpRedirectsToAdg = (rule, excluded) => {
        if (!rule.startsWith(RuleMasks.MASK_COMMENT) &&
            (redirects.isValidUboRedirectRule(rule) || redirects.isValidAbpRedirectRule(rule))) {
            const result = redirects.convertRedirectToAdg(rule);
            if (!result) {
                const message = `Unable to convert redirect rule to AdGuard syntax: ${rule}`;
                logger.error(message);
                excludeRule(rule, excluded, message);
            } else {
                logger.log(`Rule "${rule}" converted to: ${result}`);
                return result;
            }
        }
        return rule;
    };

    /**
     * Converts UBO and ABP scriptlets to AdGuard scriptlets
     * @param {string} rule
     * @param {array} excluded
     * @return {string|array|undefined} convertedRule
     */
    const convertUboAndAbpScriptletsToAdg = (rule, excluded) => {
        if (!rule.startsWith(RuleMasks.MASK_COMMENT) &&
            (scriptlets.isUboScriptletRule(rule) || scriptlets.isAbpSnippetRule(rule))) {
            const result = scriptlets.convertScriptletToAdg(rule);
            if (!result) {
                const message = `Unable to convert scriptlet to AdGuard syntax: ${rule}`;
                logger.error(message);
                excludeRule(rule, excluded, message);
            } else {
                logger.log(`Rule "${rule}" converted to: ${result}`);
                return result;
            }
        }
        return rule;
    };

    /**
     * Converts rules to AdGuard syntax
     * @param {array} rulesList
     * @param {array} excluded
     * @return {array} result
     */
    const convertRulesToAdgSyntax = function (rulesList, excluded) {
        let result = [];

        for (let rule of rulesList) {
            rule = convertCssInjection(rule, excluded);
            rule = replaceOptions(rule);
            rule = convertScriptHasTextToScriptTagContent(rule);
            rule = convertUboAndAbpRedirectsToAdg(rule, excluded);

            const scriptletRule = convertUboAndAbpScriptletsToAdg(rule, excluded);
            if (scriptletRule) {
                if (scriptletRule instanceof Array) {
                    result.push(...scriptletRule);
                    continue;
                } else {
                    result.push(scriptletRule);
                    continue;
                }
            }

            result.push(rule);
        }

        return result;
    };

    /**
     * Converts AdGuard rules to uBlock syntax
     * @param {array} rules
     * @param {string} ruleType
     * @param {function} validateMethod
     * @param {function} convertMethod
     * @return {array} modified rules
     */
    const convertToUbo = (rules, ruleType, validateMethod, convertMethod) => {
            const modified = [];
            rules.map(rule => {
                if (validateMethod(rule)) {
                    try {
                        const convertedRule = convertMethod(rule);
                        logger.log(`AdGuard ${ruleType} ${rule} converted to uBlock: ${convertedRule}`);
                        modified.push(convertedRule);
                    } catch (error) {
                        logger.error(`Cannot convert AdGuard ${ruleType} to uBlock: ${rule}\n${error}`);
                    }
                } else {
                    modified.push(rule);
                }

            });
            return modified;
    };

    /**
     * Convert AdGuard scriptlets to uBlock
     * @param {array} rules
     * @return {array} modified rules
     */
    const convertAdgScriptletsToUbo = (rules) => convertToUbo(
        rules,
        'scriptlet',
        scriptlets.isAdgScriptletRule,
        scriptlets.convertAdgToUbo
    );

    /**
     * Converts AdGuard redirect rules to uBlock
     * @param {array} rules
     * @return {array} modified rules
     */
    const convertAdgRedirectsToUbo = (rules) => convertToUbo(
        rules,
        'redirect',
        redirects.isValidAdgRedirectRule,
        redirects.convertAdgRedirectToUbo
    );


    return {
        convertRulesToAdgSyntax: convertRulesToAdgSyntax,
        convertAdgScriptletsToUbo: convertAdgScriptletsToUbo,
        convertAdgRedirectsToUbo: convertAdgRedirectsToUbo
    };
})();
