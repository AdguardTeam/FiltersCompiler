/* eslint-disable global-require */
module.exports = (() => {
    const logger = require('./utils/log.js');
    const { RuleConverter, setLogger } = require('@adguard/tsurlfilter');

    // Sets RuleConverter to use logger of current library
    setLogger(logger);

    const scriptlets = require('scriptlets');
    const { redirects } = scriptlets;

    /**
     * Converts rules to AdGuard syntax
     * @param {array} rulesList
     * @return {array} result
     */
    const convertRulesToAdgSyntax = function (rulesList) {
        const result = [];

        for (let i = 0; i < rulesList.length; i += 1) {
            const rule = rulesList[i];
            const converted = RuleConverter.convertRule(rule);
            result.push(...converted);
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
            if (validateMethod(rule)) {
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
            scriptlets.isAdgScriptletRule,
            scriptlets.convertAdgToUbo
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
            redirects.isAdgRedirectCompatibleWithUbo,
            redirects.convertAdgRedirectToUbo
        );
    };


    return {
        convertRulesToAdgSyntax,
        convertAdgScriptletsToUbo,
        convertAdgRedirectsToUbo,
    };
})();
