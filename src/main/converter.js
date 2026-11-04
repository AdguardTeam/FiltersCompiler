import {
    AdblockSyntax,
    RuleConverter,
    RuleParser,
    RuleGenerator,
    CosmeticRuleType,
} from '@adguard/agtree';
import { getErrorMessage } from '@adguard/logger';

import { logger } from './utils/log';
import { RuleMasks, hasHint, NOT_CONVERT_HINT } from './rule/rule-masks';
import {
    CORE_LIBS_PCRE2_QUANTIFIER_LIMIT,
    shouldKeepHtmlRuleWithOversizedLengths,
} from './utils/workaround';

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
 * Converts rules to AdGuard syntax.
 *
 * Rules preceded by the `!+ NOT_CONVERT` hint are kept as-is.
 *
 * @param {string[]} rulesList Input rules.
 * @param {string[]} [excluded=[]] Rules to exclude.
 * @param {string[]} [invalidRules=[]] Collected invalid rules for the report file.
 * @param {string} [previousLine] Line preceding the first rule of `rulesList`, so that a hint
 * on a separate line (e.g. `!+ NOT_CONVERT`) is honored when the rules are converted one by one.
 *
 * @return {string[]} Rules converted to AdGuard syntax, except for the ones kept as-is.
 */
export const convertRulesToAdgSyntax = (rulesList, excluded = [], invalidRules = [], previousLine = undefined) => {
    const result = [];

    for (let i = 0; i < rulesList.length; i += 1) {
        const rule = rulesList[i];

        if (hasHint(i > 0 ? rulesList[i - 1] : previousLine, NOT_CONVERT_HINT)) {
            const message = `Rule "${rule}" is kept as-is due to the NOT_CONVERT hint`;
            logger.info(message);
            excludeRule(rule, excluded, message);
            result.push(rule);
            continue;
        }

        try {
            const ruleNode = RuleParser.parse(rule);

            // HTML filtering rules with [min-length]/[max-length] attribute values
            // exceeding the CoreLibs PCRE2 quantifier limit (65535) are kept as-is,
            // because converting them to `:contains()` with a regexp quantifier
            // would make them silently fail in CoreLibs apps,
            // while the old syntax works there natively.
            // The length check only applies to AdGuard HTML filtering rules, so
            // the already-parsed node is checked first to avoid re-parsing every
            // network and element-hiding rule in the helper.
            if (
                ruleNode.type === CosmeticRuleType.HtmlFilteringRule
                && ruleNode.syntax === AdblockSyntax.Adg
                && shouldKeepHtmlRuleWithOversizedLengths(rule)
            ) {
                // eslint-disable-next-line max-len
                const message = `Warning: HTML filtering rule with [min-length] or [max-length] value exceeding ${CORE_LIBS_PCRE2_QUANTIFIER_LIMIT} `
                    + `is kept as-is, because conversion to :contains() would not work in CoreLibs apps: "${rule}"`;
                logger.warn(message);
                excludeRule(rule, excluded, message);
                result.push(rule);
                continue;
            }

            const conversionResult = RuleConverter.convertToAdg(ruleNode);
            const convertedRules = conversionResult.result.map((r) => RuleGenerator.generate(r));
            result.push(...convertedRules);

            if (conversionResult.isConverted) {
                const messagePostfix = convertedRules.length > 1
                    // eslint-disable-next-line quotes
                    ? `to multiple rules: "${convertedRules.join(", ")}"`
                    : `to: "${convertedRules[0]}"`;
                const message = `Rule "${rule}" converted ${messagePostfix}`;
                excludeRule(rule, excluded, message);
            }
        } catch (e) {
            // eslint-disable-next-line max-len
            const message = `Error: Unable to convert rule to AdGuard syntax: "${rule}" due to error: ${getErrorMessage(e)}`;
            logger.error(message);
            excludeRule(rule, excluded, message);

            // collect the invalid rule for the report file
            invalidRules.push(message);
        }
    }

    return result;
};

/**
 * Returns canonical AdGuard representation of a single rule.
 *
 * Unlike `convertRulesToAdgSyntax`, a rule that cannot be parsed is not reported
 * as an error: the failure is logged and an empty array is returned.
 *
 * Needed to check exclusions against rules kept as-is due to the `NOT_CONVERT` hint:
 * such rules may be written in a form that bypasses substring exclusions
 * (e.g. `#%#//scriptlet( 'trusted-set-cookie', ...)` with a space), while their canonical
 * form does not.
 *
 * @param {string} rule Rule to convert.
 *
 * @returns {string[]} Converted rule texts, or an empty array if the rule cannot be parsed.
 */
export const getCanonicalRuleTexts = (rule) => {
    try {
        const ruleNode = RuleParser.parse(rule);
        return RuleConverter.convertToAdg(ruleNode).result.map((r) => RuleGenerator.generate(r));
    } catch (e) {
        logger.info(`Unable to compute canonical form of "${rule}": ${getErrorMessage(e)}`);
        return [];
    }
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

                    // The uBO-compatible spelling keeps the `ubo-` prefix
                    // (e.g. `ubo-trusted-set-cookie`), so drop it before checking
                    // for a trusted scriptlet.
                    const normalizedScriptletName = scriptletName
                        .startsWith(RuleMasks.MASK_UBO_SCRIPTLET_PREFIX)
                        ? scriptletName.slice(RuleMasks.MASK_UBO_SCRIPTLET_PREFIX.length)
                        : scriptletName;

                    // TODO: move this check to AGTree AG-41266
                    if (normalizedScriptletName.startsWith(RuleMasks.MASK_TRUSTED_SCRIPTLET)) {
                        // https://github.com/AdguardTeam/Scriptlets#trusted-scriptlets-restriction
                        // does not work in other blockers
                        const message = `Trusted scriptlets should not be converted to uBO syntax. Rule: "${rule}"`;
                        logger.warn(message);
                        modified.push('');
                        return;
                    }
                }
                const conversionResult = RuleConverter.convertToUbo(ruleNode);
                const convertedRules = conversionResult.result.map((r) => RuleGenerator.generate(r));
                modified.push(...convertedRules);
            } catch (e) {
                const message = `Unable to convert rule to Ubo syntax: "${rule}" due to error: ${e.message}`;
                logger.error(message);
            }
        } else {
            modified.push('');
        }
    });
    return modified;
};
