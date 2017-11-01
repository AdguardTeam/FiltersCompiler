/* globals require */

module.exports = (() => {

    'use strict';

    const logger = require("./utils/log.js");

    const CSS_RULE_MARK = "##";
    const CSS_RULE_NEW_MARK = "#$#";
    const EXCEPTION_RULE_MARK = "#@#";
    const EXCEPTION_RULE_NEW_MARK = "#@$#";
    const CSS_RULE_REPLACE_PATTERN = /(.*):style\((.*)\)/g;

    /**
     * Executes rule css conversion
     *
     * @param rule
     * @param parts
     * @param ruleMark
     */
    const executeConversion = function (rule, parts, ruleMark) {
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

                    logger.log(`Rule "${rule}" converted`);
                }
            }
        }

        return result;
    };

    /**
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
     */
    const convert = function (rulesList) {
        const result = [];

        for (let rule of rulesList) {
            if (rule.includes(':style')) {
                let parts;
                if (rule.includes(CSS_RULE_MARK) && !rule.includes("###")) {
                    parts = rule.split(CSS_RULE_MARK, 2);
                    rule = executeConversion(rule, parts, CSS_RULE_NEW_MARK);
                } else if (rule.includes(EXCEPTION_RULE_MARK)) {
                    parts = rule.split(EXCEPTION_RULE_MARK, 2);
                    rule = executeConversion(rule, parts, EXCEPTION_RULE_NEW_MARK);
                }
            }

            result.push(rule);
        }

        return result;
    };

    return {
        convert: convert
    };
})();