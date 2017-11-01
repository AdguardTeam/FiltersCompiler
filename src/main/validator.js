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
    let ruleParser = require("./rule/rule-parser.js");
    let RuleTypes = require("./rule/rule-types.js");

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

        list.forEach((line) => {
            let corrected = line;
            let rule = ruleParser.parseRule(line);

            if (rule.ruleType === RuleTypes.UrlBlocking) {
                let modifiers = rule.modifiers;
                if (modifiers.domain) {
                    let validated = validateDomains(modifiers.domain);
                    if (validated.length === 0) {
                        logger.error(`All domains are blacklisted for rule: ${line}`);
                        return;
                    }

                    modifiers.domain = validated;

                    corrected = rule.buildNewModifiers(modifiers);
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
            let rule = ruleParser.parseRule(s);

            if (rule.ruleType === RuleTypes.Comment) {
                return true;
            } else if (rule.ruleType === RuleTypes.ElementHiding) {
                if (s.startsWith('||')) {
                    logger.error(`|| are unnecessary for element hiding rule: ${s}`);
                    return false;
                }

                if (!validateCssSelector(rule.cssSelector)) {
                    logger.error(`Invalid selector: ${s}`);
                    return false;
                }
            } else if (rule.ruleType === RuleTypes.UrlBlocking) {
                // TODO: There is no way to separate content rules from incorrect $$ options separator
                if (s.includes('$$')) {
                    logger.error(`Invalid rule: ${s} - two option separators.`);
                    return false;
                }

                let modifiers = rule.modifiers;
                for (let name in modifiers) {
                    if (!validateOptionName(name)) {
                        logger.error(`Invalid rule options: ${s}`);
                        return false;
                    }
                }
            }

            return true;
        });
    };

    return {
        init: init,
        validate: validate,
        blacklistDomains: blacklistDomains
    };
})();

