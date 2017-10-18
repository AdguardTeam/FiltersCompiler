/* globals require */

module.exports = (() => {

    'use strict';

    let logger = require("./utils/log.js");
    let utils = require("./utils/utils.js");

    const COMMENT_SEPARATOR = '!';
    const HINT_SEPARATOR = '!+';
    const MASK_REGEX_RULE = "/";
    const MASK_WHITE_LIST = "@@";
    const REPLACE_OPTION = "replace";
    const OPTIONS_DELIMITER = "$";
    const ESCAPE_CHARACTER = '\\';

    /**
     * Checks if line is element hiding rule
     *
     * @param line
     */
    let isElementHidingRule = function (line) {
        return line.indexOf('##') >= 0;
    };

    /**
     * Sorts element hiding rules:
     *  sorting by CSS selector in descending order;
     *  merging the rules with the same CSS selector;
     *  removing duplicated domains;
     *
     * @param lines
     */
    let sortElementHidingRules = function (lines) {
        let map = {};
        for (let line of lines) {
            let separatorIndex = line.indexOf('##');
            let selector = line.substring(separatorIndex + 2);
            let domains = line.substring(0, separatorIndex).split(',');

            if (!map[selector]) {
                map[selector] = [];
            }

            map[selector] = map[selector].concat(domains);
        }

        let sortedSelectors = Object.keys(map).sort();

        let result = [];
        for (let selector of sortedSelectors) {
            result.push(utils.removeDuplicates(map[selector]).join(',') + '##' + selector);
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
    let isImmutableRule = function (line) {
        return line.indexOf('#%#') >= 0 ||
            line.indexOf('#$#') >= 0 ||
            line.indexOf('$replace') >= 0 ||
            line.indexOf('$protobuf=') >= 0 ||
            line.indexOf('$csp=') >= 0 ||
            line.indexOf('$app=') >= 0;
    };

    /**
     * Parses rule modifiers
     *
     * @param line
     * @returns {{}}
     */
    let parseRuleModifiers = function (line) {

        // Regexp rule may contain dollar sign which also is options delimiter
        if (line.startsWith(MASK_REGEX_RULE) && line.endsWith(MASK_REGEX_RULE) &&
            line.indexOf(REPLACE_OPTION + '=') < 0) {
            return {};
        }

        let startIndex = 0;
        if (line.startsWith(MASK_WHITE_LIST)) {
            startIndex = MASK_WHITE_LIST.length;
        }

        let optionsPart = null;
        let foundEscaped = false;
        // Start looking from the prev to the last symbol
        // If dollar sign is the last symbol - we simply ignore it.
        for (let i = (line.length - 2); i >= startIndex; i--) {
            let c = line.charAt(i);
            if (c === OPTIONS_DELIMITER) {
                if (i > 0 && line.charAt(i - 1) === ESCAPE_CHARACTER) {
                    foundEscaped = true;
                } else {
                    optionsPart = line.substring(i + 1);

                    if (foundEscaped) {
                        // Find and replace escaped options delimiter
                        optionsPart = optionsPart.replace(ESCAPE_CHARACTER + OPTIONS_DELIMITER, OPTIONS_DELIMITER);
                    }

                    // Options delimiter was found, doing nothing
                    break;
                }
            }
        }

        if (!optionsPart) {
            return {};
        }

        let options = optionsPart.split(',');

        let result = {};
        options.map((m) => {
            let name = m.substring(0, m.indexOf('='));
            let values = m.substring(m.indexOf('=') + 1).split('|');

            if (!result[name]) {
                result[name] = [];
            }

            result[name] = result[name].concat(values);
        });

        return result;
    };

    /**
     * Sorts url blocking rules:
     *  sorting the rules in descending order;
     *  //sorting of the rule modifiers(domain=, app=, protobuf=, 'replace=' must be at the and of modifiers list)
     *  sorting and merging domains list if the rules contain only $domain= modifier
     *  removing duplicates;
     *
     * @param lines
     */
    let sortUrlBlockingRules = function (lines) {

        let rest = [];
        let map = {};

        lines.map((line) => {
            let modifiers = parseRuleModifiers(line);
            let names = Object.getOwnPropertyNames(modifiers);
            if (names.length === 1 && modifiers.domain) {
                let url = line.substring(0, line.indexOf('$'));

                if (!map[url]) {
                    map[url] = [];
                }

                map[url] = map[url].concat(modifiers.domain);
            } else {
                rest.push(line);
            }
        });

        let result = [];
        for (let url in map) {
            let domains = utils.removeDuplicates(map[url]);
            domains.sort();
            result.push(url + '$domain=' + domains.join('|'));
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
    let sortBlock = function (list) {
        logger.log(`Sorting a block of ${list.length} rules..`);

        let elementHidingRules = [];
        let urlBlockingRules = [];
        let comments = [];
        let immutables = [];

        for (let line of list) {
            if (!line) {
                continue;
            }

            if (line.startsWith('!')) {
                comments.push(line);
            } else if (isElementHidingRule(line)) {
                elementHidingRules.push(line);
            } else if (isImmutableRule(line)) {
                immutables.push(line);
            } else {
                urlBlockingRules.push(line);
            }
        }

        immutables.sort();

        let result = comments;
        result = result.concat(sortElementHidingRules(elementHidingRules));
        result = result.concat(sortUrlBlockingRules(urlBlockingRules));
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
    let sort = function (list) {

        logger.log(`Sorting ${list.length} rules`);

        // Split to blocks with '! ' and '!+'
        let blocks = [];
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
        blocks.map((b) => {
            result = result.concat(sortBlock(b));
        });

        logger.log(`Sorting ${list.length} rules finished, result contains ${result.length} rules.`);

        return result;
    };

    return {
        sort: sort
    };
})();