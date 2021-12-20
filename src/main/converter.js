const { RuleConverter } = require('@adguard/tsurlfilter');

// const scriptlets = require('scriptlets');
const Scriptlets = require('@adguard/scriptlets');
const logger = require('./utils/log.js');
const cosmeticRuleModifiers = require('./rule/cosmetic-rule-modifiers');

const { redirects } = Scriptlets;

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
 * Converts rules to AdGuard syntax
 * @param {array} rulesList
 * @param {array} [excluded]
 * @return {array} result
 */
const convertRulesToAdgSyntax = function (rulesList, excluded) {
    const result = [];

    for (let i = 0; i < rulesList.length; i += 1) {
        const rule = rulesList[i];
        try {
            const converted = RuleConverter.convertRule(rule, { ignoreAllModifier: true });
            result.push(...converted);
            if (converted && converted[0] !== rule) {
                const message = `Rule "${rule}" converted to: "${[...converted]}"`;
                excludeRule(rule, excluded, message);
            }
        } catch (e) {
            const message = `Unable to convert rule to AdGuard syntax: ${rule}`;
            logger.log(message);
            excludeRule(rule, excluded, message);
        }
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
    rules.forEach((rule) => {
        if (rule && validateMethod(rule)) {
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
const convertAdgScriptletsToUbo = (rules) => {
    if (!rules) {
        return [];
    }
    return convertToUbo(
        rules,
        'scriptlet',
        Scriptlets.isAdgScriptletRule,
        Scriptlets.convertAdgToUbo
    );
};

/**
 * Converts AdGuard redirect rules to uBlock
 * @param {array} rules
 * @return {array} modified rules
 */
const convertAdgRedirectsToUbo = (rules) => {
    if (!rules) {
        return [];
    }
    return convertToUbo(
        rules,
        'redirect',
        // validate AdGuard redirect rules
        redirects.isValidAdgRedirectRule,
        // and skip ubo-unsupported redirects for ubo filters
        // https://github.com/AdguardTeam/AdguardFilters/issues/68028
        redirects.convertAdgRedirectToUbo
    );
};

const convertAdgPathModifierToUbo = (rules) => {
    if (!rules) {
        return [];
    }
    return convertToUbo(
        rules,
        '$path',
        cosmeticRuleModifiers.isAdgCosmeticRuleWithPathModifier,
        cosmeticRuleModifiers.convertAdgPathModifierToUbo
    );
};

module.exports = {
    convertRulesToAdgSyntax,
    convertAdgScriptletsToUbo,
    convertAdgRedirectsToUbo,
    convertAdgPathModifierToUbo,
};
