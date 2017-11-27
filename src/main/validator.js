/* globals module, require, console */

module.exports = (function () {

    'use strict';

    /**
     * @typedef {Object} fs
     * @property {function} readFileSync
     */
    const fs = require('fs');
    const CssSelectorParser = require('css-selector-parser').CssSelectorParser;

    const logger = require("./utils/log.js");
    const ruleParser = require("./rule/rule-parser.js");
    const RuleTypes = require("./rule/rule-types.js");
    const Rule = require("./rule/rule.js");

    const VALID_OPTIONS = [
        // Basic modifiers
        'domain', '~domain',
        'third-party', '~third-party',
        'popup', '~popup',
        'match-case', '~match-case',
        // Special behaviour modifiers
        'csp',
        'webrtc',
        'websocket',
        // Content type modifiers
        'image', '~image',
        'stylesheet', '~stylesheet',
        'script', '~script',
        'object', '~object',
        'object-subrequest', '~object-subrequest',
        'font', '~font',
        'media', '~media',
        'subdocument', '~subdocument',
        'xmlhttprequest', '~xmlhttprequest',
        'other', '~other',
        // Exception rules modifiers
        'elemhide',
        'content',
        'jsinject',
        'urlblock',
        'document',
        'stealth',
        'generichide',
        'genericblock',
        'important',
        'empty',
        'mp4',
        'replace',
        'protobuf',
        'app'];

    /**
     * The problem with pseudo-classes is that any unknown pseudo-class makes browser ignore the whole CSS rule,
     * which contains a lot more selectors. So, if CSS selector contains a pseudo-class, we should try to validate it.
     * <p>
     * One more problem with pseudo-classes is that they are actively used in uBlock, hence it may mess AG styles.
     */
    const SUPPORTED_PSEUDO_CLASSES = [":active",
        ":checked", ":disabled", ":empty", ":enabled", ":first-child", ":first-of-type",
        ":focus", ":hover", ":in-range", ":invalid", ":lang", ":last-child", ":last-of-type",
        ":link", ":not", ":nth-child", ":nth-last-child", ":nth-last-of-type", ":nth-of-type",
        ":only-child", ":only-of-type", ":optional", ":out-of-range", ":read-only",
        ":read-write", ":required", ":root", ":target", ":valid", ":visited", ":has", ":has-text", ":contains",
        ":matches-css", ":matches-css-before", ":matches-css-after", ":-abp-has", ":-abp-contains"];

    /**
     * The problem with it is that ":has" and ":contains" pseudo classes are not a valid pseudo classes,
     * hence using it may break old versions of AG.
     *
     * @type {string[]}
     */
    const EXTENDED_CSS_MARKERS = ["[-ext-has=", "[-ext-contains=", "[-ext-has-text=", "[-ext-matches-css=",
        "[-ext-matches-css-before=", "[-ext-matches-css-after=", ":has(", ":has-text(", ":contains(",
        ":matches-css(", ":matches-css-before(", ":matches-css-after(", ":-abp-has(", ":-abp-contains("];

    const ATTRIBUTE_START_MARK = '[';
    const ATTRIBUTE_END_MARK = ']';
    const QUOTES = '"';
    const TAG_CONTENT_MAX_LENGTH = 'max-length';
    const VALID_TAGS_CONTENT = [
        'id',
        'tag-content',
        'max-length',
        'min-length',
        'parent-elements',
        'parent-search-level',
        'wildcard'
    ];

    let domainsBlacklist = [];
    let cssParser;

    /**
     * Initializes validator
     *
     * @param domainBlacklistFile
     */
    const init = function (domainBlacklistFile) {
        try {
            let s = fs.readFileSync(domainBlacklistFile, {encoding: 'utf-8'});
            domainsBlacklist = s.split('\n');
        } catch (e) {
            domainsBlacklist = [];
        }

        cssParser = new CssSelectorParser();

        cssParser.registerSelectorPseudos('has');
        cssParser.registerNestingOperators('>', '+', '~');
        cssParser.registerAttrEqualityMods('^', '$', '*', '~');
        cssParser.enableSubstitutes();
    };

    /**
     * Validates css rule selector
     *
     * @param selector
     */
    const validateCssSelector = function (selector) {

        try {
            cssParser.parse(selector);
            return true;
        } catch (e) {
            return false;
        }
    };

    /**
     * Parses first pseudo class from the specified CSS selector
     *
     * @param selector
     * @returns {*} first PseudoClass found or null
     */
    const parsePseudoClass = function (selector) {
        let beginIndex = 0;
        let nameStartIndex = -1;
        let squareBracketIndex = 0;

        while (squareBracketIndex >= 0) {
            nameStartIndex = selector.indexOf(':', beginIndex);
            if (nameStartIndex < 0) {
                return null;
            }

            if (nameStartIndex > 0 && selector.charAt(nameStartIndex - 1) === '\\') {
                // Escaped colon character
                return null;
            }

            squareBracketIndex = selector.indexOf("[", beginIndex);
            while (squareBracketIndex >= 0) {
                if (nameStartIndex > squareBracketIndex) {
                    let squareEndBracketIndex = selector.indexOf("]", squareBracketIndex + 1);
                    beginIndex = squareEndBracketIndex + 1;
                    if (nameStartIndex < squareEndBracketIndex) {
                        // Means that colon character is somewhere inside attribute selector
                        // Something like a[src^="http://domain.com"]
                        break;
                    }

                    if (squareEndBracketIndex > 0) {
                        squareBracketIndex = selector.indexOf("[", beginIndex);
                    } else {
                        // bad rule, example: a[src="http:
                        return null;
                    }
                } else {
                    squareBracketIndex = -1;
                    break;
                }
            }
        }

        let nameEndIndex = indexOfAny(selector, [' ', '\t', '>', '(', '[', '.', '#', ':', '+', '~', '"', "'"], nameStartIndex + 1);
        if (nameEndIndex < 0) {
            nameEndIndex = selector.length;
        }

        const name = selector.substring(nameStartIndex, nameEndIndex);
        if (name.length <= 1) {
            // Either empty name or a pseudo element (like ::content)
            return null;
        }

        return {
            name: name,
            nameStartIndex: nameStartIndex,
            nameEndIndex: nameEndIndex
        };
    };

    const getQuoteIndex = function (text, startIndex) {

        let nextChar = '"';
        let quoteIndex = startIndex - 2;

        while (nextChar === '"') {
            quoteIndex = text.indexOf(QUOTES, quoteIndex + 2);
            if (quoteIndex === -1) {
                return -1;
            }
            nextChar = text.length === (quoteIndex + 1) ? '0' : text.charAt(quoteIndex + 1);
        }

        return quoteIndex;
    };

    /**
     * Validates content rule attributes
     */
    const validateContentRuleAttributes = function (line) {
        let ruleStartIndex = line.indexOf(ATTRIBUTE_START_MARK);

        while (ruleStartIndex !== -1) {
            let equalityIndex = line.indexOf('=', ruleStartIndex + 1);
            let quoteStartIndex = line.indexOf(QUOTES, equalityIndex + 1);
            let quoteEndIndex = getQuoteIndex(line, quoteStartIndex + 1);
            if (quoteStartIndex === -1 || quoteEndIndex === -1) {
                break;
            }

            let ruleEndIndex = line.indexOf(ATTRIBUTE_END_MARK, quoteEndIndex + 1);

            const attributeName = line.substring(ruleStartIndex + 1, equalityIndex);
            let attributeValue = line.substring(quoteStartIndex + 1, quoteEndIndex);
            attributeValue = attributeValue.replace(/""/g, '"');

            if (VALID_TAGS_CONTENT.indexOf(attributeName) < 0) {
                logger.error(`Invalid tag: ${line}`);
                return false;
            }

            if (attributeName === TAG_CONTENT_MAX_LENGTH) {
                let maxLength = parseInt(attributeValue);
                if (maxLength > 32768 || maxLength < 0) {
                    logger.error(`Invalid tag max length: ${line}`);
                    return false;
                }
            }

            if (ruleEndIndex === -1) {
                break;
            }

            ruleStartIndex = line.indexOf(ATTRIBUTE_START_MARK, ruleEndIndex + 1);
        }

        return true;
    };

    /**
     * Look for any symbol from "chars" array starting at "start" index or from the start of the string
     *
     * @param str   String to search
     * @param chars Chars to search for
     * @param start Start index (optional, inclusive)
     * @return int Index of the element found or null
     */
    const indexOfAny = function (str, chars, start) {

        start = start || 0;

        if (typeof str === 'string' && str.length <= start) {
            return -1;
        }

        for (let i = start; i < str.length; i++) {
            let c = str.charAt(i);
            if (chars.indexOf(c) > -1) {
                return i;
            }
        }

        return -1;
    };

    /**
     * Filters blacklisted domains
     *
     * @param domains
     * @returns {Array.<T>|*}
     */
    const removeBlacklistedDomains = function (domains) {
        return domains.filter((d) => {
            if (domainsBlacklist.indexOf(d) >= 0) {
                logger.error(`Blacklisted domain: ${d}`);
                return false;
            }

            return true;
        });
    };

    /**
     * Validates list of rules with black list of domains
     * returns modified list of rules without blacklisted domain options
     */
    const blacklistDomains = function (list) {
        const result = [];

        list.forEach((line) => {
            let corrected = line;
            const rule = ruleParser.parseRule(line);

            if (rule.ruleType === RuleTypes.UrlBlocking) {
                let modifiers = rule.modifiers;
                if (modifiers.domain) {
                    const validated = removeBlacklistedDomains(modifiers.domain);
                    if (validated.length === 0) {
                        logger.error(`All domains are blacklisted for rule: ${line}`);
                        return;
                    }

                    modifiers.domain = validated;

                    corrected = rule.buildNewModifiers(modifiers);
                }
            } else if (rule.ruleType === RuleTypes.ElementHiding || rule.ruleType === RuleTypes.Content || rule.ruleType === RuleTypes.Script) {
                if (rule.domains) {
                    const validated = removeBlacklistedDomains(rule.domains);
                    if (validated.length === 0) {
                        logger.error(`All domains are blacklisted for rule: ${line}`);
                        return;
                    }

                    corrected = Rule.buildNewLeadingDomainsRuleText(rule.contentPart, validated, rule.mask);
                }
            }

            result.push(corrected);
        });

        return result;
    };

    /**
     * Validates option name
     *
     * @param option
     * @returns {boolean}
     */
    const validateOptionName = function (option) {
        option = option.trim();
        return VALID_OPTIONS.indexOf(option) >= 0 || VALID_OPTIONS.indexOf('~' + option) >= 0;
    };

    /**
     * Validates list of rules
     *
     * @param list
     * @returns {Array}
     */
    const validate = function (list) {
        return list.filter((s) => {
            const rule = ruleParser.parseRule(s);

            if (rule.ruleType === RuleTypes.Comment) {
                return true;
            } else if (rule.ruleType === RuleTypes.ElementHiding) {
                if (s.startsWith('||')) {
                    logger.error(`|| are unnecessary for element hiding rule: ${s}`);
                    return false;
                }

                if (!validateCssSelector(rule.contentPart)) {
                    logger.error(`Invalid selector: ${s}`);
                    return false;
                }

                const isExtendedCss = EXTENDED_CSS_MARKERS.some((m) => rule.contentPart.includes(m));
                if (!isExtendedCss) {
                    return true;
                }

                const pseudoClass = parsePseudoClass(rule.contentPart);
                if (pseudoClass !== null) {
                    if (SUPPORTED_PSEUDO_CLASSES.indexOf(pseudoClass.name) < 0) {
                        logger.error(`Invalid pseudo class: ${s}`);
                        return false;
                    }
                }

            } else if (rule.ruleType === RuleTypes.UrlBlocking) {
                // TODO: There is no way to separate content rules from incorrect $$ options separator
                // if (s.includes('$$')) {
                //     logger.error(`Invalid rule: ${s} - two option separators.`);
                //     return false;
                // }

                let modifiers = rule.modifiers;
                for (let name in modifiers) {
                    if (!validateOptionName(name)) {
                        logger.error(`Invalid rule options: ${s}`);
                        return false;
                    }
                }
            } else if (rule.ruleType === RuleTypes.Content) {
                if (!validateContentRuleAttributes(rule.ruleText)) {
                    logger.error(`Invalid content rule: ${s}`);
                    return false;
                }
            }

            //TODO: Check js rules validation

            return true;
        });
    };

    return {
        init: init,
        validate: validate,
        blacklistDomains: blacklistDomains
    };
})();

