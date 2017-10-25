module.exports = (() => {

    'use strict';

    const MASK_REGEX_RULE = "/";
    const MASK_WHITE_LIST = "@@";
    const REPLACE_OPTION = "replace";
    const OPTIONS_DELIMITER = "$";
    const ESCAPE_CHARACTER = '\\';

    //TODO: Add more options
    const VALID_OPTIONS = ['domain', '~domain','important', '~important', 'empty', '~empty',
        'script', '~script', 'third-party', '~third-party', 'xmlhttprequest', '~xmlhttprequest'];

    /**
     * Checks if line is element hiding rule
     *
     * @param line
     */
    let isElementHidingRule = function (line) {
        return line.indexOf('##') >= 0;
    };

    /**
     * Parses rule modifiers
     *
     * @param line
     * @returns {{}}
     */
    let parseRuleModifiers = function (line) {

        if (line.indexOf('$$') >= 0) {
            throw new Error(`Invalid rule: ${line} - two option separators.`);
        }

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
            let separatorIndex = m.indexOf('=');
            let name = m;
            let values = '';

            if (separatorIndex >= 0) {
                name = m.substring(0, separatorIndex);
                values = m.substring(separatorIndex + 1).split('|');
            }

            if (!validateOptionName(name)) {
                throw new Error(`Invalid rule options: ${line}`);
            }

            if (!result[name]) {
                result[name] = [];
            }

            result[name] = result[name].concat(values);
        });

        return result;
    };

    /**
     * Validates option name
     *
     * @param option
     * @returns {boolean}
     */
    let validateOptionName = function (option) {
        option = option.trim();
        return VALID_OPTIONS.indexOf(option) >= 0 || VALID_OPTIONS.indexOf('~' + option) >= 0;
    };

    return {
        parseRuleModifiers: parseRuleModifiers,
        isElementHidingRule: isElementHidingRule
    };
})();