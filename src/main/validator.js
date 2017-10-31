/* globals module, require, console */

module.exports = (function () {

    'use strict';

    /**
     * @typedef {Object} fs
     * @property {function} readFileSync
     */
    let fs = require('fs');
    let CssSelectorParser = require('css-selector-parser').CssSelectorParser;

    let logger = require("./utils/log.js");
    let ruleUtils = require("./utils/rule-utils.js");

    //TODO: Add more options
    const VALID_OPTIONS = ['domain', '~domain','important', '~important', 'empty', '~empty',
        'script', '~script', 'third-party', '~third-party', 'xmlhttprequest', '~xmlhttprequest'];

    let domainsBlacklist = [];
    let cssParser;

    /**
     * Initializes validator
     *
     * @param domainBlacklistFile
     */
    let init = function (domainBlacklistFile) {
        try {
            let s = fs.readFileSync(domainBlacklistFile, {encoding: 'utf-8'});
            domainsBlacklist = s.split('\n');
        } catch (e) {
            domainsBlacklist = [];
        }

        cssParser = new CssSelectorParser();

        cssParser.registerSelectorPseudos('has');
        cssParser.registerNestingOperators('>', '+', '~');
        cssParser.registerAttrEqualityMods('^', '$', '*', '~');
        cssParser.enableSubstitutes();
    };

    /**
     * Validates css rule selector
     *
     * @param selector
     */
    let validateCssSelector = function (selector) {

        try {
            cssParser.parse(selector);
            return true;
        } catch (e) {
            return false;
        }
    };

    let validateDomains = function (domains) {
        return domains.filter((d) => {
            if (domainsBlacklist.indexOf(d) >= 0) {
                logger.error(`Blacklisted domain: ${d}`);
                return false;
            }

            return true;
        });
    };

    /**
     * Validates list of rules with black list of domains
     * returns modified list of rules without blacklisted domain options
     */
    let blacklistDomains = function (list) {
        let result = [];

        list.forEach((rule) => {
            let corrected = rule;

            //TODO: if rule is url blocking rule
            if (!rule.startsWith('!') && !ruleUtils.isElementHidingRule(rule) && rule.indexOf('$$') < 0) {
                let modifiers = ruleUtils.parseUrlRuleModifiers(rule);
                if (modifiers.domain) {
                    let validated = validateDomains(modifiers.domain);
                    if (validated.length === 0) {
                        logger.error(`All domains are blacklisted for rule: ${rule}`);
                        return;
                    }

                    modifiers.domain = validated;
                    //TODO: Parse in parser
                    let url = rule.substring(0, rule.indexOf('$'));

                    //TODO: construct in separate module
                    let options = [];
                    for (let m in modifiers) {
                        if (modifiers[m] && modifiers[m].length > 0 ) {
                            options.push(`${m}=${modifiers[m].join('|')}`);
                        } else {
                            options.push(m);
                        }
                    }

                    corrected = `${url}$${options.join(',')}`;
                }
            }

            result.push(corrected);
        });

        return result;
    };

    /**
     * Validates option name
     *
     * @param option
     * @returns {boolean}
     */
    let validateOptionName = function (option) {
        option = option.trim();
        return VALID_OPTIONS.indexOf(option) >= 0 || VALID_OPTIONS.indexOf('~' + option) >= 0;
    };

    /**
     * Validates list of rules
     *
     * @param list
     * @returns {Array}
     */
    let validate = function (list) {
        return list.filter((s) => {
            if (s.startsWith('!')) {
                return true;
            }

            if (ruleUtils.isElementHidingRule(s)) {
                if (s.startsWith('||')) {
                    logger.error(`|| are unnecessary for element hiding rule: ${s}`);
                    return false;
                }

                if (!validateCssSelector(ruleUtils.parseCssSelector(s))) {
                    logger.error(`Invalid selector: ${s}`);
                    return false;
                }

                return true;
            } else {
                // TODO: Fix for content-rules
                // example.org$$script[data-src="banner"]
                if (s.includes('$$')) {
                    logger.error(`Invalid rule: ${s} - two option separators.`);
                    return false;
                }

                let modifiers = ruleUtils.parseUrlRuleModifiers(s);
                for (let name in modifiers) {
                    if (!validateOptionName(name)) {
                        logger.error(`Invalid rule options: ${s}`);
                        return false;
                    }
                }

                return true;
            }
        });
    };

    return {
        init: init,
        validate: validate,
        blacklistDomains: blacklistDomains
    };
})();

