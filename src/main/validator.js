const {
    RuleValidator,
    RuleFactory,
    CosmeticRuleType,
    CosmeticRule,
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
 * Validates list of rules
 *
 * @param {string[]} list of rule texts
 * @param excluded
 * @returns {Array}
 */
// TODO test excluded text messages
const validate = function (list, excluded) {
    if (!list) {
        return [];
    }

    return list.filter((ruleText) => {
        if (RuleFactory.isComment(ruleText)) {
            return true;
        }

        const validationResult = RuleValidator.validate(ruleText);

        if (!validationResult.valid) {
            excludeRule(excluded, validationResult.error, ruleText);
            return false;
        }

        const rule = RuleFactory.createRule(ruleText);

        // It is impossible to bundle jsdom into tsurlfilter, so we check if rules are valid in the compiler
        if (rule instanceof CosmeticRule && rule.getType() === CosmeticRuleType.ElementHiding) {
            if (!extendedCssValidator.validateCssSelector(rule.getContent())) {
                logger.error(`Invalid selector: ${ruleText}`);
                excludeRule(excluded, '! Invalid selector:', rule.getText());
                return false;
            }
        }

        return true;
    });
};

module.exports = {
    validate,
};
