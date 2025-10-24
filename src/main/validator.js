import {
    CommentParser,
    CosmeticRuleType,
    RuleConverter,
    RuleParser,
    RuleGenerator,
    RuleCategory,
    RegExpUtils,
} from '@adguard/agtree';
import { defaultParserOptions } from '@adguard/agtree/parser';

import { parse } from '@adguard/ecss-tree';

import {
    RuleFactory,
    CosmeticRule,
    NetworkRule,
} from '@adguard/tsurlfilter';
import { getErrorMessage } from '@adguard/logger';

import { RuleMasks } from './rule/rule-masks';
import { logger } from './utils/log';
import { validateCssSelector } from './utils/extended-css-validator';
import { shouldKeepAdgHtmlFilteringRuleAsIs } from './utils/workaround';

/**
 * @typedef {import('@adguard/agtree').AnyRule} AnyRule
 */

const AFFINITY_DIRECTIVE = '!#safari_cb_affinity'; // used as closing directive
const AFFINITY_DIRECTIVE_OPEN = `${AFFINITY_DIRECTIVE}(`;

const NOT_VALIDATE_HINT = 'NOT_VALIDATE';
const SPACE = ' ';

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

/**
 * @typedef {object} ValidationResult
 * @property {boolean} valid Whether the rule is valid.
 * @property {string|null} error Error message if the rule is invalid.
 */

/**
 * Class to validate filter rules.
 */
class RuleValidator {
    /**
     * Creates validation result for rule.
     *
     * @param {boolean} valid Whether the rule is valid.
     * @param {string} [error] Error message if the rule is invalid.
     */
    static createValidationResult(valid, error) {
        if (error) {
            return { valid, error };
        }

        return { valid, error: null };
    }

    /**
     * Validates regexp pattern.
     *
     * @param {string} pattern Regexp pattern to validate.
     * @param {string} ruleText Rule text.
     *
     * @throws {SyntaxError} If the pattern is invalid, otherwise nothing.
     */
    static validateRegexp(pattern, ruleText) {
        if (!RegExpUtils.isRegexPattern(pattern)) {
            return;
        }

        try {
            // eslint-disable-next-line no-new
            new RegExp(pattern.slice(1, -1));
        } catch (e) {
            throw new SyntaxError(`Rule has invalid regex pattern: "${ruleText}"`);
        }
    }

    /**
     * Validates rule node.
     *
     * @param {AnyRule} ruleNode Rule node to validate.
     *
     * @returns {ValidationResult} Validation result.
     */
    static validate(ruleNode) {
        if (ruleNode.category === RuleCategory.Invalid) {
            return RuleValidator.createValidationResult(
                false,
                ruleNode.error.message,
            );
        }

        if (ruleNode.category === RuleCategory.Empty || ruleNode.category === RuleCategory.Comment) {
            return RuleValidator.createValidationResult(true);
        }

        const ruleText = RuleGenerator.generate(ruleNode);

        try {
            // Validate cosmetic rules
            if (ruleNode.category === RuleCategory.Cosmetic) {
                // eslint-disable-next-line no-new
                new CosmeticRule(ruleNode, 0);
                return RuleValidator.createValidationResult(true);
            }

            // Validate network rules
            const rule = new NetworkRule(ruleNode, 0);
            RuleValidator.validateRegexp(rule.getPattern(), ruleText);
        } catch (error) {
            // TODO: add getErrorMessage as a helper
            const message = error instanceof Error ? error.message : String(error);
            const errorMessage = `Error: "${message}" in the rule: "${ruleText}"`;
            return RuleValidator.createValidationResult(false, errorMessage);
        }

        return RuleValidator.createValidationResult(true);

        // TODO: validate host rules
    }
}

/**
 * Universal function for validating CSS context.
 *
 * @param {string} input - string to be validated.
 * @param {string} contextName - context (e.g., 'selectorList', 'declarationList', 'mediaQueryList').
 * @throws {Error} Throws an error if parsing fails.
 */
const validateCssContext = (input, contextName) => {
    parse(input, {
        context: contextName,
        onParseError(error) {
            throw error;
        },
    });
};

/**
 * Removes invalid rules from the list of rules
 * and logs process in the excluded list.
 *
 * @param {string[]} list List of rule texts.
 * @param {string[]} excluded List of messages with validation results.
 * @param {string[]} invalid List of messages with validation errors.
 * @param {string} filterName Name of the filter.
 *
 * @returns {string[]} List of valid rules.
 */
// eslint-disable-next-line default-param-last
export const validateAndFilterRules = (list, excluded, invalid = [], filterName) => {
    if (!list) {
        return [];
    }

    return list.filter((ruleText, index, array) => {
        if (CommentParser.isCommentRule(ruleText)) {
            return true;
        }

        const previousRule = index > 0 ? array[index - 1] : null;
        // Skip validation if "ruleText" is preceded by "NOT_VALIDATE" hint
        // https://github.com/AdguardTeam/FiltersCompiler/issues/245
        if (
            previousRule
            && previousRule.startsWith(RuleMasks.MASK_HINT)
            && (
                previousRule.includes(`${SPACE}${NOT_VALIDATE_HINT}${SPACE}`)
                || previousRule.endsWith(`${SPACE}${NOT_VALIDATE_HINT}`)
            )

        ) {
            return true;
        }

        let convertedRuleNodes;
        try {
            const ruleNode = RuleParser.parse(ruleText, {
                ...defaultParserOptions,
                // tolerant mode is used for rather quick syntax validation
                tolerant: true,
                isLocIncluded: false,
                includeRaws: false,
                parseAbpSpecificRules: false,
                parseUboSpecificRules: false,
            });

            // temporary workaround for AdGuard's HTML filtering rules with pseudo-classes.
            // TODO: remove during AG-24662 resolving
            if (shouldKeepAdgHtmlFilteringRuleAsIs(ruleNode)) {
                return true;
            }

            const conversionResult = RuleConverter.convertToAdg(ruleNode);
            convertedRuleNodes = conversionResult.result;
            // eslint-disable-next-line no-restricted-syntax
            for (const convertedRuleNode of convertedRuleNodes) {
                if (convertedRuleNode.category !== RuleCategory.Cosmetic) {
                    continue;
                }
                switch (convertedRuleNode.type) {
                    case CosmeticRuleType.ElementHidingRule: {
                        validateCssContext(convertedRuleNode.body.selectorList.value, 'selectorList');
                        break;
                    }
                    case CosmeticRuleType.CssInjectionRule: {
                        validateCssContext(convertedRuleNode.body.selectorList.value, 'selectorList');
                        if (convertedRuleNode.body.remove === true) {
                            break;
                        }
                        validateCssContext(convertedRuleNode.body.declarationList.value, 'declarationList');
                        if (convertedRuleNode.body.mediaQueryList && convertedRuleNode.body.mediaQueryList.value) {
                            validateCssContext(convertedRuleNode.body.mediaQueryList.value, 'mediaQueryList');
                        }
                        break;
                    }
                    default:
                        break;
                }
            }
        } catch (e) {
            const message = `Error: Invalid rule in ${filterName}: "${ruleText}" due to error: ${getErrorMessage(e)}`;
            logger.error(message);
            excludeRule(excluded, message, ruleText);
            invalid.push(message);
            return false;
        }

        // optional chaining is needed for the length property because convertedRules can be undefined
        // if RuleParser.parse() or RuleConverter.convertToAdg() throws an error
        if (!convertedRuleNodes || convertedRuleNodes.length === 0) {
            return false;
        }

        for (let i = 0; i < convertedRuleNodes.length; i += 1) {
            const convertedRuleNode = convertedRuleNodes[i];

            let validationResult = RuleValidator.validate(convertedRuleNode);

            // TODO: remove this checking when $header is fixed
            // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2942
            if (
                !validationResult.valid
                && validationResult.error.includes('$header rules are not compatible with some other modifiers')
            ) {
                // $header rules are not compatible with other modifiers ONLY in the tsurlfilter
                // but it is fine for corelibs
                validationResult = { valid: true };
            }

            if (!validationResult.valid) {
                // log source rule text to the excluded log
                logger.error(`Invalid rule in ${filterName}: ${ruleText}`);
                // save warning as comment
                excludeRule(excluded, `! ${validationResult.error}`, ruleText);
                // ruleText should be already included into the error text
                invalid.push(validationResult.error);
                return false;
            }

            const rule = RuleFactory.createRule(convertedRuleNode);

            // It is impossible to bundle jsdom into tsurlfilter, so we check if rules are valid in the compiler
            if (rule instanceof CosmeticRule && rule.getType() === CosmeticRuleType.ElementHidingRule) {
                const validationResult = validateCssSelector(rule.getContent());
                if (!validationResult.ok) {
                    // TODO: rule selector can be validated by agtree
                    logger.error(`Invalid rule selector in ${filterName}: ${ruleText}`);
                    // log source rule text to the excluded log
                    excludeRule(excluded, `! ${validationResult.error} in rule:`, ruleText);
                    invalid.push(`${validationResult.error} in rule: ${ruleText}`);
                    return false;
                }
            }
        }

        return true;
    });
};

/**
 * Validates !#safari_cb_affinity directives
 *
 * @param lines
 */
export const checkAffinityDirectives = (lines) => {
    if (!(lines && lines.length)) {
        // skip empty filter
        return true;
    }
    const stack = [];

    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (line.startsWith(AFFINITY_DIRECTIVE_OPEN)) {
            stack.push(line);
            continue;
        }
        if (line === AFFINITY_DIRECTIVE) {
            const pop = stack.pop();
            if (!(pop && pop.startsWith(AFFINITY_DIRECTIVE_OPEN))) {
                return false;
            }
        }
    }

    return !stack.length;
};
