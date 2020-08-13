const {
    RuleValidator,
    RuleFactory,
    CosmeticRuleType,
    CosmeticRule,
    RuleConverter,
} = require('@adguard/tsurlfilter');
const logger = require('./utils/log.js');
const extendedCssValidator = require('./utils/extended-css-validator.js');

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

module.exports = {
    validate,
};
