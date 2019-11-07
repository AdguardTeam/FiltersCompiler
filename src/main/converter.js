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
                let message = `Rule "${rule}" converted to: ${result}`;
                logger.log(message);
                rule = replacedRule;
            }

            result.push(rule);
        }

        return result;
    };

    const scriptletsCompatibility = {
        // AG: uBO
        'abort-current-inline-script': 'abort-current-inline-script.js',
        'abort-on-property-read': 'abort-on-property-read.js',
        'abort-on-property-write': 'abort-on-property-write.js',
        'adjust-setInterval': 'nano-setInterval-booster.js',
        'adjust-setTimeout': 'nano-setTimeout-booster.js',
        'disable-newtab-links': 'disable-newtab-links.js',
        'json-prune': 'json-prune.js',
        'json-prune-new': 'json-prune.js',
        'log-addEventListener': 'addEventListener-logger.js',
        'nowebrtc': 'nowebrtc.js',
        'prevent-addEventListener': 'addEventListener-defuser.js',
        'prevent-adfly': 'adfly-defuser.js',
        'prevent-eval-if': 'noeval-if.js',
        'prevent-setInterval': 'setInterval-defuser.js',
        'prevent-setTimeout': 'setTimeout-defuser.js',
        'remove-attr': 'remove-attr.js',
        'remove-cookie': 'cookie-remover.js',
        'set-constant': 'set-constant.js',
    };

    const parseScriptlet = (scriptlet) => {
        const regex = /(.+)#%#\/\/scriptlet\((.+?)(,.+?)?(,.+?)?\)/g;
        const elms = regex.exec(scriptlet);

        const domains = elms[1];
        const scriptletName = elms[2].replace(/'|"/g, '');
        const firstArgument = elms[3] ? elms[3].replace(/, '|, "/g, ', ').slice(0, -1) : '';
        const secondArgument = elms[4] ? elms[4].replace(/, '|, "/g, ', ').slice(0, -1) : '';
        
        return {
            domains: domains,
            scriptletName: scriptletName,
            firstArgument: firstArgument,
            secondArgument: secondArgument
        };
    };

    /**
     * Convert Adguard scriptlets to UBlock syntax
     * https://github.com/AdguardTeam/FiltersCompiler/issues/56
     */
    const convertScriptletToUblockSyntax = (ruleText) => {
        const { domains, scriptletName, firstArgument, secondArgument} = parseScriptlet(ruleText);
        if (scriptletsCompatibility[scriptletName]) {
            return `${domains}##script:inject(${scriptletsCompatibility[scriptletName]}${firstArgument}${secondArgument})`
        }
        logger.warn(`Cannot convert scriptlet ${ruleText} to UBlock syntax`);
        return '';
    };

    return {
        convert: convert,
        convertScriptletToUblockSyntax: convertScriptletToUblockSyntax
    };
})();
