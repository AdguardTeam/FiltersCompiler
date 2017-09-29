/* globals module, console */

module.exports = (function () {

    'use strict';

    var CSS_RULE_MARK = "##";
    var CSS_RULE_NEW_MARK = "#$#";
    var EXCEPTION_RULE_MARK = "#@#";
    var EXCEPTION_RULE_NEW_MARK = "#@$#";
    var CSS_RULE_REPLACE_PATTERN = /(.*):style\((.*)\)/g;

    /**
     * Executes rule css conversion
     *
     * @param rule
     * @param parts
     * @param ruleMark
     */
    var executeConversion = function (rule, parts, ruleMark) {
        var result = rule;
        var domain = parts[0];

        if (domain) {
            var rulePart = parts[1];
            var match = rulePart.match(CSS_RULE_REPLACE_PATTERN);
            if (match) {
                var groups = CSS_RULE_REPLACE_PATTERN.exec(rulePart);
                if (groups.length !== 3) {
                    console.warn("Cannot convert {}", rule);
                } else {
                    result = domain + ruleMark;
                    result += groups[1] + " { " + groups[2] + " }";
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
    var convert = function (rulesList) {
        var result = [];

        for (var i = 0; i < rulesList.length; i++) {
            var rule = rulesList[i].trim();

            if (rule.indexOf(':style') >= 0) {
                var parts;
                if (rule.indexOf(CSS_RULE_MARK) >= 0 && rule.indexOf("###") < 0) {
                    parts = rule.split(CSS_RULE_MARK, 2);
                    rule = executeConversion(rule, parts, CSS_RULE_NEW_MARK);
                } else if (rule.indexOf(EXCEPTION_RULE_MARK) >= 0) {
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