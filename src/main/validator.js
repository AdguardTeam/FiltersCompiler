const {
    RuleValidator,
    RuleFactory,
    CosmeticRuleType,
    CosmeticRule,
    RuleConverter,
} = require('@adguard/tsurlfilter');
const logger = require('./utils/log.js');
const extendedCssValidator = require('./utils/extended-css-validator.js');

const AFFINITY_DIRECTIVE = '!#safari_cb_affinity'; // used as closing directive
const AFFINITY_DIRECTIVE_OPEN = `${AFFINITY_DIRECTIVE}(`;

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
 * Removes invalid rules from the list of rules
 * and logs process in the excluded list
 *
 * @param {string[]} list of rule texts
 * @param {string[]} excluded - list of messages with validation results
 * @returns {Array}
 */
const validate = function (list, excluded) {
    if (!list) {
        return [];
    }

    return list.filter((ruleText) => {
        if (RuleFactory.isComment(ruleText)) {
            return true;
        }

        const convertedRules = RuleConverter.convertRule(ruleText);

        for (let i = 0; i < convertedRules.length; i += 1) {
            const convertedRuleText = convertedRules[i];

            const validationResult = RuleValidator.validate(convertedRuleText);

            if (!validationResult.valid) {
                // log source rule text to the excluded log
                logger.error(`Invalid rule: ${ruleText}`);
                excludeRule(excluded, validationResult.error, ruleText);
                return false;
            }

            const rule = RuleFactory.createRule(convertedRuleText);

            // It is impossible to bundle jsdom into tsurlfilter, so we check if rules are valid in the compiler
            if (rule instanceof CosmeticRule && rule.getType() === CosmeticRuleType.ElementHiding) {
                if (!extendedCssValidator.validateCssSelector(rule.getContent())) {
                    logger.error(`Invalid selector: ${ruleText}`);
                    // log source rule text to the excluded log
                    excludeRule(excluded, '! Invalid selector:', ruleText);
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
const checkAffinityDirectives = (lines) => {
    if (!(lines && lines.length)) {
        // skip empty filter
        return;
    }
    const stack = [];

    lines.forEach((line) => {
        if (line.startsWith(AFFINITY_DIRECTIVE_OPEN)) {
            stack.push(line);
        }
        if (line === AFFINITY_DIRECTIVE) {
            if (!stack[stack.length - 1]) {
                throw new Error('Error validating !#safari_cb_affinity directive');
            } else if (stack[stack.length - 1].startsWith(AFFINITY_DIRECTIVE_OPEN)) {
                stack.pop();
            }
        }
    });

    if (stack.length) {
        throw new Error('Error validating !#safari_cb_affinity directive');
    }
};

module.exports = {
    validate,
    checkAffinityDirectives,
};
