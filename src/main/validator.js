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

    /**
     * Validates list of domain with black list
     */
    let validateDomains = function (list) {
        let result = true;
        list.map((d) => {
            if (domainsBlacklist.indexOf(d) > 0) {
                logger.error(`Blacklisted domain: ${d}`);
                result = false;
            }
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
        let result = [];
        list.map((s) => {
            if (s.startsWith('!')) {
                result.push(s);
                return;
            }

            if (ruleUtils.isElementHidingRule(s)) {
                if (s.startsWith('||')) {
                    logger.error(`|| are unnecessary for element hiding rule: ${s}`);
                    return;
                }

                if (!validateCssSelector(ruleUtils.parseCssSelector(s))) {
                    logger.error(`Invalid selector: ${s}`);
                    return;
                }

                result.push(s);
            } else {
                if (s.indexOf('$$') >= 0) {
                    logger.error(`Invalid rule: ${s} - two option separators.`);
                    return;
                }

                let modifiers = ruleUtils.parseRuleModifiers(s);
                for (let name in modifiers) {
                    if (!validateOptionName(name)) {
                        logger.error(`Invalid rule options: ${s}`);
                        return;
                    }
                }

                if (modifiers.domain && !validateDomains(modifiers.domain)) {
                    logger.error(`Invalid rule domains: ${s}`);
                    return;
                }

                result.push(s);
            }
        });

        return result;
    };

    return {
        init: init,
        validate: validate
    };
})();

