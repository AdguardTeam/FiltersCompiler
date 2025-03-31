import { RuleConverter, RuleParser, RuleGenerator } from '@adguard/agtree';

import { logger } from './utils/log';

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
 * Converts a list of rules into uBO (uBlock Origin) syntax.
 *
 * @param {string[]} rules - An array of rules to be converted.
 * @returns {string[]} An array of converted rules in uBO syntax. If no rules are provided, an empty array is returned.
 *
 * @throws {Error} Logs an error message if a rule cannot be converted due to a parsing or conversion issue.
 */
export const convertToUbo = (rules) => {
    const modified = [];
    if (!rules) {
        return modified;
    }
    rules.forEach((rule) => {
        if (rule) {
            try {
                const ruleNode = RuleParser.parse(rule);
                const conversionResult = RuleConverter.convertToUbo(ruleNode);
                const convertedRules = conversionResult.result.map((r) => RuleGenerator.generate(r));
                modified.push(...convertedRules);
            } catch (e) {
                const message = `Unable to convert rule to AdGuard syntax: "${rule}" due to error: ${e.message}`;
                logger.log(message);
            }
        } else {
            modified.push('');
        }
    });
    return modified;
};
