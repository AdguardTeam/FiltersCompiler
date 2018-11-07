/* globals require */

module.exports = (() => {

    'use strict';

    const logger = require("./utils/log.js");
    const RuleMasks = require('./rule/rule-masks.js');

    const CSS_RULE_REPLACE_PATTERN = /(.*):style\((.*)\)/g;

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
        const firstPartyRegex = /([\$,])first-party/i;
        const firstPartyReplacement = `$1~third-party`;

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

            // If rule includes first-party option, than we replace it
            if (firstPartyRegex.test(rule)) {
                let replacedRule = rule.replace(firstPartyRegex, firstPartyReplacement);
                let message = `Rule "${rule}" converted to: ${result}`;
                logger.log(message);
                rule = replacedRule;
            }

            result.push(rule);
        }

        return result;
    };

    return {
        convert: convert
    };
})();
