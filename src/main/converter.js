/* globals require */

module.exports = (() => {
    'use strict';

    const logger = require("./utils/log.js");
    const RuleMasks = require('./rule/rule-masks.js');

    const CSS_RULE_REPLACE_PATTERN = /(.*):style\((.*)\)/g;

    const FIRST_PARTY_REGEX = /([\$,])first-party/i;
    const FIRST_PARTY_REPLACEMENT = `$1~third-party`;

    const XHR_REGEX = /([\$,])xhr/i;
    const XHR_REPLACEMENT = `$1xmlhttprequest`;

    const CSS_REGEX = /([\$,])css/i;
    const CSS_REPLACEMENT = `$1stylesheet`;

    const FRAME_REGEX = /([\$,])frame/i;
    const FRAME_REPLACEMENT = `$1subdocument`;

    const SCRIPT_HAS_TEXT_REGEX = /(##\^script\:(has\-text|contains))\((?!\/.+\/\))/i;
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
     * Function to which converts rules with different markers
     *
     * First-party conversion:
     * $first-party -> $~third-party
     * ,first-party -> ,~third-party
     *
     * options conversion:
     * $xhr -> $xmlhttprequest
     * ,xhr -> ,xmlhttprequest
     * $css -> $stylesheet
     * ,css -> ,stylesheet
     * $frame -> $subdocument
     * ,frame -> ,subdocument
     *
     * CSS injection conversion:
     * example.com##h1:style(background-color: blue !important)
     * into
     * example.com#$#h1 { background-color: blue !important }
     * <p>
     * OR (for exceptions):
     * example.com#@#h1:style(background-color: blue !important)
     * into
     * example.com#@$#h1 { background-color: blue !important }
     *
     * @param rulesList Array of rules
     * @param excluded
     */
    const convert = function (rulesList, excluded) {
        const result = [];

        for (let rule of rulesList) {
            if (rule.includes(':style')) {
                let parts;
                if (rule.includes(RuleMasks.MASK_CSS_EXTENDED_CSS_RULE)) {
                    parts = rule.split(RuleMasks.MASK_CSS_EXTENDED_CSS_RULE, 2);
                    rule = executeConversion(rule, parts, RuleMasks.MASK_CSS_INJECT_EXTENDED_CSS_RULE, excluded);
                } else if (rule.includes(RuleMasks.MASK_CSS_EXCEPTION_EXTENDED_CSS_RULE)) {
                    parts = rule.split(RuleMasks.MASK_CSS_EXCEPTION_EXTENDED_CSS_RULE, 2);
                    rule = executeConversion(rule, parts, RuleMasks.MASK_CSS_EXCEPTION_INJECT_EXTENDED_CSS_RULE, excluded);
                } else if (rule.includes(RuleMasks.MASK_ELEMENT_HIDING)) {
                    parts = rule.split(RuleMasks.MASK_ELEMENT_HIDING, 2);
                    rule = executeConversion(rule, parts, RuleMasks.MASK_CSS, excluded);
                } else if (rule.includes(RuleMasks.MASK_ELEMENT_HIDING_EXCEPTION)) {
                    parts = rule.split(RuleMasks.MASK_ELEMENT_HIDING_EXCEPTION, 2);
                    rule = executeConversion(rule, parts, RuleMasks.MASK_CSS_EXCEPTION, excluded);
                }
            }

            // Some options will be replaced
            if (FIRST_PARTY_REGEX.test(rule) ||
                XHR_REGEX.test(rule) ||
                CSS_REGEX.test(rule) ||
                FRAME_REGEX.test(rule)) {
                let replacedRule = rule.replace(FIRST_PARTY_REGEX, FIRST_PARTY_REPLACEMENT)
                    .replace(XHR_REGEX, XHR_REPLACEMENT)
                    .replace(CSS_REGEX, CSS_REPLACEMENT)
                    .replace(FRAME_REGEX, FRAME_REPLACEMENT);
                let message = `Rule "${rule}" converted to: ${replacedRule}`;
                logger.log(message);
                rule = replacedRule;
            }

            // Convert UBO and ABP scriptlets to AdGuard scriptlets
            if (!rule.startsWith(RuleMasks.MASK_COMMENT) && (scriptlets.isUboScriptletRule(rule) || scriptlets.isAbpSnippetRule(rule))) {
                const convertedRule = scriptlets.convertScriptletToAdg(rule);
                if (!convertedRule) {
                    logger.error(`Unable to convert scriptlet to Adguard syntax: "${rule}" `);
                    rule = `! Inconvertible scriptlet: ${rule}`;
                } else {
                    logger.log(`Rule "${rule}" converted to: ${convertedRule}`);
                    rule = convertedRule.join("\n");
                    continue;
                }
            }

            // Convert ##^script:has-text and ##^script:contains to $$script[tag-content="..."][max-length="262144"]
            if (SCRIPT_HAS_TEXT_REGEX.test(rule)) {
                const replacedRule = rule.replace(SCRIPT_HAS_TEXT_REGEX, SCRIPT_HAS_TEXT_REPLACEMENT).slice(0, -1) + '"]';
                const message = `Rule "${rule}" converted to: ${replacedRule}`;
                logger.log(message);
                rule = `${replacedRule}[max-length="262144"]`;
            }

            // Convert $1p to $~third-party and $3p to $third-party
            if (THIRD_PARTY_1P_3P_REGEX.test(rule)) {
                const replacedRule = rule.replace(THIRD_PARTY_1P, THIRD_PARTY_1P_REPLACEMENT)
                    .replace(THIRD_PARTY_3P, THIRD_PARTY_3P_REPLACEMENT);
                const message = `Rule "${rule}" converted to: ${replacedRule}`;
                logger.log(message);
                rule = replacedRule;
            }
            result.push(rule);
        }

        return result;
    };

    /**
     * Convert Adguard scriptlets to UBlock syntax
     * https://github.com/AdguardTeam/FiltersCompiler/issues/56
     * @param {array} rules
     * @return {array} modified rules
     */
    const convertAdgScriptletsToUbo = (rules) => {
        const modified = [];
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
            modified.push(rule);
        });
        return modified;
    };

    return {
        convert: convert,
        convertAdgScriptletsToUbo: convertAdgScriptletsToUbo
    };
})();
