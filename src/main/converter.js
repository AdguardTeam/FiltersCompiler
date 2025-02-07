import { RuleConverter, RuleParser, RuleGenerator } from '@adguard/agtree';
import { isValidAdgRedirectRule, isAdgScriptletRule } from '@adguard/scriptlets/validators';
import { convertAdgRedirectToUbo, convertAdgToUbo } from '@adguard/scriptlets/converters';

import { logger } from './utils/log';
import { isAdgCosmeticRuleWithPathModifier, isAdgCosmeticRuleWithPathModifier } from './rule/cosmetic-rule-modifiers';

/**
 * Excludes rule
 * @param {string} rule
 * @param {array} excluded
 * @param {string} message
 */
export const excludeRule = (rule, excluded, message) => {
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
export const convertRulesToAdgSyntax = (rulesList, excluded) => {
    const result = [];

    for (let i = 0; i < rulesList.length; i += 1) {
        const rule = rulesList[i];
        try {
            const ruleNode = RuleParser.parse(rule);
            const conversionResult = RuleConverter.convertToAdg(ruleNode);
            // FIXME: RuleParser.generate - undefined
            const convertedRules = conversionResult.result.map((r) => RuleGenerator.generate(r));
            result.push(...convertedRules);

            if (conversionResult.isConverted) {
                const message = `Rule "${rule}" converted to: "${[...convertedRules]}"`;
                excludeRule(rule, excluded, message);
            }
        } catch (e) {
            const message = `Unable to convert rule to AdGuard syntax: "${rule}" due to error: ${e.message}`;
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
export const convertToUbo = (rules, ruleType, validateMethod, convertMethod) => {
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
export const convertAdgScriptletsToUbo = (rules) => {
    if (!rules) {
        return [];
    }
    return convertToUbo(
        rules,
        'scriptlet',
        isAdgScriptletRule,
        convertAdgToUbo,
    );
};

/**
 * Converts AdGuard redirect rules to uBlock
 * @param {array} rules
 * @return {array} modified rules
 */
export const convertAdgRedirectsToUbo = (rules) => {
    if (!rules) {
        return [];
    }
    return convertToUbo(
        rules,
        'redirect',
        // validate AdGuard redirect rules
        isValidAdgRedirectRule,
        // and skip ubo-unsupported redirects for ubo filters
        // https://github.com/AdguardTeam/AdguardFilters/issues/68028
        convertAdgRedirectToUbo,
    );
};

export const convertAdgPathModifierToUbo = (rules) => {
    if (!rules) {
        return [];
    }
    return convertToUbo(
        rules,
        '$path',
        isAdgCosmeticRuleWithPathModifier,
        convertAdgPathModifierToUbo,
    );
};

export default { convertRulesToAdgSyntax, convertAdgPathModifierToUbo, convertAdgRedirectsToUbo, convertAdgScriptletsToUbo };