import {
    RuleConverter,
    RuleParser,
    RuleGenerator,
    CosmeticRuleType,
} from '@adguard/agtree';

import { logger } from './utils/log';

import { RuleMasks } from './rule/rule-masks';

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
            logger.info(message);
            excludeRule(rule, excluded, message);
        }
    }

    return result;
};

const SINGLE_QUOTE = "'";
const DOUBLE_QUOTE = '"';

/**
 * Trims quotes (single or double) from the start and end of a string if they exist.
 *
 * @param {string} str - The string to trim.
 * @returns {string} The trimmed string.
 */
export const trimQuotes = (str) => {
    if (
        (str.startsWith(SINGLE_QUOTE) && str.endsWith(SINGLE_QUOTE))
        || (str.startsWith(DOUBLE_QUOTE) && str.endsWith(DOUBLE_QUOTE))
    ) {
        return str.slice(1, -1);
    }
    return str;
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
                // js injection rules are not supported in uBO
                if (ruleNode.type === CosmeticRuleType.JsInjectionRule) {
                    return;
                }
                if (ruleNode.type === CosmeticRuleType.ScriptletInjectionRule) {
                    const scriptletNode = ruleNode.body.children[0].children[0];
                    const scriptletNameString = trimQuotes(scriptletNode.value);

                    if (!scriptletNameString) {
                        // If the scriptlet name is missing, skip processing this rule
                        return;
                    }

                    const scriptletName = trimQuotes(scriptletNameString);

                    // TODO: move this check to AGTree AG-41266
                    if (scriptletName.startsWith(RuleMasks.MASK_TRUSTED_SCRIPTLET)) {
                        // https://github.com/AdguardTeam/Scriptlets#trusted-scriptlets-restriction
                        // does not work in other blockers
                        const message = `Trusted scriptlets should not be converted to uBO syntax. Rule: "${rule}"`;
                        logger.info(message);
                        modified.push('');
                        return;
                    }
                }
                const conversionResult = RuleConverter.convertToUbo(ruleNode);
                const convertedRules = conversionResult.result.map((r) => RuleGenerator.generate(r));
                modified.push(...convertedRules);
            } catch (e) {
                const message = `Unable to convert rule to Ubo syntax: "${rule}" due to error: ${e.message}`;
                logger.info(message);
            }
        } else {
            modified.push('');
        }
    });
    return modified;
};
