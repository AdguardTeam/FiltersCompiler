/* globals module, require, console, global */

module.exports = (function () {

    'use strict';

    /**
     * @typedef {Object} fs
     * @property {function} readFileSync
     */
    const fs = require('fs');

    const logger = require("./utils/log.js");
    const ruleParser = require("./rule/rule-parser.js");
    const RuleTypes = require("./rule/rule-types.js");
    const RuleMasks = require("./rule/rule-masks.js");
    const Rule = require("./rule/rule.js");
    const extendedCssValidator = require('./utils/extended-css-validator.js');
    const scriptlets = require('scriptlets');
    const { redirects } = scriptlets;
    const REDIRECT_RULE_REGEXP = /\$(.*,)?redirect=/;

    const VALID_OPTIONS = [
        // Basic modifiers
        'domain', '~domain',
        'third-party', '~third-party',
        'popup', '~popup',
        'match-case', '~match-case',
        // Special behaviour modifiers
        'csp',
        'webrtc',
        'websocket', '~websocket',
        // Content type modifiers
        'image', '~image',
        'stylesheet', '~stylesheet',
        'script', '~script',
        'object', '~object',
        'object-subrequest', '~object-subrequest',
        'font', '~font',
        'media', '~media',
        'subdocument', '~subdocument',
        'xmlhttprequest', '~xmlhttprequest',
        'other', '~other',
        'all', '~all',
        // Exception rules modifiers
        'elemhide',
        'content',
        'jsinject',
        'urlblock',
        'document', '~document',
        'stealth',
        'cookie',
        'generichide',
        'genericblock',
        'important',
        'empty',
        'mp4',
        'extension', '~extension',
        'network',
        'replace',
        'protobuf',
        'collapse', '~collapse',
        'app',
        'badfilter',
        // uBlock extension has redirect options
        // https://github.com/AdguardTeam/FiltersCompiler/issues/23
        'redirect',
        // https://github.com/AdguardTeam/FiltersCompiler/issues/53
        'rewrite',
    ];

    /**
     * Push rule with warning message to excluded
     * @param {array} excluded
     * @param {string} warning
     * @param {string} rule
     */
    const excludeRule = (excluded, warning, rule) => {
        if (excluded) {
            excluded.push(warning);
            excluded.push(rule);
        }
    };

    let domainsBlacklist = [];

    /**
     * Initializes validator
     *
     * @param domainBlacklistFile
     */
    const init = function (domainBlacklistFile) {
        try {
            let s = fs.readFileSync(domainBlacklistFile, {encoding: 'utf-8'});
            if (s) {
                domainsBlacklist = s.split('\n');
            } else {
                domainsBlacklist = [];
            }
        } catch (e) {
            domainsBlacklist = [];
        }
    };

    /**
     * Filters blacklisted domains
     *
     * @param domains
     * @param rule
     * @param excluded
     * @returns boolean
     */
    const removeBlacklistedDomains = function (domains, rule, excluded) {
        if (domainsBlacklist.length === 0) {
            return domains;
        }

        return domains.filter((d) => {
            if (domainsBlacklist.indexOf(d) >= 0) {
                logger.error(`Blacklisted domain: ${d}`);
                excludeRule(excluded,`! ${d} is blacklisted: `, rule);
                return false;
            }

            return true;
        });
    };

    /**
     * Validates list of rules with black list of domains
     * returns modified list of rules without blacklisted domain options
     */
    const blacklistDomains = function (list, excluded) {
        const result = [];

        list.forEach((line) => {
            let corrected = line;
            const rule = ruleParser.parseRule(line);

            if (rule.ruleType === RuleTypes.UrlBlocking) {
                let modifiers = rule.modifiers;
                if (modifiers.domain) {
                    const validated = removeBlacklistedDomains(modifiers.domain, line, excluded);
                    if (validated.length === 0) {
                        logger.error(`All domains are blacklisted for rule: ${line}`);
                        excludeRule(excluded,'! All domains are blacklisted for rule:', line);
                        return;
                    }

                    modifiers.domain = validated;

                    corrected = rule.buildNewModifiers(modifiers);
                    if (rule.whiteList) {
                        corrected = RuleMasks.MASK_WHITE_LIST + corrected;
                    }
                }
            } else if (rule.ruleType === RuleTypes.ElementHiding || rule.ruleType === RuleTypes.Css ||
                rule.ruleType === RuleTypes.Content || rule.ruleType === RuleTypes.Script) {

                if (rule.domains) {
                    const validated = removeBlacklistedDomains(rule.domains, line, excluded);
                    if (validated.length === 0) {
                        logger.error(`All domains are blacklisted for rule: ${line}`);
                        excludeRule(excluded,'! All domains are blacklisted for rule:', line);
                        return;
                    }

                    corrected = Rule.buildNewLeadingDomainsRuleText(rule.contentPart, validated, rule.mask);
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
    const validateOptionName = function (option) {
        option = option.trim();
        return VALID_OPTIONS.indexOf(option) >= 0;
    };

    /**
     * Validates list of rules
     *
     * @param list
     * @param excluded
     * @returns {Array}
     */
    const validate = function (list, excluded) {

        return list.filter((s) => {
            const rule = ruleParser.parseRule(s);

            if (!rule.ruleText.startsWith(RuleMasks.MASK_COMMENT) && rule.ruleText.length <= 3) {
                logger.error(`Invalid rule: ${rule.ruleText} The rule is too short.`);
                excludeRule(excluded,'! The rule is too short:', rule.ruleText);
                return false;
            }

            if (rule.ruleType === RuleTypes.Comment) {
                return true;
            } else if (rule.ruleType === RuleTypes.ElementHiding) {
                if (s.startsWith('||')) {
                    logger.error(`|| are unnecessary for element hiding rule: ${s}`);
                    excludeRule(excluded,'! || are unnecessary for element hiding rule:', rule.ruleText);
                    return false;
                }

                if (!extendedCssValidator.validateCssSelector(rule.contentPart)) {
                    logger.error(`Invalid selector: ${s}`);
                    excludeRule(excluded,'! Invalid selector:', rule.ruleText);
                    return false;
                }

            } else if (rule.ruleType === RuleTypes.UrlBlocking) {
                // TODO: There is no way to separate content rules from incorrect $$ options separator
                // if (s.includes('$$')) {
                //     logger.error(`Invalid rule: ${s} - two option separators.`);
                //     return false;
                // }

                let modifiers = rule.modifiers;

                // 'rewrite' modifier should be used only with 'abp-resource:' value
                const validateRewriteOption = (name) => {
                    if (name !== 'rewrite') {
                        return true;
                    }
                    const modifierOptions = modifiers[name];
                    if (!modifierOptions || modifierOptions.length === 0) {
                        return false;
                    }
                    return modifierOptions[0].startsWith('abp-resource:');
                };

                for (let name in modifiers) {
                    if (!validateOptionName(name) || !validateRewriteOption(name)) {
                        logger.error(`Invalid rule: ${s} option: ${name}`);
                        excludeRule(excluded,'! Invalid rule options:', rule.ruleText);
                        return false;
                    }

                    if (name === 'domain' || name === '~domain') {
                        if (rule.modifiers[name].filter(x => x === '').length > 0) {
                            logger.error(`Invalid rule: ${s} incorrect option value: ${rule.modifiers[name]}`);
                            excludeRule(excluded,'! Invalid rule options:', rule.ruleText);
                            return false;
                        }
                    }
                }
            } else if (rule.ruleType === RuleTypes.Css) {
                if (rule.contentPart &&
                    rule.contentPart.toLowerCase().indexOf('url(') >= 0 ||
                    rule.contentPart.indexOf('\\') >= 0) {
                    logger.error(`Invalid rule: ${s} incorrect style: ${rule.contentPart}`);
                    excludeRule(excluded,'! Incorrect style:', rule.ruleText);
                    return false;
                }
            }
            // Scriptlets validation
            if (scriptlets.isAdgScriptletRule(rule.ruleText)) {
                try {
                    const validateScriptlet = scriptlets.isValidScriptletRule(rule.ruleText);
                    if (!validateScriptlet) {
                        excludeRule(excluded,'! Invalid scriptlet:', rule.ruleText);
                        return false;
                    }
                } catch (error) {
                    excludeRule(excluded,'! Invalid scriptlet:', rule.ruleText);
                    logger.error(`Invalid scriptlet: ${rule.ruleText}. Error: ${error.message}`);
                    return false;
                }
            }

            // Redirect rules validation
            if (redirects.isAdgRedirectRule(rule.ruleText)) {
                try {
                    const validateRedirect = redirects.isValidAdgRedirectRule(rule.ruleText);
                    if (!validateRedirect) {
                        excludeRule(excluded,'! Invalid redirect rule:', rule.ruleText);
                        return false;
                    }
                } catch (error) {
                    excludeRule(excluded,'! Invalid redirect rule:', rule.ruleText);
                    logger.error(`Invalid redirect rule: ${rule.ruleText}. Error: ${error.message}`);
                    return false;
                }
            }

            //TODO: Check js rules validation

            return true;
        });
    };

    return {
        init: init,
        validate: validate,
        blacklistDomains: blacklistDomains
    };
})();

