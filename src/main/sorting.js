/* globals require */

module.exports = (() => {

    'use strict';

    const logger = require("./utils/log.js");
    const utils = require("./utils/utils.js");
    const ruleParser = require("./rule/rule-parser.js");
    const Rule = require("./rule/rule.js");
    const RuleTypes = require("./rule/rule-types.js");

    const COMMENT_SEPARATOR = '!';
    const HINT_SEPARATOR = '!+';

    /**
     * Sorts element hiding rules:
     *  sorting by CSS selector in descending order;
     *  merging the rules with the same CSS selector;
     *  removing duplicated domains;
     *
     * @param rules
     */
    const sortElementHidingRules = function (rules) {
        const map = new Map();
        for (let rule of rules) {
            const selector = rule.contentPart;
            const domains = map.get(selector) || [];

            map.set(selector, domains.concat(rule.domains));
        }

        const sortedSelectors = Array.from(map.keys());
        sortedSelectors.sort();

        const result = [];
        for (let selector of sortedSelectors) {
            result.push(Rule.buildNewLeadingDomainsRuleText(selector, utils.removeDuplicates(map.get(selector)), '##'));
        }

        return result;
    };

    /**
     * Checks if line is an immutable rule
     * types of rules that must be ignored(allow sorting as string, but don't change them):
     *  JS(#%#), CSS(#$#), content replacing rules($replace), protobuf($protobuf=), Content Security Policy ($csp),
     *  application modifier for Android and Windows('$app=')
     *
     * @param line
     */
    const isImmutableRule = function (line) {
        return line.includes('#%#') ||
            line.includes('#$#') ||
            line.includes('$replace') ||
            line.includes('$protobuf=') ||
            line.includes('$csp=') ||
            line.includes('$app=');
    };

    /**
     * Sorts url blocking rules:
     *  sorting the rules in descending order;
     *  //sorting of the rule modifiers(domain=, app=, protobuf=, 'replace=' must be at the and of modifiers list)
     *  sorting and merging domains list if the rules contain only $domain= modifier
     *  removing duplicates;
     *
     * @param rules
     */
    const sortUrlBlockingRules = function (rules) {

        const rest = [];
        const map = new Map();

        rules.forEach((rule) => {
            const modifiers = rule.modifiers;
            const names = Object.getOwnPropertyNames(modifiers);
            if (names.length === 1 && modifiers.domain) {
                const url = rule.url;

                const domains = map.get(url) || [];
                map.set(url, domains.concat(modifiers.domain));
            } else {
                rest.push(rule.ruleText);
            }
        });

        let result = [];
        for (let url of map.keys()) {
            const domains = utils.removeDuplicates(map.get(url));
            domains.sort();

            result.push(Rule.buildNewUrlBlockingRuleText(url, domains));
        }

        result = result.concat(rest);
        result.sort();

        return result;
    };

    /**
     * Sort a block of rules
     *
     * @param list
     */
    const sortBlock = function (list) {
        logger.log(`Sorting a block of ${list.length} rules..`);

        const elementHidingRules = [];
        const urlBlockingRules = [];
        const comments = [];
        const immutables = [];
        const contentRules = [];
        const otherRules = [];

        for (let line of list) {
            if (!line) {
                continue;
            }

            let rule = ruleParser.parseRule(line);

            if (rule.ruleType === RuleTypes.Comment) {
                comments.push(line);
            } else if (rule.ruleType === RuleTypes.ElementHiding) {
                elementHidingRules.push(rule);
            } else if (isImmutableRule(line)) {
                immutables.push(line);
            } else if (rule.ruleType === RuleTypes.UrlBlocking) {
                urlBlockingRules.push(rule);
            } else if (rule.ruleType === RuleTypes.Content) {
                contentRules.push(line);
            } else {
                otherRules.push(line);
            }
        }

        immutables.sort();

        let result = comments;
        result = result.concat(sortElementHidingRules(elementHidingRules));
        result = result.concat(sortUrlBlockingRules(urlBlockingRules));
        result = result.concat(contentRules);
        result = result.concat(otherRules);
        result = result.concat(immutables);

        return utils.removeDuplicates(result);
    };

    /**
     * Sort
     *
     * sorting of element hiding rules in descending order;
     *  sorting by CSS selector in descending order;
     *  merging the rules with the same CSS selector;
     *  removing duplicated domains;

     * sorting of URL rules
     *  sorting the rules in descending order;
     *  sorting of the rule modifiers(domain=, app=, protobuf=, 'replace=' must be at the and of modifiers list)
     *  sorting and merging domains list if the rules contain only $domain= modifier
     *  removing duplicates;
     * types of rules that must be ignored(allow sorting as string, but don't change them):
     *  JS(#%#), CSS(#$#), content replacing rules($replace), protobuf($protobuf=), Content Security Policy ($csp), application modifier for Android and Windows('$app=')
     *
     * @param list
     * @returns {*}
     */
    const sort = function (list) {

        logger.log(`Sorting ${list.length} rules`);

        // Split to blocks with '! ' and '!+'
        const blocks = [];
        let block = [];
        blocks.push(block);

        let hint = false;
        for (let line of list) {
            if (line.startsWith(COMMENT_SEPARATOR) || line.startsWith(HINT_SEPARATOR)) {
                block = [];
                blocks.push(block);
            }

            block.push(line);

            //In case of hint the block is only the next rule
            if (hint) {
                hint = false;

                block = [];
                blocks.push(block);
            }

            if (line.startsWith(HINT_SEPARATOR)) {
                hint = true;
            }
        }

        let result = [];
        blocks.forEach((b) => {
            result = result.concat(sortBlock(b));
        });

        logger.log(`Sorting ${list.length} rules finished, result contains ${result.length} rules.`);

        return result;
    };

    return {
        sort: sort
    };
})();