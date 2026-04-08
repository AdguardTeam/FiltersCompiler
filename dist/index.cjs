'use strict';

var path$1 = require('path');
var url = require('url');
var tsurlfilter = require('@adguard/tsurlfilter');
var fs$1 = require('fs');
var md5 = require('md5');
var filtersDownloader = require('@adguard/filters-downloader');
var agtree = require('@adguard/agtree');
var logger$1 = require('@adguard/logger');
var fs = require('node:fs');
var os = require('node:os');
var path = require('node:path');
var parser = require('@adguard/agtree/parser');
var ecssTree = require('@adguard/ecss-tree');
var util = require('util');
var module$1 = require('module');
var jsdom = require('jsdom');
var crypto = require('crypto');
var moment = require('moment');
var tldts = require('tldts');
var Ajv = require('ajv');

var _documentCurrentScript = typeof document !== 'undefined' ? document.currentScript : null;
/**
 * Version utility functions
 */
const version = {
    /**
     * Parses version from string
     *
     * @param v version string
     * @returns {Array}
     */
    parse(v) {
        const version = [];
        const parts = String(v || '').split('.');

        const parseVersionPart = (part) => {
            if (Number.isNaN(part)) {
                return 0;
            }
            return Math.max(part - 0, 0);
        };

        // eslint-disable-next-line no-restricted-syntax
        for (const part of parts) {
            version.push(parseVersionPart(part));
        }

        return version;
    },

    /**
     * Increments build part of version '0.0.0.0'
     *
     * @param v version string
     * @returns {string}
     */
    increment(v) {
        const version = this.parse(v);

        if (version.length > 0) {
            version[version.length - 1] = version[version.length - 1] + 1;
        }

        for (let i = version.length; i > 0; i -= 1) {
            if (version[i] === 100) {
                version[i] = 0;
                version[i - 1] += 1;
            }
        }

        return version.join('.');
    },
};

/**
 * Extend logger implementation
 */
class CompilerLogger extends logger$1.Logger {
    /**
     * File descriptor
     *
     * @type {number | null}
     *
     * @private
     */
    #fd = null;

    /**
     * Helper to append message to log file
     *
     * @param {string} message
     * @param {'INFO'|'WARN'|'ERROR'} level
     *
     * @private
     */
    #append(message, level) {
        if (this.#fd == null) {
            return;
        }

        const line = `[${new Date().toLocaleTimeString()}] [${level}]: ${message}${os.EOL}`;

        // Using appendFileSync with an fd ensures atomic append semantics.
        fs.appendFileSync(this.#fd, line, 'utf8');
    }

    /** @inheritdoc */
    info(message) {
        super.info(message);
        this.#append(message, 'INFO');
    }

    /** @inheritdoc */
    error(message) {
        super.error(message);
        this.#append(message, 'ERROR');
    }

    /** @inheritdoc */
    warn(message) {
        super.warn(message);
        this.#append(message, 'WARN');
    }

    /**
     * Initializes logger
     *
     * @param {string} logFilePath - log file path
     *
     * The log file is opened with 'w' (truncate/create). Subsequent writes are appended.
     */
    initialize(logFilePath) {
        if (!logFilePath) {
            /* eslint-disable no-console */
            console.warn('Log file is not specified');
            return;
        }

        // Ensure the directory exists before creating the log file
        const dir = path.dirname(logFilePath);
        fs.mkdirSync(dir, { recursive: true });

        // Close any previous descriptor to avoid leaks
        if (this.#fd != null) {
            try {
                fs.closeSync(this.#fd);
            } catch {
                /* noop */
            }
            this.#fd = null;
        }

        // Open (truncate) now; we’ll append to the same fd later.
        this.#fd = fs.openSync(logFilePath, 'w');
        this.logFile = logFilePath;
    }

    /**
     * Optional: call to close the file descriptor when done (e.g., on shutdown)
     */
    close() {
        if (this.#fd != null) {
            try {
                fs.closeSync(this.#fd);
            } finally {
                this.#fd = null;
            }
        }
    }
}

const logger = new CompilerLogger();

// TODO: a lot of these masks can be imported from @adguard/agtree
/**
 * Rule masks constants
 */
const RuleMasks = {
    MASK_REGEX_RULE: '/',
    MASK_RULE_SEPARATOR: '^',
    MASK_WHITE_LIST: '@@',
    MASK_BASE_RULE: '||',
    MASK_ELEMENT_HIDING: '##',
    MASK_ELEMENT_HIDING_EXCEPTION: '#@#',
    MASK_CSS: '#$#',
    MASK_CSS_EXCEPTION: '#@$#',
    MASK_CSS_EXTENDED_CSS_RULE: '#?#',
    MASK_CSS_EXCEPTION_EXTENDED_CSS_RULE: '#@?#',
    MASK_CSS_INJECT_EXTENDED_CSS_RULE: '#$?#',
    MASK_CSS_EXCEPTION_INJECT_EXTENDED_CSS_RULE: '#@$?#',
    MASK_SCRIPT: '#%#',
    MASK_SCRIPT_EXCEPTION: '#@%#',
    MASK_CONTENT: '$$',
    MASK_CONTENT_EXCEPTION: '$@$',
    MASK_COMMENT: '!',
    MASK_HOST_FILE_COMMENT: '#',
    MASK_HINT: '!+',
    MASK_DIRECTIVES: '!#',
    MASK_SCRIPTLET: '#%#//scriptlet',
    MASK_SCRIPTLET_EXCEPTION: '#@%#//scriptlet',
    MASK_TRUSTED_SCRIPTLET: 'trusted-',
};

// TODO: consider refactoring this file
// because agtree provides modern approach to solve such problems

// Based on: https://github.com/github/linguist/pull/5968/commits/f7c5c39139945576a5f9ff0b41c990e6b6019232
// eslint-disable-next-line max-len
const ADBLOCK_AGENT_PATTERN = /^(?:!|#)?\s*\[(?<AdblockInfo>\s*(?:[Aa]d[Bb]lock(?:\s+[Pp]lus)?|u[Bb]lock(?:\s+[Oo]rigin)?|[Aa]d[Gg]uard)(?:\s+(?:\d\.?)+)?\s*)(?:;\g<AdblockInfo>)*\]\s*$/;

/**
 * CSS rules with width and height attributes break SVG rendering
 * https://github.com/AdguardTeam/AdguardBrowserExtension/issues/683
 *
 * @param ruleText Rule text
 */
const fixCssRuleAttributesForEdge = function (ruleText) {
    if (ruleText.includes(RuleMasks.MASK_CSS)
        || ruleText.includes(RuleMasks.MASK_CSS_EXCEPTION)
        || ruleText.includes(RuleMasks.MASK_ELEMENT_HIDING)
        || ruleText.includes(RuleMasks.MASK_ELEMENT_HIDING_EXCEPTION)) {
        ruleText = ruleText.replace(/\[width=/gi, '[Width=');
        ruleText = ruleText.replace('/[height=/gi', '[Height=');
    }

    return ruleText;
};

/**
 * Updates rule text
 */
const overrideRule = function (ruleText, platform) {
    if (platform === 'ext_edge') {
        ruleText = fixCssRuleAttributesForEdge(ruleText);
    }

    return ruleText;
};

/**
 * Modifies header for AdGuard Base filter
 * https://github.com/AdguardTeam/FiltersCompiler/issues/78
 * @param {array} header
 * @param {boolean} optimized
 */
const modifyBaseFilterHeader = (header, optimized) => {
    header[0] = `! Title: AdGuard Base filter + EasyList${optimized ? ' (Optimized)' : ''}`;
};

/**
 * Rewrites title and description
 * https://github.com/AdguardTeam/AdguardFilters/issues/5138#issuecomment-328847738
 */
const rewriteHeader = function (header) {
    const result = [];
    header.forEach((line) => {
        if (line.startsWith('! Title: ')) {
            line = '! Title: AdGuard Base filter';
        } else if (line.startsWith('! Description: ')) {
            line = '! Description: This filter is necessary for quality ad blocking.';
        }

        result.push(line);
    });

    return result;
};

/**
 * Filters easylist block from list of rules
 * https://github.com/AdguardTeam/AdguardFilters/issues/5138#issuecomment-328847738
 */
const rewriteRules = function (rules) {
    const filtered = [];
    let flag = -1;
    for (let i = 0; i < rules.length; i += 1) {
        const rule = rules[i];

        if (flag >= 0 && rule.startsWith('!------------------')) {
            if (flag !== i - 1) {
                // we skip next line after block header
                // looking for the end of easylist block
                flag = -1;
            }

            continue;
        }

        if (rule.startsWith('!------------------ EasyList rules')) {
            flag = i;
            continue;
        }

        if (flag < 0) {
            filtered.push(rule);
        }
    }

    return filtered;
};

/**
 * Replaces Version: with OriginalVersion: comments in case of some client cannot afford it.
 *
 * @param rules
 */
const fixVersionComments = (rules) => {
    return rules.map((x) => {
        if (x.startsWith('! Version:')) {
            return x.replace('! Version:', '! OriginalVersion:');
        }

        return x;
    });
};

// TODO: use agtree to remove adblock agent strings
/**
 * Removes adblock agent strings, for example:
 *  - [AdBlock],
 *  - [Adblock Plus],
 *  - [Adblock Plus 2.0],
 *  - [AdGuard],
 *  - [uBlock] / [uBlock Origin], etc.
 *
 * @param lines
 */
const removeAdblockVersion = (lines) => {
    return lines.filter((line) => !line.trim().match(ADBLOCK_AGENT_PATTERN));
};

/**
 * Removes scriptlet rules
 * @param {array} rules
 * @return {array} rules
 */
const removeScriptletRules = (rules) => rules.filter((rule) => !rule.script.startsWith(agtree.ADG_SCRIPTLET_MASK));

/**
 * Removes `groupDescription` field from `groups`.
 *
 * @param rawGroups
 * @returns Corrected groups
 */
const removeGroupDescriptions$1 = function (rawGroups) {
    const groups = [];

    // eslint-disable-next-line no-restricted-syntax
    for (const g of rawGroups) {
        // Explicitly keep only the required fields for backward compatibility
        const copy = {
            groupId: g.groupId,
            groupName: g.groupName,
            displayNumber: g.displayNumber,
        };

        groups.push(copy);
    }

    return groups;
};

/**
 * Corrects metadata for backward compatibility with old clients on MAC (v1) platform
 * Hides tag fields
 *
 * @param metadata
 * @returns Corrected metadata
 */
const rewriteMetadataForOldMacV1 = function (metadata) {
    const result = {
        groups: removeGroupDescriptions$1(metadata.groups.slice(0)),
        filters: [],
    };

    // eslint-disable-next-line no-restricted-syntax
    for (const f of metadata.filters) {
        const copy = { ...f };
        delete copy.tags;
        delete copy.timeAdded;
        delete copy.trustLevel;
        delete copy.downloadUrl;
        delete copy.deprecated;

        result.filters.push(copy);
    }

    return result;
};

/**
 * Corrects metadata for backward compatibility with old clients on MAC_V2 platform —
 * removed `groupDescription` field from `groups`.
 *
 * @param metadata
 * @returns Corrected metadata
 */
const rewriteMetadataForOldMacV2 = function (metadata) {
    const result = { ...metadata };
    result.groups = removeGroupDescriptions$1(result.groups.slice(0));
    return result;
};

/**
 * Markers of pseudo-classes for HTML filtering rules.
 *
 * Already supported by the AdGuard apps, but not implemented for the extension yet.
 * TODO: AG-24662.
 *
 * @see {@link https://adgkb.service.agrd.dev/kb/general/ad-filtering/create-own-filters/#html-filtering-rules--pseudo-classes}
 */
const HTML_RULES_PSEUDO_CLASS_MARKERS = [
    // AdGuard-specific pseudo-classes
    ':contains(',
    // aliases
    ':-abp-contains(',
    ':has-text(',
];

/**
 * Checks if the rule should be kept as is,
 * i.e. no conversion and no validation,
 * since it is not supported by the extension yet.
 *
 * Conditions for keeping the rule as is:
 * - rule is HTML filtering rule
 * - rule is AdGuard syntax
 * - rule contains pseudo-class marker.
 *
 * Planned to be fixed:
 * https://github.com/AdguardTeam/tsurlfilter/issues/96.
 *
 * @param {import('@adguard/agtree').AnyRule} ruleNode Rule node to check.
 *
 * @returns {boolean} True if the rule should be kept as is, otherwise false.
 */
const shouldKeepAdgHtmlFilteringRuleAsIs = (ruleNode) => {
    return ruleNode.type === agtree.CosmeticRuleType.HtmlFilteringRule
        && ruleNode.syntax === agtree.AdblockSyntax.Adg
        && HTML_RULES_PSEUDO_CLASS_MARKERS.some((marker) => ruleNode.body.value.includes(marker));
};

/**
 * Excludes rule
 * @param {string} rule
 * @param {array} excluded
 * @param {string} message
 */
const excludeRule$1 = (rule, excluded, message) => {
    if (excluded) {
        excluded.push(`! ${message}`);
        excluded.push(rule);
    }
};

/**
 * Converts rules to AdGuard syntax
 *
 * @param {string[]} rulesList Input rules.
 * @param {string[]} [excluded=[]] Rules to exclude.
 * @param {string[]} [invalidRules=[]] Collected invalid rules for the report file.
 *
 * @return {string[]} Rules converted to AdGuard syntax.
 */
const convertRulesToAdgSyntax = (rulesList, excluded = [], invalidRules = []) => {
    const result = [];

    for (let i = 0; i < rulesList.length; i += 1) {
        const rule = rulesList[i];
        try {
            const ruleNode = agtree.RuleParser.parse(rule);

            // temporary workaround for AdGuard's HTML filtering rules with pseudo-classes.
            // TODO: remove during AG-24662 resolving
            if (shouldKeepAdgHtmlFilteringRuleAsIs(ruleNode)) {
                const message = `Keeping HTML filtering rule with pseudo-classes as is: "${rule}"`;
                logger.warn(message);
                result.push(rule);
                continue;
            }

            const conversionResult = agtree.RuleConverter.convertToAdg(ruleNode);
            const convertedRules = conversionResult.result.map((r) => agtree.RuleGenerator.generate(r));
            result.push(...convertedRules);

            if (conversionResult.isConverted) {
                const messagePostfix = convertedRules.length > 1
                    // eslint-disable-next-line quotes
                    ? `to multiple rules: "${convertedRules.join(", ")}"`
                    : `to: "${convertedRules[0]}"`;
                const message = `Rule "${rule}" converted ${messagePostfix}`;
                excludeRule$1(rule, excluded, message);
            }
        } catch (e) {
            // eslint-disable-next-line max-len
            const message = `Error: Unable to convert rule to AdGuard syntax: "${rule}" due to error: ${logger$1.getErrorMessage(e)}`;
            logger.error(message);
            excludeRule$1(rule, excluded, message);

            // collect the invalid rule for the report file
            invalidRules.push(message);
        }
    }

    return result;
};

const SINGLE_QUOTE = "'";
const DOUBLE_QUOTE = '"';

/**
 * Trims quotes (single or double) from the start and end of a string if they exist.
 *
 * @param {string} str - The string to trim.
 * @returns {string} The trimmed string.
 */
const trimQuotes = (str) => {
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
const convertToUbo = (rules) => {
    const modified = [];
    if (!rules) {
        return modified;
    }
    rules.forEach((rule) => {
        if (rule) {
            try {
                const ruleNode = agtree.RuleParser.parse(rule);
                // js injection rules are not supported in uBO
                if (ruleNode.type === agtree.CosmeticRuleType.JsInjectionRule) {
                    return;
                }
                if (ruleNode.type === agtree.CosmeticRuleType.ScriptletInjectionRule) {
                    const scriptletNode = ruleNode.body.children[0].children[0];
                    const scriptletNameString = trimQuotes(scriptletNode.value);

                    if (!scriptletNameString) {
                        // If the scriptlet name is missing, skip processing this rule
                        return;
                    }

                    const scriptletName = trimQuotes(scriptletNameString);

                    // TODO: move this check to AGTree AG-41266
                    if (scriptletName.startsWith(RuleMasks.MASK_TRUSTED_SCRIPTLET)) {
                        // https://github.com/AdguardTeam/Scriptlets#trusted-scriptlets-restriction
                        // does not work in other blockers
                        const message = `Trusted scriptlets should not be converted to uBO syntax. Rule: "${rule}"`;
                        logger.warn(message);
                        modified.push('');
                        return;
                    }
                }
                const conversionResult = agtree.RuleConverter.convertToUbo(ruleNode);
                const convertedRules = conversionResult.result.map((r) => agtree.RuleGenerator.generate(r));
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

/**
 * ExtendedCss is not supposed to work without window environment,
 * so we pass some wrapper dummy.
 */
// TODO: switch to aglint in compiler

global.TextEncoder = util.TextEncoder;
global.TextDecoder = util.TextDecoder;

const dom = new jsdom.JSDOM('<!DOCTYPE html><p>Empty</p>');

global.window = dom.window;
global.document = global.window.document;
if (!global.navigator) {
    global.navigator = global.window.navigator;
}
global.Element = global.window.Element;

const require$2 = module$1.createRequire((typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('index.cjs', document.baseURI).href)));
const { ExtendedCss } = require$2('@adguard/extended-css');

// TODO: in future SelectorValidationResult from ExtendedCss may be imported and used instead of it
/**
 * @typedef {Object} SelectorValidationResult
 * @property {boolean} ok selector validation status
 * @property {string|null} error reason of invalid selector for invalid selector
 * and `null` for valid one
 */

/**
 * Related to the bug — pseudo-class arg with combinators.
 *
 * @see {@link https://github.com/dperini/nwsapi/issues/55}
 *
 * @example
 * '*:not(div > span)'
 */
const VALID_PSEUDO_CLASS_COMBINATOR_ARG_REGEXP = /(.+)?:(not|is)\((.+)?(~|>|\+)(.+)?\)(.+)?/;

/**
 * Related to the bug — pseudo-class arg with parenthesis in attribute value.
 *
 * @see {@link https://github.com/dperini/nwsapi/issues/71}
 *
 * @example
 * 'div:not([right=")"])'
 * 'body *:not([left="("])'
 */
const VALID_PSEUDO_CLASS_PARENTHESIS_ARG_REGEXP = /(.+)?:(not|is)\((.+)?\[.+=("|')(.+)?(\(|\))(.+)?("|')\]\)/;

// TODO: remove backupValidate() after the bugs are fixed
/**
 * Validates `selector` by its matching with specific regular expressions due to nwsapi bugs:
 * @see {@link https://github.com/dperini/nwsapi/issues/55},
 * @see {@link https://github.com/dperini/nwsapi/issues/71}.
 *
 * @param selector Selector to validate.
 * @param originalError Previous validation error for selectors which are non-related to the bugs.
 *
 * @returns {SelectorValidationResult}
 */
const backupValidate = (selector, originalError) => {
    const isValidArgBugRelated = VALID_PSEUDO_CLASS_COMBINATOR_ARG_REGEXP.test(selector)
        || VALID_PSEUDO_CLASS_PARENTHESIS_ARG_REGEXP.test(selector);
    // if selector is not matched by the regexp specific to the bug
    // original validate error should be returned
    if (!isValidArgBugRelated) {
        return { ok: false, error: originalError };
    }
    return { ok: true, error: null };
};

/**
 * Validates css selector, uses ExtendedCss.validate() for it.
 *
 * @param selectorText
 *
 * @returns {SelectorValidationResult}
 */
const validateCssSelector = (selectorText) => {
    // jsdom is crashing when selector is a script
    if (selectorText.indexOf('##script:contains') !== -1
        || selectorText.indexOf('##script:inject') !== -1) {
        return {
            ok: false,
            error: 'Selector as a script is not supported.',
        };
    }

    // skip :before and :after selectors
    if (selectorText.match(/[^:\s]([:]{1,2}before(\s|,|$))|[^:\s]([:]{1,2}after(\s|,|$))/ig)) {
        return {
            ok: true,
            error: null,
        };
    }

    // skip selectors with case-insensitive attribute, for example: div[class^="Abc_123" i]
    if (selectorText.match(/\[[a-z\d-_]+[\^$*]?=['"]?[^'"]+['"]?\si]/g)) {
        return {
            ok: true,
            error: null,
        };
    }

    let validation = ExtendedCss.validate(selectorText);
    // TODO: remove later when the bug is fixed
    // https://github.com/dperini/nwsapi/issues/55
    // ExtendedCss.validate() should be enough for selector validation
    if (!validation.ok) {
        validation = backupValidate(selectorText, validation.error);
    }
    return validation;
};

/**
 * @typedef {import('@adguard/agtree').AnyRule} AnyRule
 */

const AFFINITY_DIRECTIVE = '!#safari_cb_affinity'; // used as closing directive
const AFFINITY_DIRECTIVE_OPEN = `${AFFINITY_DIRECTIVE}(`;

const NOT_VALIDATE_HINT = 'NOT_VALIDATE';
const SPACE$1 = ' ';

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
        if (!agtree.RegExpUtils.isRegexPattern(pattern)) {
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
     * @param {string} [ruleText] Pre-generated rule text.
     * If not provided, generated from rule node.
     *
     * @returns {ValidationResult} Validation result.
     */
    static validate(ruleNode, ruleText) {
        if (ruleNode.category === agtree.RuleCategory.Invalid) {
            return RuleValidator.createValidationResult(
                false,
                ruleNode.error.message,
            );
        }

        if (ruleNode.category === agtree.RuleCategory.Empty || ruleNode.category === agtree.RuleCategory.Comment) {
            return RuleValidator.createValidationResult(true);
        }

        const text = ruleText ?? agtree.RuleGenerator.generate(ruleNode);

        try {
            // Validate cosmetic rules
            if (ruleNode.category === agtree.RuleCategory.Cosmetic) {
                // eslint-disable-next-line no-new
                new tsurlfilter.CosmeticRule(text, 0);
                return RuleValidator.createValidationResult(true);
            }

            // Validate network rules
            const rule = new tsurlfilter.NetworkRule(text, 0);
            RuleValidator.validateRegexp(rule.getPattern(), text);
        } catch (error) {
            // TODO: add getErrorMessage as a helper
            const message = error instanceof Error ? error.message : String(error);
            const errorMessage = `Error: "${message}" in the rule: "${text}"`;
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
    ecssTree.parse(input, {
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
const validateAndFilterRules = (list, excluded, invalid = [], filterName) => {
    if (!list) {
        return [];
    }

    return list.filter((ruleText, index, array) => {
        if (agtree.CommentParser.isCommentRule(ruleText)) {
            return true;
        }

        const previousRule = index > 0 ? array[index - 1] : null;
        // Skip validation if "ruleText" is preceded by "NOT_VALIDATE" hint
        // https://github.com/AdguardTeam/FiltersCompiler/issues/245
        if (
            previousRule
            && previousRule.startsWith(RuleMasks.MASK_HINT)
            && (
                previousRule.includes(`${SPACE$1}${NOT_VALIDATE_HINT}${SPACE$1}`)
                || previousRule.endsWith(`${SPACE$1}${NOT_VALIDATE_HINT}`)
            )

        ) {
            return true;
        }

        let convertedRuleNodes;
        try {
            const ruleNode = agtree.RuleParser.parse(ruleText, {
                ...parser.defaultParserOptions,
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

            const conversionResult = agtree.RuleConverter.convertToAdg(ruleNode);
            convertedRuleNodes = conversionResult.result;
            // eslint-disable-next-line no-restricted-syntax
            for (const convertedRuleNode of convertedRuleNodes) {
                if (convertedRuleNode.category !== agtree.RuleCategory.Cosmetic) {
                    continue;
                }
                switch (convertedRuleNode.type) {
                    case agtree.CosmeticRuleType.ElementHidingRule: {
                        validateCssContext(convertedRuleNode.body.selectorList.value, 'selectorList');
                        break;
                    }
                    case agtree.CosmeticRuleType.CssInjectionRule: {
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
            const message = `Error: Invalid rule in ${filterName}: "${ruleText}" due to error: ${logger$1.getErrorMessage(e)}`;
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
            const convertedRuleText = agtree.RuleGenerator.generate(convertedRuleNode);

            let validationResult = RuleValidator.validate(convertedRuleNode, convertedRuleText);

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

            const rule = tsurlfilter.RuleFactory.createRule(convertedRuleText);

            // It is impossible to bundle jsdom into tsurlfilter, so we check if rules are valid in the compiler
            if (rule instanceof tsurlfilter.CosmeticRule && rule.getType() === agtree.CosmeticRuleType.ElementHidingRule) {
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
const checkAffinityDirectives = (lines) => {
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

/* eslint-disable global-require */

const require$1 = module$1.createRequire((typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('index.cjs', document.baseURI).href)));

/**
 * Some sources require proper user-agents and forbid downloading without.
 */
const USER_AGENT = 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko)'
    + 'Chrome/63.0.3239.132 Mobile Safari/537.36';

/**
 * Sync downloads file from url
 *
 * @param url
 * @param {number} [retryNum=0] number of times to retry downloading, defaults to 0
 * @returns {*}
 */
const tryDownloadFile = function (url, retryNum = 0) {
    let args = ['--fail', '--silent', '--user-agent', USER_AGENT, '-L', url];
    if (retryNum) {
        args.push('--retry');
        args.push(retryNum);
    }
    const options = { encoding: 'utf8', maxBuffer: Infinity };
    const tlsCheck = process.env.TLS;
    if (tlsCheck === 'insecure') {
        args = ['--insecure'].concat(args);
    }
    return require$1('child_process')
        .execFileSync('curl', args, options);
};

/**
 * Sync downloads file from url with two attempts
 *
 * @param url
 * @returns {*}
 */
const downloadFile = (url) => {
    logger.info(`Downloading: ${url}`);

    // 5 times to retry after first fail attempt:
    // 1 sec for first time, double for every forthcoming attempts
    // so it will take: 1 + 2 + 4 + 8 + 16 = 31 seconds
    // https://curl.se/docs/manpage.html#--retry
    const RETRY_NUM = 5;

    try {
        return tryDownloadFile(url);
    } catch (e) {
        logger.warn(e);
        logger.warn(`Retry downloading: ${url}`);
        return tryDownloadFile(url, RETRY_NUM);
    }
};

/* eslint-disable global-require */

// Here we can access optimizable filters and its optimization percentages
const OPTIMIZATION_PERCENT_URL = 'https://chrome.adtidy.org/optimization_config/percent.json';

const downloadOptimizationPercent = () => downloadFile(OPTIMIZATION_PERCENT_URL);

const downloadOptimizationStats = (filterId) => {
    const optimizationStatsUrl = `https://chrome.adtidy.org/filters/${filterId}/stats.json?key=4DDBE80A3DA94D819A00523252FB6380`;

    return downloadFile(optimizationStatsUrl);
};

let filtersOptimizationPercent = null;

let localOptimizationConfigPath = null;

const optimizationConfigLocal = {
    setPath: (path) => {
        localOptimizationConfigPath = path;
    },
    generate: async (filePath) => {
        const percentContent = await downloadOptimizationPercent();

        await fs$1.promises.mkdir(path$1.dirname(filePath), { recursive: true });
        await fs$1.promises.writeFile(filePath, percentContent, 'utf-8');
    },
};

/**
 * Downloads and caches filters optimization percentages configuration
 */
const getFiltersOptimizationPercent = () => {

    if (filtersOptimizationPercent === null) {
        const content = localOptimizationConfigPath
            ? fs$1.readFileSync(localOptimizationConfigPath, 'utf-8')
            : downloadOptimizationPercent();

        filtersOptimizationPercent = JSON.parse(content);
    }

    if (filtersOptimizationPercent.config.length === 0) {
        // eslint-disable-next-line no-throw-literal
        throw 'Invalid configuration';
    }

    return filtersOptimizationPercent;
};

/**
 * Downloads filter optimization config for the filter
 */
const getFilterOptimizationConfig = (filterId) => {

    // config: [{filterId: 1, percent: 45}, ...]
    const filterOptimizationPercent = getFiltersOptimizationPercent().config
        .find((config) => config.filterId === filterId);

    let optimizationConfig = null;
    if (filterOptimizationPercent) {
        const content = downloadOptimizationStats(filterId);

        optimizationConfig = JSON.parse(content);
        if (!optimizationConfig || !optimizationConfig.groups || optimizationConfig.groups.length === 0) {
            throw new Error(`Unable to retrieve optimization stats for ${filterId}`);
        }
    }

    return optimizationConfig;
};

/**
 * Checks if rule should be skipped, because optimization is enabled for this filter
 * and hits of this rule is lower than some value
 * @param ruleText Rule text
 * @param optimizationConfig Optimization config for this filter (retrieved with getFilterOptimizationConfig)
 */
const skipRuleWithOptimization = (ruleText, optimizationConfig) => {
    if (!optimizationConfig) {
        return false;
    }

    // eslint-disable-next-line no-restricted-syntax
    for (const group of optimizationConfig.groups) {
        const hits = group.rules[ruleText];
        if (hits !== undefined && hits < group.config.hits) {
            return true;
        }
    }

    return false;
};

/**
 * @typedef {object} OptimizationConfig
 * @property {number} filterId - Filter identifier
 * @property {number} percent - Expected optimization percent
 * `~= (rules count in optimized filter) / (rules count in original filter) * 100`
 * @property {number} minPercent - Lower bound of `percent` value
 * @property {number} maxPercent - Upper bound of `percent` value
 * @property {boolean} strict - If `percent < minPercent || percent  > maxPercent`
 * and strict mode is on then filter compilation should fail, otherwise original rules must be used
 */


const HINT_MASK = `${RuleMasks.MASK_HINT} `;
const COMMENT_REGEXP = '^\\!($|[^#])';

const PLATFORM_HINT_REGEXP = /(^| )PLATFORM\(([^)]+)\)/g;
const NOT_PLATFORM_HINT_REGEXP = /(.*)NOT_PLATFORM\(([^)]+)\)/g;

const NOT_OPTIMIZED_HINT$1 = 'NOT_OPTIMIZED';

/**
 * Parses rule hints
 *
 * @param rules rules
 * @param platform Platform
 */
const splitRuleHintLines = function (rules, platform) {
    const result = [];
    if (rules) {
        for (let i = 0; i < rules.length; i += 1) {
            let rule = rules[i].trim();
            if (rule.startsWith(HINT_MASK)) {
                continue;
            }

            rule = overrideRule(rule, platform);

            const hint = i > 0 ? rules[i - 1] : null;
            result.push({
                rule,
                hint: (hint && hint.startsWith(HINT_MASK)) ? hint : null,
            });
        }
    }

    return result;
};

/**
 * Joins hint rules
 *
 * @param hintLines
 * @returns {Array}
 */
const joinRuleHintLines = function (hintLines) {
    const result = [];
    hintLines.forEach((f) => {
        if (f.hint) {
            result.push(f.hint);
        }
        result.push(f.rule);
    });

    return result;
};

/**
 * Parses platforms by pattern
 *
 *
 * @param hint    stripped hint
 * @param pattern regexp
 */
const parsePlatforms = function (hint, pattern) {
    const result = [];

    if (!hint) {
        return result;
    }

    let match = pattern.exec(hint);
    while (match !== null) {
        const group = match[2];
        const split = group.split(',');
        // eslint-disable-next-line no-restricted-syntax
        for (let s of split) {
            s = s.trim();
            result.push(s);
        }

        match = pattern.exec(hint);
    }

    return result;
};

/**
 * Is rule supported with platform hint
 *
 * @param rule
 * @param platform
 */
const isPlatformSupported = function (rule, platform) {
    const { hint } = rule;
    if (!hint || !hint.startsWith(HINT_MASK)) {
        return true;
    }

    if (!platform) {
        return true;
    }

    const stripped = hint.substring(HINT_MASK.length).trim();

    const supportedPlatforms = parsePlatforms(stripped, PLATFORM_HINT_REGEXP);
    const unsupportedPlatforms = parsePlatforms(stripped, NOT_PLATFORM_HINT_REGEXP);

    const supported = supportedPlatforms.length === 0 || supportedPlatforms.indexOf(platform) >= 0;
    const unsupported = unsupportedPlatforms.length > 0 && unsupportedPlatforms.indexOf(platform) >= 0;

    return supported && !unsupported;
};

/**
 * Checks if rule supports optimization
 *
 * @param rule
 * @returns {boolean}
 */
const isOptimizationSupported = function (rule) {
    const { hint } = rule;
    if (!hint || !hint.startsWith(HINT_MASK)) {
        return true;
    }

    const stripped = hint.substring(HINT_MASK.length).trim();

    return !stripped.includes(NOT_OPTIMIZED_HINT$1);
};

/**
 * Checks if rule should be omitted with specified configuration
 *
 * @param rule
 * @param config
 * @param filterId
 * @returns {boolean}
 */
const shouldOmitRule = function (rule, config, filterId) {
    const ruleText = rule.rule;

    if (!ruleText) {
        return true;
    }

    // Omit rules by filtration settings
    if (!config.configuration.ignoreRuleHints && !isPlatformSupported(rule, config.platform)) {
        logger.info(`${ruleText} removed with platform hint ${rule.hint}`);
        return true;
    }

    if (config.configuration.removeRulePatterns) {
        // eslint-disable-next-line no-restricted-syntax
        for (const pattern of config.configuration.removeRulePatterns) {
            if (ruleText.match(new RegExp(pattern))) {
                // eslint-disable-next-line max-len
                logger.info(`${ruleText} removed with removeRulePattern ${pattern} in filter ${filterId} for ${config.platform} platform`);
                return true;
            }
        }
    }

    return false;
};

/**
 * Checks if rule should be omitted with specified configuration
 *
 * @param ruleLine
 * @param {OptimizationConfig} optimizationConfig
 */
const shouldOmitRuleWithOptimization = function (ruleLine, optimizationConfig) {
    const ruleText = ruleLine.rule;

    if (!ruleText) {
        return true;
    }

    if (!isOptimizationSupported(ruleLine)) {
        return false;
    }

    return skipRuleWithOptimization(ruleText, optimizationConfig);
};

/**
 * We want to be sure that our mobile optimization is correct and didn't remove valuable rules
 *
 * @param filterId
 * @param rules
 * @param optimizedRules
 * @param {OptimizationConfig} optimizationConfig
 */
const isOptimizationCorrect = function (filterId, rules, optimizedRules, optimizationConfig) {
    const filterRulesCount = rules.length;
    const optimizedRulesCount = optimizedRules.length;

    // do not count decimal part of number
    const resultOptimizationPercent = Math.floor((optimizedRulesCount / filterRulesCount) * 100);

    const expectedOptimizationPercent = optimizationConfig.percent;
    const minOptimizationPercent = optimizationConfig.minPercent;
    const maxOptimizationPercent = optimizationConfig.maxPercent;
    const { strict } = optimizationConfig;

    const tooLow = resultOptimizationPercent < minOptimizationPercent;
    const tooHigh = resultOptimizationPercent > maxOptimizationPercent;

    const incorrect = tooLow || tooHigh;

    if (incorrect) {
        const message = `Unable to optimize filter ${filterId} with configuration`
            + `[~=${expectedOptimizationPercent}%, min=${minOptimizationPercent}%, max=${maxOptimizationPercent}%],`
            + `calculated = ${resultOptimizationPercent.toFixed(2)}%! `
            + `Filter rules count: ${filterRulesCount}. Optimized rules count: ${optimizedRulesCount}.`;
        if (strict) {
            throw new Error(message);
        } else {
            logger.error(message);
        }
    }

    logger.info(`Filter ${filterId} optimization: ${filterRulesCount} => ${optimizedRulesCount},`
        + `${expectedOptimizationPercent}% => ${resultOptimizationPercent}%.`);

    return !incorrect;
};

/**
 * Filters set of rules with configuration
 *
 * @param rules
 * @param filterId
 * @param config
 */
const cleanupRules = (rules, config, filterId) => {
    const ruleLines = splitRuleHintLines(rules, config.platform);

    const filtered = ruleLines.filter((r) => !shouldOmitRule(r, config, filterId));

    return joinRuleHintLines(filtered);
};

/**
 * Filters set of rules with configuration and optimization
 *
 * @param rules
 * @param config
 * @param {OptimizationConfig} optimizationConfig
 * @param filterId
 */
const cleanupAndOptimizeRules = function (rules, config, optimizationConfig, filterId) {
    config.configuration.removeRulePatterns = config.configuration.removeRulePatterns || [];
    config.configuration.removeRulePatterns.push(COMMENT_REGEXP);

    const ruleLines = splitRuleHintLines(rules, config.platform);

    const filtered = ruleLines.filter((r) => !shouldOmitRule(r, config, filterId));

    const optimized = filtered.filter((r) => !shouldOmitRuleWithOptimization(r, optimizationConfig));

    let result;
    // We check that our optimization is correct and didn't remove valuable rules
    // We do it via comparing expected optimization percent
    // with real (ratio between optimized rules number and all rules number)
    if (optimizationConfig && !isOptimizationCorrect(filterId, filtered, optimized, optimizationConfig)) {
        // Back to default OPTIMIZATION
        result = joinRuleHintLines(filtered);
    } else {
        result = joinRuleHintLines(optimized);
    }

    config.configuration.removeRulePatterns.pop();
    return result;
};

/* eslint-disable global-require */

const __dirname$4 = path$1.dirname(url.fileURLToPath((typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('index.cjs', document.baseURI).href))));

const RULES_SEPARATOR = '\r\n';
let filterIdsPool = [];
let metadataFilterIdsPool = [];

const OPTIMIZED_PLATFORMS_LIST = ['ext_safari', 'android', 'ios'];

const PLATFORM_FILTERS_DIR = 'filters';
const FILTERS_METADATA_FILE_JSON = 'filters.json';
const FILTERS_I18N_METADATA_FILE_JSON = 'filters_i18n.json';

// AG-20175
const FILTERS_METADATA_FILE_JS = 'filters.js';
const FILTERS_I18N_METADATA_FILE_JS = 'filters_i18n.js';

/**
 * Tag id for obsolete filters.
 *
 * @see {@link https://github.com/AdguardTeam/FiltersRegistry/blob/85f2e9f6f5f7c04797017e713dc5986b22a78840/tags/metadata.json#L184}
 */
const OBSOLETE_TAG_ID = 46;

/**
 * From 1 to 99 we have AdGuard filters
 *
 * @type {number}
 */
const LAST_ADGUARD_FILTER_ID = 99;
const LOCAL_SCRIPT_RULES_FILE = 'local_script_rules.txt';
const LOCAL_SCRIPT_RULES_FILE_JSON = 'local_script_rules.json';

const LOCAL_SCRIPT_RULES_COMMENT = 'By the rules of AMO and addons.opera.com we cannot use remote scripts'
    + '(and our JS injection rules could be counted as remote scripts).\r\n'
    + 'So what we do:\r\n'
    + '1. We gather all current JS rules in the DEFAULT_SCRIPT_RULES object'
    + '(see lib/utils/local-script-rules.js)\r\n'
    + '2. We disable JS rules got from remote server\r\n'
    + '3. We allow only custom rules got from the User filter (which user creates manually)'
    + 'or from this DEFAULT_SCRIPT_RULES object';

const ONE_HOUR_SEC = 60 * 60;
const ONE_DAY_SEC = 24 * ONE_HOUR_SEC;

/**
 * Default value of filter expiration time
 * if impossible to parse a value specified in platforms.json or in filter metadata.
 *
 * Defaults to 1 day (or 86400 in seconds).
 */
const DEFAULT_EXPIRES_SEC = 1 * ONE_DAY_SEC;

/**
 * Platforms configurations
 */
let platformPathsConfig = null;
let filterFile = null;
let metadataFile = null;
let revisionFile = null;
let adguardFiltersServerUrl = null;

/**
 * Sync reads file content
 *
 * @param path
 * @returns {*}
 */
const readFile$2 = function (path) {
    try {
        return fs$1.readFileSync(path, { encoding: 'utf-8' });
    } catch (e) {
        return null;
    }
};

/**
 * Creates header contents
 *
 * @param metadataFile
 * @param revisionFile
 * @param platformsJsonExpires
 * @returns {[*,*,*,*,string]}
 */
const makeHeader = function (metadataFile, revisionFile, platformsJsonExpires) {
    const metadataString = readFile$2(metadataFile);
    if (!metadataString) {
        throw new Error('Error reading metadata');
    }

    const metadata = JSON.parse(metadataString);

    const revisionString = readFile$2(revisionFile);
    if (!revisionString) {
        throw new Error('Error reading revision');
    }

    const revision = JSON.parse(revisionString);

    const expires = typeof platformsJsonExpires !== 'undefined'
        ? platformsJsonExpires
        : metadata.expires;

    return [
        `! Title: ${metadata.name}`,
        `! Description: ${metadata.description}`,
        `! Version: ${revision.version}`,
        `! TimeUpdated: ${moment(revision.timeUpdated).format()}`,
        `! Expires: ${expires} (update frequency)`,
    ];
};

/**
 * Strips spec character from end of string
 *
 * @param string
 * @param char
 */
const stripEnd = function (string, char) {
    if (string.endsWith(char)) {
        return stripEnd(string.substring(0, string.length - 1), char);
    }
    return string;
};

/**
 * Checks if filter id is unique
 *
 * @param pool
 * @param filterId
 */
const checkFilterId = function (pool, filterId) {
    if (pool.indexOf(filterId) >= 0) {
        throw new Error(`Invalid filters: Filter identifier is not unique: ${filterId}`);
    }

    pool.push(filterId);
};

/**
 * Replaces newlines
 *
 * @param message
 * @returns {XML|string|*}
 */
const normalizeData = function (message) {
    message = message.replace(/\r/g, '');
    message = message.replace(/\n+/g, '\n');
    return message;
};

/**
 * Calculates checksum
 * See:
 * https://adblockplus.org/en/filters#special-comments
 * https://hg.adblockplus.org/adblockplus/file/tip/addChecksum.py
 *
 * @param header Header lines
 * @param rules  Rules lines
 */
const calculateChecksum = function (header, rules) {
    let content = header.concat(rules).join('\n');
    content = normalizeData(content);
    const checksum = crypto.createHash('md5').update(content).digest('base64');

    return `! Checksum: ${stripEnd(checksum.trim(), '=')}`;
};

/**
 * This will create a dir given a path such as './folder/subfolder'
 * @param {string} dir - The path of the directory to create. Can be absolute or relative.
 * @returns {string} The path of the last directory created or the existing directory.
 * @throws {Error} Throws an error if there is a permission issue or if the directory cannot be created.
 */
const createDir = (dir) => {
    const { sep } = path$1;
    const initDir = path$1.isAbsolute(dir) ? sep : '';
    // eslint-disable-next-line no-undef
    const baseDir = __dirname$4;

    return dir.split(sep).reduce((parentDir, childDir) => {
        const curDir = path$1.resolve(baseDir, parentDir, childDir);
        try {
            fs$1.mkdirSync(curDir);
        } catch (err) {
            if (err.code === 'EEXIST') { // curDir already exists!
                return curDir;
            }

            // To avoid `EISDIR` error on Mac and `EACCES`-->`ENOENT` and `EPERM` on Windows.
            if (err.code === 'ENOENT') { // Throw the original parentDir error on curDir `ENOENT` failure.
                throw new Error(`EACCES: permission denied, mkdir '${parentDir}'`);
            }

            const caughtErr = ['EACCES', 'EPERM', 'EISDIR'].indexOf(err.code) > -1;
            if ((!caughtErr || caughtErr) && (curDir === path$1.resolve(dir))) {
                throw err; // Throw if it's just the last created dir.
            }
        }

        return curDir;
    }, initDir);
};

/**
 * Replaces tag keywords in the provided filters with their corresponding tag IDs.
 *
 * @param {Array<Object>} rawFilters - The array of filter objects to process.
 * @param {Array<Object>} tags - The array of tag objects.
 * @returns {Array<Object>} A new array of filter objects with tag keywords replaced by their corresponding tag IDs.
 * @throws {Error} If any tag keyword in the filters does not have a corresponding tag in the `tags` array.
 */
const replaceTagKeywords = function (rawFilters, tags) {
    const tagsMap = new Map();

    tags.forEach((tag) => {
        tagsMap.set(tag.keyword, tag.tagId);
    });

    // create new variable to avoid mutation of input parameters
    const filters = [];
    const lostTags = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const filter of rawFilters) {
        const newFilter = { ...filter };
        if (newFilter.tags) {
            const ids = [];
            // eslint-disable-next-line no-restricted-syntax
            for (const t of newFilter.tags) {
                const id = tagsMap.get(t);
                if (id) {
                    ids.push(id);
                } else {
                    logger.error(`Missing tag with keyword: ${t}`);
                    lostTags.push(t);
                }
            }

            delete newFilter.tags;
            newFilter.tags = ids;
        }
        filters.push(newFilter);
    }

    if (lostTags.length > 0) {
        throw new Error(`Missing tag with keyword: ${lostTags.join(', ')}`);
    }

    return filters;
};

/**
 * Converts `rawExpires` with `day` marker into **seconds**.
 *
 * @param {any} rawExpires Raw `expires` value from filter metadata or platforms.json.
 *
 * @returns {number} Parsed expires value from days to seconds,
 * or {@link DEFAULT_EXPIRES_SEC} if it cannot be parsed.
 */
const convertExpiresDaysToSeconds = (rawExpires) => {
    const expiresDays = parseInt(rawExpires, 10);
    if (Number.isNaN(expiresDays)) {
        return DEFAULT_EXPIRES_SEC;
    }
    return expiresDays * ONE_DAY_SEC;
};

/**
 * Converts `rawExpires` with `hour` marker into **seconds**.
 *
 * @param {any} rawExpires Raw `expires` value from filter metadata or platforms.json.
 *
 * @returns {number} Parsed expires value from hours to seconds,
 * or {@link DEFAULT_EXPIRES_SEC} if it cannot be parsed.
 */
const convertExpiresHoursToSeconds = (rawExpires) => {
    const expiresHours = parseInt(rawExpires, 10);
    if (Number.isNaN(expiresHours)) {
        return DEFAULT_EXPIRES_SEC;
    }
    return expiresHours * ONE_HOUR_SEC;
};

/**
 * Overrides filter metadata `expires` property with platforms.json's `expires` property.
 *
 * Then parses the value and converts it to **seconds**.
 * If it cannot be parsed or not set at all, the default value {@link DEFAULT_EXPIRES_SEC} is used.
 *
 * @example
 * `12 hours` → 43200
 * `1 day`    → 86400
 * `2 days`   → 172800
 *
 * @param rawFilters Input filters' metadata.
 * @param platformsJsonExpires Platforms.json's `expires` property to override filters' `expires`.
 *
 * @returns {Array<object>} Updated filters' metadata with `expires` property in **seconds**.
 */
const replaceExpires = function (rawFilters, platformsJsonExpires) {
    const filters = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const filter of rawFilters) {
        // do not mutate input parameters
        const newFilter = { ...filter };
        // expires value which is set in platforms.json has higher priority
        // https://github.com/AdguardTeam/FiltersCompiler/issues/198
        if (typeof platformsJsonExpires !== 'undefined') {
            newFilter.expires = platformsJsonExpires;
        }

        if (newFilter.expires) {
            if (newFilter.expires.indexOf('day') > 0) {
                newFilter.expires = convertExpiresDaysToSeconds(newFilter.expires);
            } else if (newFilter.expires.indexOf('hour') > 0) {
                newFilter.expires = convertExpiresHoursToSeconds(newFilter.expires);
            }
        } else {
            // use default value if 'expires' is not set either in platforms.json or in filter metadata
            newFilter.expires = DEFAULT_EXPIRES_SEC;
        }
        filters.push(newFilter);
    }

    return filters;
};

/**
 * First step of processing filters metadata
 *
 * @param filtersMetadata
 */
const processFiltersFromMetadata = function (filtersMetadata) {
    // do not mutate input parameters
    const filters = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const filter of filtersMetadata) {
        const newFilter = {
            ...filter,
            deprecated: Boolean(filter.deprecated),
        };

        /**
         * In case of backward compatibility
         * Adds 'languages' metadata field parsed from 'lang:' tags
         */
        if (newFilter.tags) {
            const filterLanguages = [];
            let hasRecommended = false;
            // eslint-disable-next-line no-restricted-syntax
            for (const t of newFilter.tags) {
                if (!hasRecommended && t === 'recommended') {
                    hasRecommended = true;
                }

                if (t.startsWith('lang:')) {
                    filterLanguages.push(t.substring(5));
                }
            }

            // Languages will be added for recommended filters only
            newFilter.languages = hasRecommended ? filterLanguages : [];
        }

        filters.push(newFilter);
    }

    return filters;
};

/**
 * Does several things with filters URLs:
 * 1. Rewrites subscription urls for specified platform config
 * 2. Adds downloadUrl field to the filter
 *
 * @param metadata
 * @param config
 */
const postProcessUrls = (metadata, config) => {
    const useOptimized = OPTIMIZED_PLATFORMS_LIST.indexOf(config.platform) >= 0;

    const result = {};

    result.groups = metadata.groups.slice(0);
    result.tags = metadata.tags.slice(0);
    result.filters = [];

    const platformPath = config.path;
    // eslint-disable-next-line no-restricted-syntax
    for (const f of metadata.filters) {
        const fileName = `${f.filterId}${useOptimized ? '_optimized' : ''}.txt`;
        const downloadUrl = `${adguardFiltersServerUrl}${platformPath}/filters/${fileName}`;

        const copy = { ...f, downloadUrl };

        if (copy.subscriptionUrl && copy.subscriptionUrl.startsWith(adguardFiltersServerUrl)) {
            copy.subscriptionUrl = downloadUrl;
        }

        result.filters.push(copy);
    }

    return result;
};

/**
 * Removes redundant metadata for included or excluded filters for the current platform
 *
 * @param metadata
 * @param platform
 *
 * @returns {object} Metadata with filtered `filters` array due to the `platform`.
 */
const removeRedundantFiltersMetadata = (metadata, platform) => {
    // leaves only included filters metadata
    metadata.filters = metadata.filters.filter((filter) => !filter.platformsIncluded
        || (filter.platformsIncluded && filter.platformsIncluded.includes(platform)));
    // removes excluded filters metadata
    metadata.filters = metadata.filters.filter((filter) => !filter.platformsExcluded
        || (filter.platformsExcluded && !filter.platformsExcluded.includes(platform)));

    return metadata;
};

/**
 * Parses object info
 * Splits string {mask}{id}.{message} like "group.1.name" etc.
 *
 * @param string
 * @param mask
 * @returns {{id: *, message: *}}
 */
const parseInfo = (string, mask) => {
    const searchIndex = string.indexOf(mask) + mask.length;

    return {
        id: string.substring(searchIndex, string.indexOf('.', searchIndex)),
        message: string.substring(string.lastIndexOf('.') + 1),
    };
};

/**
 * Loads locale data from a specified directory and organizes it into groups, tags, and filters.
 *
 * @param {string} dir - The directory containing locale subdirectories with JSON files.
 * @returns {Object} An object containing the loaded locale data.
 */
const loadLocales = function (dir) {
    const result = {
        groups: {},
        tags: {},
        filters: {},
    };

    const locales = fs$1.readdirSync(dir);
    // eslint-disable-next-line no-restricted-syntax
    for (const directory of locales) {
        const localeDir = path$1.join(dir, directory);
        if (fs$1.lstatSync(localeDir).isDirectory()) {
            const groups = JSON.parse(readFile$2(path$1.join(localeDir, 'groups.json')));
            if (groups) {
                // eslint-disable-next-line no-restricted-syntax
                for (const group of groups) {
                    // eslint-disable-next-line guard-for-in,no-restricted-syntax
                    for (const p in group) {
                        const info = parseInfo(p, 'group.');
                        if (!info || !info.id) {
                            continue;
                        }

                        const { id } = info;
                        result.groups[id] = result.groups[id] || {};
                        result.groups[id][directory] = result.groups[id][directory] || {};
                        result.groups[id][directory][info.message] = group[p];
                    }
                }
            }

            const tags = JSON.parse(readFile$2(path$1.join(localeDir, 'tags.json')));
            if (tags) {
                // eslint-disable-next-line no-restricted-syntax
                for (const tag of tags) {
                    // eslint-disable-next-line guard-for-in,no-restricted-syntax
                    for (const p in tag) {
                        const info = parseInfo(p, 'tag.');
                        if (!info || !info.id) {
                            continue;
                        }

                        const { id } = info;
                        result.tags[id] = result.tags[id] || {};
                        result.tags[id][directory] = result.tags[id][directory] || {};
                        result.tags[id][directory][info.message] = tag[p];
                    }
                }
            }

            const filters = JSON.parse(readFile$2(path$1.join(localeDir, 'filters.json')));
            if (filters) {
                // eslint-disable-next-line no-restricted-syntax
                for (const filter of filters) {
                    // eslint-disable-next-line guard-for-in,no-restricted-syntax
                    for (const p in filter) {
                        const info = parseInfo(p, 'filter.');
                        if (!info || !info.id) {
                            continue;
                        }

                        const { id } = info;
                        result.filters[id] = result.filters[id] || {};
                        result.filters[id][directory] = result.filters[id][directory] || {};
                        result.filters[id][directory][info.message] = filter[p];
                    }
                }
            }
        }
    }

    return result;
};

/**
 * Excludes obsolete filters data from localizations
 * @param {object} localizationsFilters
 * @param {array} obsoleteFilters
 * @return {object} result
 */
const excludeObsoleteFilters = (localizationsFilters, obsoleteFilters) => {
    const result = { ...localizationsFilters };
    obsoleteFilters.forEach((filter) => {
        delete result[filter.filterId];
    });
    return result;
};

/**
 * Removes obsolete filters metadata
 * @param {object} metadata
 * @return {object} result
 */
const removeObsoleteFilters = (metadata) => {
    const result = { ...metadata };
    result.filters = metadata.filters.filter((filter) => !filter.tags.includes(OBSOLETE_TAG_ID));
    return result;
};

/**
 * Sorts metadata's filters by `filterId` property.
 *
 * @param {object} metadata Metadata to sort filters for.
 * @returns {object} Metadata with sorted filters.
 */
const sortMetadataFilters = (metadata) => {
    const result = { ...metadata };
    result.filters.sort((a, b) => a.filterId - b.filterId);
    return result;
};

/**
 * Checks whether the filter should be built for the specified platform.
 *
 * @param {object} metadata Filter metadata.
 * @param {string} platform Platform.
 *
 * @returns True if
 * - both `platformsIncluded` and `platformsExcluded` properties are not defined in the `metadata`,
 * - `platformsExcluded` does not contain the specified `platform`,
 * - `platformsIncluded` contains the specified `platform`.
 *
 * @throws An error if both `platformsIncluded` and `platformsExcluded` are defined.
 */
const shouldBuildFilterForPlatform = (metadata, platform) => {
    const { filterId, platformsExcluded, platformsIncluded } = metadata;

    if (platformsExcluded && platformsIncluded) {
        let errorMessage = 'Both platformsIncluded and platformsExcluded cannot be defined simultaneously';
        if (filterId) {
            errorMessage += ` for filter ${filterId}`;
        }
        throw new Error(errorMessage);
    }

    if (platformsExcluded && platformsExcluded.includes(platform)) {
        return false;
    }

    if (!platformsIncluded) {
        return true;
    }

    return platformsIncluded.includes(platform);
};

/**
 * Removes group descriptions from the input groups.
 *
 * @param {Object} inputGroups Input groups metadata.
 * @returns {Object} Output groups metadata.
 */
const removeGroupDescriptions = (inputGroups) => {
    const result = {};
    Object.keys(inputGroups).forEach((groupId) => {
        result[groupId] = {};

        Object.keys(inputGroups[groupId]).forEach((locale) => {
            const localeData = inputGroups[groupId][locale];
            const cleanedLocaleData = { ...localeData };

            if (cleanedLocaleData.description) {
                delete cleanedLocaleData.description;
            }

            result[groupId][locale] = cleanedLocaleData;
        });
    });

    return result;
};

/**
 * Writes filters metadata and localizations for different platforms.
 *
 * @param {string} platformsPath - The base path where platform-specific directories are located.
 * @param {string} filtersDir - The directory containing filters metadata and related files.
 * @param {Array<Object>} filtersMetadata - The metadata for filters to be processed.
 * @param {Array<string>} obsoleteFilters - A list of obsolete filters to be excluded.
 *
 * @returns {void}
 * @throws {Error} If reading or parsing metadata files fails.
 */
const writeFiltersMetadata = function (platformsPath, filtersDir, filtersMetadata, obsoleteFilters) {
    logger.info('Writing filters metadata');

    const groups = JSON.parse(readFile$2(path$1.join(filtersDir, '../groups', 'metadata.json')));
    if (!groups) {
        logger.error('Error reading groups metadata');
        return;
    }

    const tags = JSON.parse(readFile$2(path$1.join(filtersDir, '../tags', 'metadata.json')));
    if (!tags) {
        logger.error('Error reading tags metadata');
        return;
    }

    // do not mutate input parameters
    const parsedLangTagsFiltersMetadata = processFiltersFromMetadata(filtersMetadata);
    const replacedTagKeywordsFiltersMetadata = replaceTagKeywords(parsedLangTagsFiltersMetadata, tags);

    const localizations = loadLocales(path$1.join(filtersDir, '../locales'));

    // eslint-disable-next-line guard-for-in,no-restricted-syntax
    for (const platform in platformPathsConfig) {
        const config = platformPathsConfig[platform];
        const platformDir = path$1.join(platformsPath, config.path);
        createDir(platformDir);

        logger.info(`Writing filters metadata: ${config.path}`);
        const filtersFileJson = path$1.join(platformDir, FILTERS_METADATA_FILE_JSON);
        const filtersFileJs = path$1.join(platformDir, FILTERS_METADATA_FILE_JS);

        const replacedExpiresFiltersMetadata = replaceExpires(replacedTagKeywordsFiltersMetadata, config.expires);

        let metadata = {
            groups,
            tags,
            filters: replacedExpiresFiltersMetadata,
        };

        metadata = postProcessUrls(metadata, config);
        metadata = removeRedundantFiltersMetadata(metadata, config.platform);

        if (platform === 'MAC') {
            metadata = rewriteMetadataForOldMacV1(metadata);
        } else if (platform === 'MAC_V2') {
            metadata = rewriteMetadataForOldMacV2(metadata);
            metadata = removeObsoleteFilters(metadata);
        } else {
            metadata = removeObsoleteFilters(metadata);
        }

        const filtersContent = JSON.stringify(sortMetadataFilters(metadata), null, '\t');

        fs$1.writeFileSync(filtersFileJson, filtersContent, 'utf8');
        fs$1.writeFileSync(filtersFileJs, filtersContent, 'utf8');

        logger.info(`Writing filters localizations: ${config.path}`);
        const filtersI18nFileJson = path$1.join(platformDir, FILTERS_I18N_METADATA_FILE_JSON);
        const filtersI18nFileJs = path$1.join(platformDir, FILTERS_I18N_METADATA_FILE_JS);

        let localizedFilters = { ...localizations.filters };

        filtersMetadata.forEach((metadata) => {
            if (!shouldBuildFilterForPlatform(metadata, config.platform)) {
                const { filterId } = metadata;
                // eslint-disable-next-line max-len
                logger.info(`Adding localization for filter ${filterId} skipped for platform '${config.platform}' due to platformsExcluded or platformsIncluded`);
                delete localizedFilters[filterId];
            }
        });

        // old MAC platform may not support absence some filters i18n metadata,
        // for all other platforms we can exclude obsolete filters
        if (platform !== 'MAC') {
            localizedFilters = excludeObsoleteFilters(localizedFilters, obsoleteFilters);
        }

        const i18nMetadata = {
            groups: localizations.groups,
            tags: localizations.tags,
            filters: localizedFilters,
        };

        let i18nGroups = localizations.groups;

        // no new fields should be added for old 'MAC' platform
        if (platform === 'MAC') {
            delete i18nMetadata.tags;
            i18nGroups = removeGroupDescriptions(localizations.groups);
        }

        i18nMetadata.groups = i18nGroups;

        const i18nContent = JSON.stringify(i18nMetadata, null, '\t');

        fs$1.writeFileSync(filtersI18nFileJson, i18nContent, 'utf8');
        fs$1.writeFileSync(filtersI18nFileJs, i18nContent, 'utf8');
    }

    logger.info('Writing filters metadata done');
};

/**
 * Separates script rules from AG filters into specified file.
 *
 * @param platformsPath - Path to platforms folder
 */
const writeLocalScriptRules = function (platformsPath) {
    logger.info('Writing local script rules');

    // eslint-disable-next-line guard-for-in,no-restricted-syntax
    for (const platform in platformPathsConfig) {
        const config = platformPathsConfig[platform];
        const platformDir = path$1.join(platformsPath, config.path);

        const rulesTxt = [];
        const rulesJson = {
            comment: LOCAL_SCRIPT_RULES_COMMENT,
            rules: [],
        };

        // TODO: find a better way to iterate over ag filters
        // because AdGuard Chinese filter has id 224
        // https://github.com/AdguardTeam/FiltersRegistry/blob/master/filters/filter_224_Chinese/metadata.json
        for (let i = 1; i <= LAST_ADGUARD_FILTER_ID; i += 1) {
            const filterRules = readFile$2(path$1.join(platformDir, PLATFORM_FILTERS_DIR, `${i}.txt`));
            if (!filterRules) {
                continue;
            }

            const lines = filterRules.split('\n');
            // eslint-disable-next-line no-restricted-syntax
            for (let rule of lines) {
                rule = rule.trim();

                if (!rule
                    || rule.startsWith(RuleMasks.MASK_COMMENT)) {
                    continue;
                }

                if (rule.includes(RuleMasks.MASK_SCRIPT)) {
                    rulesTxt.push(rule);

                    const m = rule.split(RuleMasks.MASK_SCRIPT);
                    rulesJson.rules.push({
                        domains: m[0],
                        script: m[1],
                    });
                }
            }
        }

        // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1847
        // remove scriptlet rules in local_script_rules.json
        rulesJson.rules = removeScriptletRules(rulesJson.rules);

        fs$1.writeFileSync(
            path$1.join(platformDir, LOCAL_SCRIPT_RULES_FILE),
            rulesTxt.join(RULES_SEPARATOR),
            'utf8',
        );
        fs$1.writeFileSync(
            path$1.join(platformDir, LOCAL_SCRIPT_RULES_FILE_JSON),
            JSON.stringify(rulesJson, null, 4),
            'utf8',
        );
    }

    logger.info('Writing local script rules done');
};

/**
 * Loads and processes filter metadata from the specified directory.
 *
 * @param {string} filterDir - The directory containing the filter metadata and revision files.
 * @param {number[]} [whitelist] - An optional array of whitelist filter IDs.
 * @param {number[]} [blacklist] - An optional array of blacklist filter IDs.
 * @returns {Object} The processed filter metadata.
 * @throws {Error} If the metadata or revision file cannot be read.
 */
const loadFilterMetadata = function (filterDir, whitelist, blacklist) {
    const metadataFilePath = path$1.join(filterDir, metadataFile);
    const metadataString = readFile$2(metadataFilePath);
    if (!metadataString) {
        throw new Error(`Error reading filter metadata:${filterDir}`);
    }

    const revisionFilePath = path$1.join(filterDir, revisionFile);
    const revisionString = readFile$2(revisionFilePath);
    if (!revisionString) {
        throw new Error(`Error reading filter revision:${filterDir}`);
    }

    const revision = JSON.parse(revisionString);

    const result = JSON.parse(metadataString);
    result.version = revision.version;
    result.timeUpdated = moment(revision.timeUpdated).format('YYYY-MM-DDTHH:mm:ssZZ');
    result.timeAdded = moment(result.timeAdded).format('YYYY-MM-DDTHH:mm:ssZZ');
    delete result.disabled;

    const { filterId } = result;
    if (
        (whitelist && whitelist.includes(filterId))
        || (blacklist && !blacklist.includes(filterId))
    ) {
        checkFilterId(metadataFilterIdsPool, filterId);
    }

    return result;
};

/**
 * Exclude `#%#` and `#@%#` rules from rules list.
 *
 * @param {Array<any>} rules Input list of rules.
 * @return {Array<any>} Filtered list of rules.
 */
const excludeScriptRules = (rules) => {
    return rules.filter((rule) => {
        return rule
            && !rule.includes(RuleMasks.MASK_SCRIPT)
            && !rule.includes(RuleMasks.MASK_SCRIPT_EXCEPTION);
    });
};

/**
 * Calculates checksum and writes filter file
 *
 * @param filterFile
 * @param adbHeader
 * @param rulesHeader
 * @param rules
 */
const writeFilterFile = function (filterFile, adbHeader, rulesHeader, rules) {
    let header = rulesHeader;
    if (adbHeader) {
        // Add Adb Plus compatibility header
        header = [adbHeader].concat(rulesHeader);
    }

    const checksum = calculateChecksum(header, rules);

    let data = [checksum].concat(rulesHeader).concat(rules);
    if (adbHeader) {
        data = [adbHeader].concat(data);
    }

    fs$1.writeFileSync(filterFile, data.join(RULES_SEPARATOR), 'utf8');
};

/**
 * Writes filter platform build
 */
const writeFilterRules = function (filterId, dir, config, rulesHeader, rules, optimized) {
    createDir(dir);

    const filterFile = path$1.join(dir, `${filterId}${optimized ? '_optimized' : ''}.txt`);
    let rulesList = rules;

    // Convert Adguard scriptlets and redirect rules to UBlock syntax.
    // Exclude script rules
    // and script rules exceptions https://github.com/AdguardTeam/FiltersCompiler/issues/199
    // Modify title for base filter
    if (config.platform === 'ext_ublock') {
        rulesList = convertToUbo(rulesList);
        rulesList = excludeScriptRules(rulesList);
        if (filterId === 2) {
            modifyBaseFilterHeader(rulesHeader, optimized);
        }
    }

    writeFilterFile(filterFile, config.configuration.adbHeader, rulesHeader, rulesList);

    // For English filter only we should provide additional filter version.
    if (filterId === 2 && config.platform === 'ext_ublock' && !optimized) {
        const correctedHeader = rewriteHeader(rulesHeader);
        const correctedRules = rewriteRules(rulesList);

        const correctedFile = path$1.join(dir, `${filterId}_without_easylist.txt`);
        writeFilterFile(correctedFile, config.configuration.adbHeader, correctedHeader, correctedRules);
    }
};

/**
 * Removes rules array duplicates,
 * ignores comments and hinted rules
 *
 * @param list a list of rules to filter
 * @returns {*} a list of rules without duplicate
 */
const removeRuleDuplicates = function (list) {
    logger.info('Removing duplicates..');

    return list.filter((item, pos) => {
        // Do not remove hinted duplicates
        if (pos > 0) {
            const previous = list[pos - 1];
            if (previous && previous.startsWith(RuleMasks.MASK_HINT)) {
                return true;
            }
        }

        // Do not remove hinted duplicates
        const duplicatePosition = list.indexOf(item, pos > 0 ? pos - 1 : pos);
        if (duplicatePosition !== pos && duplicatePosition > 0) {
            const duplicate = list[duplicatePosition - 1];
            if (duplicate && duplicate.startsWith(RuleMasks.MASK_HINT)) {
                return true;
            }
        }

        // Do not remove commented duplicates
        const result = item.startsWith(RuleMasks.MASK_COMMENT) || duplicatePosition === pos;

        if (!result) {
            logger.info(`${item} removed as duplicate`);
        }

        return result;
    });
};

/**
 * Builds platforms for filter
 *
 * @param filterDir - Path to filter directory
 * @param platformsPath - Path to platforms folder
 * @param whitelist - Array of filter ids to whitelist
 * @param blacklist - Array of filter ids to blacklist
 */
const buildFilter$1 = async (filterDir, platformsPath, whitelist, blacklist) => {
    const originalRules = readFile$2(path$1.join(filterDir, filterFile)).split('\r\n');

    const metadataFilePath = path$1.join(filterDir, metadataFile);
    const revisionFilePath = path$1.join(filterDir, revisionFile);

    const metadata = JSON.parse(readFile$2(metadataFilePath));
    const { filterId } = metadata;
    checkFilterId(filterIdsPool, filterId);

    if (whitelist && whitelist.length > 0 && whitelist.indexOf(filterId) < 0) {
        logger.info(`Filter ${filterId} skipped with whitelist`);
        return;
    }

    if (blacklist && blacklist.length > 0 && blacklist.indexOf(filterId) >= 0) {
        logger.info(`Filter ${filterId} skipped with blacklist`);
        return;
    }

    const optimizationConfig = getFilterOptimizationConfig(filterId);

    // eslint-disable-next-line guard-for-in,no-restricted-syntax
    for (const platform in platformPathsConfig) {
        const config = platformPathsConfig[platform];

        if (!shouldBuildFilterForPlatform(metadata, config.platform)) {
            // eslint-disable-next-line max-len
            logger.info(`Build of filter ${filterId} skipped for platform '${config.platform}' due to platformsExcluded or platformsIncluded`);
            continue;
        }

        let rules = filtersDownloader.FiltersDownloader.resolveConditions(originalRules, config.defines);

        // handle includes after resolving conditions:
        // if there is a bad include after resolving conditions, the generator should be terminated
        // https://github.com/AdguardTeam/FiltersCompiler/issues/84
        // eslint-disable-next-line no-await-in-loop
        rules = await filtersDownloader.FiltersDownloader.resolveIncludes(rules, filterDir, config.defines);

        rules = cleanupRules(rules, config, filterId);
        rules = removeRuleDuplicates(rules);

        // Apply replacement rules
        if (config.configuration?.replacements) {
            rules = rules.map((rule) => {
                // eslint-disable-next-line no-restricted-syntax
                for (const repl of config.configuration.replacements) {
                    rule = rule.replace(new RegExp(repl.from, 'g'), repl.to);
                }
                return rule;
            });
        }

        const optimizedRules = cleanupAndOptimizeRules(rules, config, optimizationConfig, filterId);
        // eslint-disable-next-line max-len
        logger.info(`Filter ${filterId}. Rules ${originalRules.length} => ${rules.length} => ${optimizedRules.length}. PlatformPath: '${config.path}'`);

        const header = makeHeader(metadataFilePath, revisionFilePath, config.expires);

        const platformDir = path$1.join(platformsPath, config.path, PLATFORM_FILTERS_DIR);
        writeFilterRules(filterId, platformDir, config, header, rules, false);

        // add '(Optimized)' to the '! Title:' for optimized filters
        // https://github.com/AdguardTeam/FiltersCompiler/issues/78
        const optimizedHeader = [...header];
        optimizedHeader[0] += ' (Optimized)';

        writeFilterRules(filterId, platformDir, config, optimizedHeader, optimizedRules, true);
    }
};

/**
 * Initializes service
 *
 * @param filterFileName output filter file name.
 * @param metadataFileName output metadata file name.
 * @param revisionFileName output revision file name.
 * @param platformsConfig platforms configuration object.
 * @param adguardFiltersServer server that will serve the filters that're being built.
 */
const init = function (
    filterFileName,
    metadataFileName,
    revisionFileName,
    platformsConfig,
    adguardFiltersServer,
) {
    filterFile = filterFileName;
    metadataFile = metadataFileName;
    revisionFile = revisionFileName;

    adguardFiltersServerUrl = adguardFiltersServer;

    if (!platformsConfig) {
        throw new Error('Platforms config is not defined');
    }

    platformPathsConfig = platformsConfig;
};

/**
 * Checks if filter has 'obsolete' tag
 * @param {object} metadata
 * @returns {boolean}
 */
const isObsoleteFilter = (metadata) => metadata.tags && metadata.tags.some((tag) => tag === 'obsolete');

/**
 * Parses directory recursive
 *
 * @param filtersDir
 * @param filtersMetadata
 * @param platformsPath
 * @param whitelist
 * @param blacklist
 * @param obsoleteFiltersMetadata
 */
const parseDirectory$1 = async (
    filtersDir,
    filtersMetadata,
    platformsPath,
    whitelist,
    blacklist,
    obsoleteFiltersMetadata,
) => {
    const items = fs$1.readdirSync(filtersDir);
    // eslint-disable-next-line no-restricted-syntax
    for (const directory of items) {
        const filterDir = path$1.join(filtersDir, directory);
        if (fs$1.lstatSync(filterDir).isDirectory()) {
            const metadataFilePath = path$1.join(filterDir, metadataFile);
            if (fs$1.existsSync(metadataFilePath)) {
                logger.info(`Building filter platforms: ${directory}`);
                // eslint-disable-next-line no-await-in-loop
                await buildFilter$1(filterDir, platformsPath, whitelist, blacklist);
                logger.info(`Building filter platforms: ${directory} done`);
                const filterMetadata = loadFilterMetadata(filterDir, whitelist, blacklist);
                filtersMetadata.push(filterMetadata);
                if (isObsoleteFilter(filterMetadata)) {
                    obsoleteFiltersMetadata.push(filterMetadata);
                }
            } else {
                // eslint-disable-next-line no-await-in-loop
                await parseDirectory$1(
                    filterDir,
                    filtersMetadata,
                    platformsPath,
                    whitelist,
                    blacklist,
                    obsoleteFiltersMetadata,
                );
            }
        }
    }
};

/**
 * Generates platform-specific files and metadata based on the provided filters and configurations.
 *
 * @async
 * @param {string} filtersDir - The directory containing filter files to be processed.
 * @param {string} platformsPath - The output path where the generated platform files will be stored.
 * @param {Array<number>} whitelist - A list of whitelist filter IDs.
 * @param {Array<number>} blacklist - A list of blacklist filter IDs.
 * @returns {Promise<void>} Resolves when the generation process is complete.
 *
 * @throws {Error} If `platformsPath` or `platformPathsConfig` is not specified.
 */
const generate = async (filtersDir, platformsPath, whitelist, blacklist) => {
    if (!platformsPath) {
        logger.warn('Platforms build output path is not specified');
        return;
    }

    if (!platformPathsConfig) {
        logger.warn('Platforms configuration is not specified');
        return;
    }

    createDir(platformsPath);

    const filtersMetadata = [];
    const obsoleteFiltersMetadata = [];

    await parseDirectory$1(filtersDir, filtersMetadata, platformsPath, whitelist, blacklist, obsoleteFiltersMetadata);

    writeFiltersMetadata(platformsPath, filtersDir, filtersMetadata, obsoleteFiltersMetadata);
    writeLocalScriptRules(platformsPath);

    // reset af the end
    // TODO: find out better way to reset
    filterIdsPool = [];
    metadataFilterIdsPool = [];
};

const { log } = console;
const reportDate = new Date();

let reportData = `\nFiltersCompiler report ${reportDate.toLocaleDateString()} ${reportDate.toLocaleTimeString()}:\n\n`;

/**
 * Adds filters data to report
 * @param {object} metadata
 * @param {object} filterRules
 * @param {string[]} invalidRules
 */
const addFilter = (metadata, filterRules, invalidRules) => {
    if (metadata && filterRules) {
        const { filterId, name, subscriptionUrl } = metadata;
        const filterLength = filterRules.lines.length;
        const excludedLength = filterRules.excluded.length;

        reportData += `Filter ID: ${filterId}\n`
            + `Filter name: ${name}\n`
            + `Compiled rules: ${filterLength}\n`
            + `Excluded rules: ${excludedLength}\n`
            + `URL: ${subscriptionUrl}\n`;
        // log list of invalid rules only if they exist
        if (invalidRules.length > 0) {
            reportData += 'INVALID RULES:\n'
                + `${invalidRules.join('\n')}\n`;
        } else {
            reportData += 'All rules are valid.\n';
        }
        reportData += '---------------------------\n';
    }
};

/**
 * Adds disabled filters data to report
 * @param {object} metadata
 */
const skipFilter = (metadata) => {
    if (metadata) {
        const { filterId, name, subscriptionUrl } = metadata;

        reportData += `Filter ID: ${filterId}\n`
            + `Filter name: ${name}\n`
            + 'Filter is DISABLED!\n'
            + `URL: ${subscriptionUrl}\n`
            + '---------------------------\n';
    }
};

/**
 * Creates report file or outputs report
 * @param {string} reportPath
 */
const create = (reportPath) => {
    if (reportPath) {
        fs$1.writeFileSync(reportPath, reportData, 'utf8');
        return;
    }
    log(reportData);
};

/**
 * Returns filter ID from directory name if it has a number id,
 * otherwise returns 0.
 *
 * @param {string} str Directory name.
 *
 * @returns {number} Filter ID for filter directory, otherwise 0.
 */
const getFilterIdFromDirName = (str) => {
    const chunks = str.split('_');
    const rawId = chunks.length > 1 ? Number(chunks[1]) : 0;
    return !Number.isNaN(rawId) ? rawId : 0;
};

const DOT = '.';

/**
 * Modifies string to handle domains without rule markers
 *
 * @param {string} rule - Rule in base adblock syntax.
 * @returns {string} - Domain without base rule markers.
 */
const removeRuleMarkers = (rule) => rule
    .replace(RuleMasks.MASK_BASE_RULE, '')
    .replace(RuleMasks.MASK_RULE_SEPARATOR, '');

/**
 * Checks if the line is in base rule style syntax with no modifier, i.e.,
 * starts with `||` and ends with `^`.
 *
 * @param {string} rule - Rule to check.
 * @returns {boolean} - True if the rule is in base rule style syntax.
 */
const shouldOptimize = (rule) => {
    return rule.startsWith(RuleMasks.MASK_BASE_RULE)
        && rule.endsWith(RuleMasks.MASK_RULE_SEPARATOR);
};

/**
 * Returns the top level domain of the given domain.
 *
 * @param {string} domain Domain to get the top level domain from.
 *
 * @returns {string} Top level domain.
 */
const getTopLevelDomain = (domain) => {
    const parsedDomain = tldts.parse(domain).domain;
    return typeof parsedDomain === 'string' ? parsedDomain : domain;
};

/**
 * Finds the widest domains in the given list.
 *
 * @param {Set<string>} domains Set of domains to find the widest domains from.
 *
 * @returns {Set<string>} Set of widest domains.
 *
 * @example
 * - example.com, sub1.example.com, abc.sub2.example.com -> example.com
 * - example.org, example.com -> example.org, example.com
 */
const findWidestDomains = (domains) => {
    const sortedDomains = [...domains].sort((a, b) => {
        return a.split(DOT).length - b.split(DOT).length;
    });

    const result = new Set();

    sortedDomains.forEach((domain) => {
        let isSubdomain = false;
        result.forEach((parent) => {
            if (domain.endsWith(`${DOT}${parent}`)) {
                isSubdomain = true;
            }
        });

        if (!isSubdomain) {
            result.add(domain);
        }
    });

    return result;
};

/**
 * Removes redundant rules from lines
 * @param {string[]} lines - An array of text lines.
 * @returns {string[]} - An array of of text lines with redundant rules removed.
 */
const optimizeDomainBlockingRules = async (lines) => {
    const linesToSkipOptimization = new Set();
    const rawDomainsToOptimize = new Set();

    lines.forEach((line) => {
        if (!shouldOptimize(line)) {
            linesToSkipOptimization.add(line);
            return;
        }

        const rawDomain = removeRuleMarkers(line);
        rawDomainsToOptimize.add(rawDomain);
    });

    /**
     * Map of tld for all raw domains
     * @type {Map<string, Set<string>>}
     *
     * It is needed to group rawDomains by top level domain
     * so groups of related rawDomains can be optimized in parallel.
     */
    const topDomainsMap = new Map();

    rawDomainsToOptimize.forEach((rawDomain) => {
        const topLevelDomain = getTopLevelDomain(rawDomain);

        if (!topDomainsMap.has(topLevelDomain)) {
            topDomainsMap.set(topLevelDomain, new Set([rawDomain]));
        } else {
            topDomainsMap.get(topLevelDomain).add(rawDomain);
        }
    });

    const widerDomains = new Set();

    /**
     * Runs optimization for a group of related domains -
     * finds the widest domains in the group and adds them to the result list of wider domains.
     *
     * @param {Set<string>} rawDomains Set of related raw domains to optimize.
     */
    const optimizeDomains = (rawDomains) => {
        const widestDomains = findWidestDomains(rawDomains);
        widestDomains.forEach((domain) => {
            widerDomains.add(domain);
        });
    };

    topDomainsMap.forEach((rawDomains) => {
        optimizeDomains(rawDomains);
    });

    // return lines in the order they were given
    return lines.filter((line) => {
        if (linesToSkipOptimization.has(line)) {
            return true;
        }

        const domain = removeRuleMarkers(line);

        return widerDomains.has(domain);
    });
};

/* eslint-disable global-require */


const __dirname$3 = path$1.dirname(url.fileURLToPath((typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('index.cjs', document.baseURI).href))));

const TEMPLATE_FILE = 'template.txt';
const FILTER_FILE = 'filter.txt';
const REVISION_FILE = 'revision.json';
const EXCLUDE_FILE = 'exclude.txt';
const EXCLUDED_LINES_FILE = 'diff.txt';
const METADATA_FILE = 'metadata.json';
const ADGUARD_FILTERS_SERVER_URL = 'https://filters.adtidy.org/';
const TRUST_LEVEL_DIR = './utils/trust-levels';
const DEFAULT_TRUST_LEVEL = 'low';

const SPACE = ' ';
const SLASH = '/';
const COMMA = ',';
const EQUAL_SIGN = '=';
const MODIFIERS_SEPARATOR = '$';
const INCLUDE_DIRECTIVE = '@include ';
const STRIP_COMMENTS_OPTION = 'stripComments';
const OPTIMIZE_DOMAIN_BLOCKING_RULES = 'optimizeDomainBlockingRules';
const NOT_OPTIMIZED_OPTION = 'notOptimized';
const EXCLUDE_OPTION = 'exclude';
const ADD_MODIFIERS_OPTION = 'addModifiers';
const IGNORE_TRUST_LEVEL_OPTION = 'ignoreTrustLevel';

const NOT_OPTIMIZED_HINT = '!+ NOT_OPTIMIZED';

/**
 * Filter header tag for diff path which is needed for patch updates.
 */
const DIFF_PATH_TAG = 'Diff-Path:';

// TODO: Move include directive option functions to utils/builder-utils.js

/**
 * Sync reads file content
 *
 * @param path
 * @returns {*}
 */
const readFile$1 = function (path) {
    if (!fs$1.existsSync(path)) {
        return null;
    }

    return fs$1.readFileSync(path, { encoding: 'utf-8' });
};

/**
 * Sync writes content to file
 *
 * @param path
 * @param data
 */
const writeFile = function (path, data) {
    fs$1.writeFileSync(path, data, 'utf8');
};

/**
 * Splits lines
 *
 * @param string
 */
const splitLines = function (string) {
    return string.split(/\r?\n/);
};

/**
 * Removes comments from lines
 *
 * @param lines
 */
const stripComments = function (lines) {
    logger.info('Stripping comments..');

    return lines.filter((line, pos) => {
        if (pos > 0 && lines[pos - 1].startsWith(RuleMasks.MASK_HINT)) {
            return true;
        }

        if (
            line.startsWith(RuleMasks.MASK_HINT)
            || line.startsWith(RuleMasks.MASK_DIRECTIVES)
        ) {
            return true;
        }

        return !line.startsWith(RuleMasks.MASK_COMMENT);
    });
};

/**
 * Adds not optimized hints
 *
 * @param lines
 */
const addNotOptimizedHints = function (lines) {
    logger.info('Adding hints..');

    const result = [];

    lines.forEach((v) => {
        if (!v) {
            return;
        }

        if (!v.startsWith(RuleMasks.MASK_COMMENT) && !v.startsWith(`${RuleMasks.MASK_HINT}${SPACE}`)) {
            result.push(NOT_OPTIMIZED_HINT);
        }

        result.push(v);
    });

    return result;
};
/**
 * Adds or updates modifiers in each line of the given array of lines.
 *
 * @param {string[]} lines - An array of text lines.
 * @param {string} modifiersStr - Modifiers as a string to add.
 * @returns {string[]} - An array of modified lines.
 */
const addModifiers = (lines, modifiersStr) => {
    return lines.map((line) => {
        // If the line is empty or contains only whitespace, it returns a comment mask
        if (!line || line.trim() === '') {
            return RuleMasks.MASK_COMMENT;
        }
        // If the line starts with a host file comment mask, it replaces it with a comment mask
        if (line.startsWith(RuleMasks.MASK_HOST_FILE_COMMENT)) {
            return line.replace(RuleMasks.MASK_HOST_FILE_COMMENT, RuleMasks.MASK_COMMENT);
        }
        // If the line starts with a comment mask, it returns the line as is.
        if (line.startsWith(RuleMasks.MASK_COMMENT)) {
            return line;
        }
        // If the line does not contain a modifiers separator, it appends the given modifiers string
        if (!line.includes(MODIFIERS_SEPARATOR)) {
            return `${line}${MODIFIERS_SEPARATOR}${modifiersStr}`;
        }
        // If the line already contains modifiers, combine the existing modifiers with the new ones,
        // ensuring no duplicates, and return the line with the updated modifiers.
        const [rule, existingModifiersStr] = line.split(MODIFIERS_SEPARATOR);
        const existingModifiers = existingModifiersStr.split(COMMA);
        const newModifiers = modifiersStr.split(COMMA);
        const combinedModifiers = [...new Set([...existingModifiers, ...newModifiers])].join(COMMA);

        return `${rule}${MODIFIERS_SEPARATOR}${combinedModifiers}`;
    });
};

/**
 * Checks case when '#%#' rules are excluded to DON'T exclude '#%#//scriptlet' rules
 *
 * @param {string} line
 * @param {string} exclusion
 * @return {boolean}
 */
const scriptletException = (line, exclusion) => (exclusion === '#%#' && line.includes('#%#//scriptlet'))
        || (exclusion === '#@%#' && line.includes('#@%#//scriptlet'));

/**
 * Checks if line is excluded with specified set of exclusions
 *
 * @param line
 * @param exclusions
 * @param excluded
 * @param reason
 */
const isExcluded = function (line, exclusions, excluded, reason) {
    // eslint-disable-next-line no-restricted-syntax
    for (let exclusion of exclusions) {
        exclusion = exclusion.trim();

        if (exclusion && !exclusion.startsWith(RuleMasks.MASK_COMMENT)) {
            const message = `${line} is excluded by "${exclusion}" in ${reason}`;

            const isExcludedByRegexp = exclusion.endsWith(SLASH) && exclusion.startsWith(SLASH)
                && line.match(new RegExp(exclusion.substring(1, exclusion.length - 1)));

            if ((isExcludedByRegexp || line.includes(exclusion)) && !scriptletException(line, exclusion)) {
                logger.info(message);
                excluded.push(`${RuleMasks.MASK_COMMENT}${SPACE}${message}`);
                excluded.push(line);
                return exclusion;
            }
        }
    }

    return null;
};

/**
 * Applies exclusion from exclusions file
 *
 * @param lines
 * @param exclusionsFile
 * @param excluded
 * @returns {*}
 */
const exclude = function (lines, exclusionsFile, excluded) {
    logger.info('Applying exclusions..');

    let exclusions = readFile$1(exclusionsFile);
    if (!exclusions) {
        return lines;
    }

    exclusions = splitLines(exclusions);

    const exclusionsFileName = path$1.parse(exclusionsFile).base;
    const result = [];

    lines.forEach((line, pos) => {
        const exclusion = isExcluded(line, exclusions, excluded, exclusionsFileName);
        if (exclusion) {
            if (pos > 0 && lines[pos - 1].startsWith(RuleMasks.MASK_HINT)) {
                result.push(`${RuleMasks.MASK_COMMENT} [excluded by ${exclusion}] ${line}`);
            }
        } else {
            result.push(line);
        }
    });

    return result;
};

/**
 * Strips leading and trailing quotes from string
 *
 * @param s
 * @returns {*}
 */
const stripEndQuotes = function (s) {
    let t = s.length;
    if (s.charAt(0) === '"') {
        s = s.substring(1, t -= 1);
    }
    // eslint-disable-next-line no-plusplus
    if (s.charAt(--t) === '"') {
        s = s.substring(0, t);
    }
    return s;
};

/**
 * Extracts the value of an attribute.
*
* @param {string} attribute - The input attribute string.
* @returns {string} The extracted attribute value without quotes if it is not empty.
* @throws {Error} If the attribute value is empty.
*/
const getOptionValue = (attribute) => {
    const quotedValue = attribute.substring(attribute.indexOf(EQUAL_SIGN) + 1);
    const value = stripEndQuotes(quotedValue).trim();
    if (value.length === 0) {
        throw new Error(`Include directive value cannot be empty: '${attribute}'`);
    }
    return value;
};

/**
 * @typedef {object} IncludeOption
 * @property {string} name Option name
 * @property {boolean|string} value Option value
 */

/**
 * @typedef {object} ParsedIncludeData
 * @property {string} url Parsed url of file to include
 * @property {IncludeOption[]} options Array of parsed include directive options
 */

/**
 * Parses an include directive line to extract the URL and options.
 *
 * @param {string} lineWithDirective - The input line with directive to parse.
 * @returns {ParsedIncludeData} Parsed result containing the URL and options.
 */
const parseIncludeDirective = function (lineWithDirective) {
    const parts = lineWithDirective.trim().split(SPACE);
    let url = parts[1].trim();
    url = stripEndQuotes(url);
    // Initialize an options array to store the parsed options.
    const options = [];
    // Stack options into the array in the sequence in which they found in the string
    for (let i = 1; i < parts.length; i += 1) {
        const attribute = parts[i].trim();
        if (attribute.startsWith(`${SLASH}${STRIP_COMMENTS_OPTION}`)) {
            options.push({ name: STRIP_COMMENTS_OPTION, value: true });
        } else if (attribute.startsWith(`${SLASH}${OPTIMIZE_DOMAIN_BLOCKING_RULES}`)) {
            options.push({ name: OPTIMIZE_DOMAIN_BLOCKING_RULES, value: true });
        } else if (attribute.startsWith(`${SLASH}${NOT_OPTIMIZED_OPTION}`)) {
            options.push({ name: NOT_OPTIMIZED_OPTION, value: true });
        } else if (attribute.startsWith(`${SLASH}${EXCLUDE_OPTION}${EQUAL_SIGN}`)) {
            options.push({ name: EXCLUDE_OPTION, value: getOptionValue(attribute) });
        } else if (attribute.startsWith(`${SLASH}${ADD_MODIFIERS_OPTION}${EQUAL_SIGN}`)) {
            options.push({ name: ADD_MODIFIERS_OPTION, value: getOptionValue(attribute) });
        } else if (attribute.startsWith(`${SLASH}${IGNORE_TRUST_LEVEL_OPTION}`)) {
            options.push({ name: IGNORE_TRUST_LEVEL_OPTION, value: true });
        }
    }
    return { url, options };
};

/**
 * Checks if lines contains invalid redirect directives
 *
 * @param lines
 * @param url
 */
const checkRedirects = function (lines, url) {
    // eslint-disable-next-line no-restricted-syntax
    for (const line of lines) {
        if (/^!\s?[Rr]edirect:/.test(line)) {
            throw new Error(`Error: include ${url} contains redirect directive: ${line}`);
        }
    }
};

/**
 * @typedef {object} ParsedIncludeResult
 * @property {string[]} includedLines Included rules.
 * @property {boolean} shouldIgnoreTrustLevel Indicates whether the metadata's trust level should be ignored.
 */

/**
 * Creates content from compiler's `@include` directive, not `!#include` preprocessor directive.
 *
 * @param {string} filterDir Filter directory.
 * @param {string} directiveLine The include line containing the URL or file path and optional options.
 * @param {Array<string>} excluded An array of strings representing excluded content.
 *
 * @returns {Promise<ParsedIncludeResult>} Parsed include data.
 * @throws {Error} Throws an error if there is an issue handling the include operation.
 */
const include = async (filterDir, directiveLine, excluded) => {
    let includedLines = [];
    let shouldIgnoreTrustLevel = false;

    const { url, options } = parseIncludeDirective(directiveLine);

    if (!url) {
        logger.warn('Invalid include url');
        return includedLines;
    }

    logger.info(`Applying inclusion from: ${url}`);

    const externalInclude = url.includes(':');

    const included = externalInclude
        ? downloadFile(url)
        : readFile$1(path$1.join(filterDir, url));

    if (included) {
        includedLines = splitLines(included);

        checkRedirects(includedLines, url);

        // resolved `@include` directive url
        const originUrl = externalInclude
            ? filtersDownloader.FiltersDownloader.getFilterUrlOrigin(url)
            : filterDir;

        includedLines = await filtersDownloader.FiltersDownloader.resolveIncludes(includedLines, originUrl);

        includedLines = removeAdblockVersion(includedLines);

        // eslint-disable-next-line no-restricted-syntax
        for (const { name, value } of options) {
            let optionsExcludePath;
            switch (name) {
                case EXCLUDE_OPTION:
                    optionsExcludePath = path$1.join(filterDir, value);
                    includedLines = exclude(includedLines, optionsExcludePath, excluded);
                    break;
                case STRIP_COMMENTS_OPTION:
                    includedLines = stripComments(includedLines);
                    break;
                case OPTIMIZE_DOMAIN_BLOCKING_RULES:
                    // eslint-disable-next-line no-await-in-loop
                    includedLines = await optimizeDomainBlockingRules(includedLines);
                    break;
                case NOT_OPTIMIZED_OPTION:
                    includedLines = addNotOptimizedHints(includedLines);
                    break;
                case ADD_MODIFIERS_OPTION:
                    includedLines = addModifiers(includedLines, value);
                    break;
                case IGNORE_TRUST_LEVEL_OPTION:
                    if (externalInclude) {
                        // eslint-disable-next-line max-len
                        throw new Error(`Trust level ignoring option is not supported for external includes: ${directiveLine}`);
                    }
                    shouldIgnoreTrustLevel = true;
                    break;
            }
        }

        includedLines = fixVersionComments(includedLines);
    } else {
        throw new Error(`Error handling include from: ${options.url}`);
    }

    logger.info(`Inclusion lines: ${includedLines.length}`);
    logger.info(`Should be filtered due to trust level: ${shouldIgnoreTrustLevel}`);

    return {
        includedLines,
        shouldIgnoreTrustLevel,
    };
};

/**
 * Resolves preprocessor `!#include` directives by FiltersDownloader.
 *
 * @param {string} filterDir Filter directory.
 * @param {string} filterName Filter name.
 * @param {string[]} lines Array of lines.
 *
 * @returns {Promise<string[]>} Promise which resolves
 * to array of rules as a result of resolving preprocessor `!#include` directives.
 *
 * @throws {Error} Throws an error if unable to resolve `!#include` directives.
 */
const getResolvedPreprocessorIncludes = async function (filterDir, filterName, lines) {
    let rules = lines;
    // bad includes are ignored here because they'll be handled in generator after resolving conditions
    // https://github.com/AdguardTeam/FiltersCompiler/issues/84
    try {
        rules = await filtersDownloader.FiltersDownloader.resolveIncludes(lines, filterDir);
    } catch (e) {
        logger.error(`Error resolving includes in ${filterName}: ${e.message}`);
    }
    return rules;
};

/**
 * Resolved preprocessor `!#include` directives and converts rules to Adguard syntax.
 *
 * @param {string} filterDir Filter directory.
 * @param {string} filterName Filter name.
 * @param {string[]} lines Array of raw rules and possibly preprocessor `!#include` directives.
 * @param {string[]} excluded Array of rules to exclude.
 * @param {string[]} invalidRules Invalid rules for the report file.
 *
 * @returns {Promise<string[]>} Promise which resolves to array of AdGuard syntax rules.
 */
const prepareAdgRules = async function (
    filterDir,
    filterName,
    lines,
    excluded,
    invalidRules,
) {
    const resolvedIncludes = await getResolvedPreprocessorIncludes(filterDir, filterName, lines);
    return convertRulesToAdgSyntax(resolvedIncludes, excluded, invalidRules);
};

/**
 * Checks whether the line contain `Diff-Path` header tag.
 *
 * `Diff-Path` header tag should be removed from the rules
 * because some third-party filters may contain it
 * but @adguard/diff-builder does not support third-party patches.
 * Anyway the `Diff-Path` header tag should be added by the diff-builder during patch building
 * and should not be present in the filter file.
 *
 * @param {string} line Line to check.
 *
 * @returns {boolean} `true` if the line contains `Diff-Path` header tag, `false` otherwise.
 */
const isDiffPathHeaderTag = (line) => {
    // non-comment lines should be kept
    if (
        !line.startsWith(RuleMasks.MASK_COMMENT)
        // ubo supports `#` for comments
        && !line.startsWith(RuleMasks.MASK_HOST_FILE_COMMENT)
    ) {
        return false;
    }

    return line.includes(DIFF_PATH_TAG);
};

/**
 * @typedef {object} CompileResult
 * @property {string[]} lines Compiled rules.
 * @property {string[]} excluded Excluded rules.
 * @property {string[]} invalid Invalid rules.
 */

/**
 * Compiles filter lines.
 *
 * @param filterDir Filter directory.
 * @param filterName Filter name.
 * @param templateContent Content of template.txt file.
 * @param trustLevelSettings Trust level settings for the filter.
 *
 * @returns {Promise<CompileResult>} Promise which resolves to compiled data for the filter.
 */
const compile$1 = async function (filterDir, filterName, templateContent, trustLevelSettings) {
    let result = [];
    const excluded = [];

    // collect invalid rules for report
    // https://github.com/AdguardTeam/FiltersCompiler/issues/87
    const invalid = [];

    const lines = splitLines(templateContent);
    // eslint-disable-next-line no-restricted-syntax
    for (const line of lines) {
        if (line.startsWith(INCLUDE_DIRECTIVE)) {
            // eslint-disable-next-line no-await-in-loop
            const { includedLines, shouldIgnoreTrustLevel } = await include(filterDir, line, excluded);

            let includedRules = [];

            includedLines.forEach((line) => includedRules.push(line.trim()));

            // eslint-disable-next-line no-await-in-loop
            includedRules = await prepareAdgRules(
                filterDir,
                filterName,
                includedRules,
                excluded,
                invalid,
            );

            if (shouldIgnoreTrustLevel) {
                logger.info(`Ignoring trust level for ${filterName} due to @include directive: ${line}`);
            } else {
                logger.info(`Applying trust-level exclusions to ${filterName} @include directive: ${line}`);
                includedRules = exclude(includedRules, trustLevelSettings, excluded);
            }

            // 'for' loop is used in purpose instead of spread operator
            // to avoid 'Maximum call stack size exceeded' error on large number of rules
            for (let i = 0; i < includedRules.length; i += 1) {
                result.push(includedRules[i]);
            }
        } else {
            let inlineRules = [line.trim()];

            // eslint-disable-next-line no-await-in-loop
            inlineRules = await prepareAdgRules(
                filterDir,
                filterName,
                inlineRules,
                excluded,
                invalid,
            );

            logger.info('Applying trust-level exclusions to inline template.txt rules...');
            inlineRules = exclude(inlineRules, trustLevelSettings, excluded);

            // 'for' loop is used in purpose instead of spread operator
            // to avoid 'Maximum call stack size exceeded' error on large number of rules
            for (let i = 0; i < inlineRules.length; i += 1) {
                result.push(inlineRules[i]);
            }
        }
    }

    result = result.filter((line) => !isDiffPathHeaderTag(line));

    const excludeFilePath = path$1.join(filterDir, EXCLUDE_FILE);
    result = exclude(result, excludeFilePath, excluded);

    result = validateAndFilterRules(result, excluded, invalid, filterName);

    return {
        lines: result,
        excluded,
        invalid,
    };
};

/**
 * Creates revision object,
 * doesn't increment version if hash is not changed
 *
 * @param {string} path - The path to the revision file.
 * @param {string} hash - The hash of the filter file.
 * @returns {{version: string, timeUpdated: number}}
 */
const makeRevision = function (path, hash) {
    const result = {
        version: '1.0.0.0',
        timeUpdated: new Date().getTime(),
        hash,
    };

    const current = readFile$1(path);
    if (current) {
        const currentRevision = JSON.parse(current);
        if (currentRevision.version) {
            result.version = currentRevision.version;

            if (currentRevision.timeUpdated) {
                result.timeUpdated = currentRevision.timeUpdated;
            }

            if (!currentRevision.hash || currentRevision.hash !== result.hash) {
                result.version = version.increment(currentRevision.version);
                result.timeUpdated = new Date().getTime();
            }
        }
    }

    return result;
};

/**
 * Builds filter txt file from directory contents
 *
 * @param {string} filterDir - The path to the directory containing filters.
 * @param {Array<number>} whitelist - An array whitelist filters IDs.
 * @param {Array<number>} blacklist - An array blacklist filters IDs.
 * @returns {Promise<void>} A promise that resolves when all filters and its subdirectories have been processed.
 */
const buildFilter = async function (filterDir, whitelist, blacklist) {
    const templateContent = readFile$1(path$1.join(filterDir, TEMPLATE_FILE));
    if (!templateContent) {
        throw new Error('Invalid template');
    }

    const metadata = JSON.parse(readFile$1(path$1.join(filterDir, METADATA_FILE)));

    const { filterId } = metadata;

    // check whether the filter is disabled after other checks to avoid unnecessary logging
    if (metadata.disabled) {
        logger.warn(`Filter ${filterId} skipped as disabled`);
        skipFilter(metadata);
        return;
    }

    if (whitelist && whitelist.length > 0 && whitelist.indexOf(filterId) < 0) {
        logger.info(`Filter ${filterId} skipped due to '--include' option`);
        return;
    }

    if (blacklist && blacklist.length > 0 && blacklist.indexOf(filterId) >= 0) {
        logger.info(`Filter ${filterId} skipped due to '--skip' option`);
        return;
    }

    const trustLevel = metadata.trustLevel ? metadata.trustLevel : DEFAULT_TRUST_LEVEL;
    // eslint-disable-next-line no-undef
    const trustLevelSettings = path$1.resolve(__dirname$3, TRUST_LEVEL_DIR, `exclusions-${trustLevel}.txt`);

    const { name: filterName } = metadata;
    logger.info(`Compiling ${filterName}`);
    const result = await compile$1(filterDir, filterName, templateContent, trustLevelSettings);

    if (!checkAffinityDirectives(result.lines)) {
        throw new Error(`Error validating !#safari_cb_affinity directive in filter ${filterId}`);
    }

    const compiled = result.lines;
    const { excluded, invalid } = result;

    addFilter(metadata, result, invalid);
    logger.info(`Compiled length:${compiled.length}`);
    logger.info(`Excluded length:${excluded.length}`);

    const compiledData = compiled.join('\r\n');

    logger.info(`Writing filter file, lines:${compiled.length}`);
    writeFile(path$1.join(filterDir, FILTER_FILE), compiledData);
    logger.info(`Writing excluded file, lines:${excluded.length}`);
    writeFile(path$1.join(filterDir, EXCLUDED_LINES_FILE), excluded.join('\r\n'));
    logger.info('Writing revision file..');

    // eslint-disable-next-line no-buffer-constructor
    const hash = Buffer.from(md5(compiledData, { asString: true })).toString('base64').trim();
    const revisionFile = path$1.join(filterDir, REVISION_FILE);
    const revision = makeRevision(revisionFile, hash);
    writeFile(revisionFile, JSON.stringify(revision, null, '\t'));
};

/**
 * Asynchronously parses a directory and processes filters based on the provided whitelist and blacklist.
 *
 * @param {string} filtersDir - The path to the directory containing filters.
 * @param {Array<number>} whitelist - An array whitelist filters IDs.
 * @param {Array<number>} blacklist - An array blacklist filters IDs.
 * @returns {Promise<void>} A promise that resolves when all filters and its subdirectories have been processed.
 */
const parseDirectory = async function (filtersDir, whitelist, blacklist) {
    const items = fs$1.readdirSync(filtersDir)
        .sort((a, b) => getFilterIdFromDirName(a) - getFilterIdFromDirName(b));

    // eslint-disable-next-line no-restricted-syntax
    for (const directory of items) {
        const filterDir = path$1.join(filtersDir, directory);
        if (fs$1.lstatSync(filterDir).isDirectory()) {
            const template = path$1.join(filterDir, TEMPLATE_FILE);
            if (fs$1.existsSync(template)) {
                logger.info(`Building filter ${directory}...`);
                // eslint-disable-next-line no-await-in-loop
                await buildFilter(filterDir, whitelist, blacklist);
                logger.info(`Filter ${directory} ok`);
            } else {
                // eslint-disable-next-line no-await-in-loop
                await parseDirectory(filterDir, whitelist, blacklist);
            }
        }
    }
};

/**
 * Asynchronously builds and processes filter files, generates platform data, and creates a report.
 *
 * @async
 * @function build
 * @param {string} filtersDir - The directory containing filter files to be processed.
 * @param {string} logFile - The path to the log file where logs will be written.
 * @param {string} reportFile - The path to the report file to be created.
 * @param {string} platformsPath - The path where platform data will be generated.
 * @param {Object} platformsConfig - The configuration object for platforms.
 * @param {Array<number>} whitelist - A list of filter file names to include in processing.
 * @param {Array<number>} blacklist - A list of filter file names to exclude from processing.
 * @returns {Promise<void>} A promise that resolves when the build process is complete.
 */
const build = async (
    filtersDir,
    logFile,
    reportFile,
    platformsPath,
    platformsConfig,
    whitelist,
    blacklist,
) => {
    logger.initialize(logFile);
    init(FILTER_FILE, METADATA_FILE, REVISION_FILE, platformsConfig, ADGUARD_FILTERS_SERVER_URL);

    await parseDirectory(filtersDir, whitelist, blacklist);

    logger.info('Generating platforms');
    await generate(filtersDir, platformsPath, whitelist, blacklist);
    logger.info('Generating platforms done');
    create(reportFile);
};

/* eslint-disable global-require */


const SCHEMA_EXTENSION = '.schema.json';
const OLD_MAC_V1_PLATFORM = 'mac';
const OLD_MAC_V2_PLATFORM = 'mac_v2';

/**
 * Loads all available schemas from dir
 *
 * @param {string} dir - The directory path containing the schema files.
 * @returns {Object} An object with keys - schema file names and values - parsed JSON schema objects.
 */
const loadSchemas = (dir) => {
    const schemas = {};

    const items = fs$1.readdirSync(dir);
    // eslint-disable-next-line no-restricted-syntax
    for (const f of items) {
        if (f.endsWith(SCHEMA_EXTENSION)) {
            const validationFileName = f.substr(0, f.indexOf(SCHEMA_EXTENSION));

            logger.info(`Loading schema for ${validationFileName}`);
            schemas[validationFileName] = JSON.parse(fs$1.readFileSync(path$1.join(dir, f)));
        }
    }

    return schemas;
};

/**
 * Recursively validates dir content with provided schemas
 *
 * @param dir
 * @param validator
 * @param schemas
 * @param oldSchemas
 * @param filtersRequiredAmount
 * @returns {boolean}
 */
const validateDir = (dir, validator, schemas, oldSchemas, filtersRequiredAmount) => {
    let items;
    try {
        items = fs$1.readdirSync(dir);
    } catch (e) {
        logger.info(e.message);
        return false;
    }
    // eslint-disable-next-line no-restricted-syntax
    for (const f of items) {
        const item = path$1.join(dir, f);
        if (fs$1.lstatSync(item).isDirectory()) {
            if (!validateDir(item, validator, schemas, oldSchemas)) {
                return false;
            }
        } else {
            const fileName = path$1.basename(item, '.json');
            let schema = schemas[fileName];

            // Validate `mac` (mac v1) dir with old schemas
            if (path$1.basename(path$1.dirname(item)) === OLD_MAC_V1_PLATFORM) {
                logger.info('Look up old schemas for mac directory');
                schema = oldSchemas[OLD_MAC_V1_PLATFORM][fileName];
            }

            // Validate `mac_v2` dir with old schemas
            if (path$1.basename(path$1.dirname(item)) === OLD_MAC_V2_PLATFORM) {
                logger.info('Look up old schemas for mac_v2 directory');
                schema = oldSchemas[OLD_MAC_V2_PLATFORM][fileName];
            }

            if (schema) {
                logger.info(`Validating ${item}`);

                const json = JSON.parse(fs$1.readFileSync(item));

                // Validate filters amount
                if (fileName === 'filters') {
                    if (json.filters.length < filtersRequiredAmount) {
                        logger.error(`Invalid filters amount in ${item}`);
                        return false;
                    }
                }

                const validate = validator.compile(schema);
                const valid = validate(json);

                // json can be updated with default values
                fs$1.writeFileSync(item, JSON.stringify(json, null, '\t'));

                // duplicate to .js file as well
                const jsFileName = `${fileName}.js`;
                fs$1.writeFileSync(
                    path$1.join(path$1.dirname(item), jsFileName),
                    JSON.stringify(json, null, '\t'),
                );

                if (!valid) {
                    logger.error(`Invalid json in ${item}, errors:`);
                    logger.error(validate.errors);
                    return false;
                }
            }
        }
    }

    return true;
};

/**
 * Validates json schemas for all the filters.json and filters_i18n.json found in platforms path
 *
 * @param platformsPath - Path to platforms folder
 * @param jsonSchemasConfigDir - Path to json schemas config folder
 * @param filtersRequiredAmount - Minimum required amount of filters
 */
const validate$1 = (platformsPath, jsonSchemasConfigDir, filtersRequiredAmount) => {
    logger.info('Validating json schemas for platforms');

    const schemas = loadSchemas(jsonSchemasConfigDir);

    const oldSchemasMacV1 = loadSchemas(path$1.join(jsonSchemasConfigDir, OLD_MAC_V1_PLATFORM));
    const oldSchemasMacV2 = loadSchemas(path$1.join(jsonSchemasConfigDir, OLD_MAC_V2_PLATFORM));
    const oldSchemas = {
        [OLD_MAC_V1_PLATFORM]: oldSchemasMacV1,
        [OLD_MAC_V2_PLATFORM]: oldSchemasMacV2,
    };

    const ajv = new Ajv({
        allErrors: true,
        useDefaults: true,
    });

    const result = validateDir(platformsPath, ajv, schemas, oldSchemas, filtersRequiredAmount);

    logger.info('Validating json schemas for platforms - done');
    logger.info(`Validation result: ${result}`);

    return result;
};

const schemaValidator = { validate: validate$1 };

/* eslint-disable global-require */

const __dirname$2 = path$1.dirname(url.fileURLToPath((typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('index.cjs', document.baseURI).href))));

/**
 * Each filter, group, tag should have two keys.
 */
const REQUIRED_ENDINGS = [
    'name',
    'description',
];

const LOCALES_FILE_EXTENSION = '.json';
const BASE_LOCALE = 'en';

const REQUIRED_FILES = [
    'filters',
    'groups',
    'tags',
].map((el) => `${el}${LOCALES_FILE_EXTENSION}`);

// each message key should consist of three parts
// e.g. 'filter.3.name' or 'tag.29.description'
const MESSAGE_KEY_NAME_PARTS_COUNT = 3;

const WARNING_REASONS = {
    MISSED_FILES: 'missed files',
    NO_MESSAGES: 'empty file or no messages in file',
    INVALID_DATA_OBJ: 'invalid or absent message key/value',
};

const WARNING_TYPES = {
    CRITICAL: 'critical',
    LOW: 'low',
};

/**
 * Sync reads file content
 * @param filePath - path to locales file
 */
const readFile = (filePath) => fs$1.readFileSync(path$1.resolve(__dirname$2, filePath), 'utf8');

/**
 * Sync reads directory content
 * @param dirPath - path to directory
 */
const readDir = (dirPath) => fs$1.readdirSync(path$1.resolve(__dirname$2, dirPath), 'utf8');

/**
 * Validates messages keys
 * @param {Array} keys locale messages keys
 * @param {string} id filters / groups / tags
 */
const areValidMessagesKeys = (keys, id) => {
    if (keys.length !== REQUIRED_ENDINGS.length) {
        return false;
    }
    const areValidKeys = !keys
        .find((key) => {
            const keyNameParts = key.split('.');
            const propPrefix = id.slice(0, -1);
            const filterId = Number(keyNameParts[1]);
            return keyNameParts.length !== MESSAGE_KEY_NAME_PARTS_COUNT
                || keyNameParts[0] !== propPrefix
                || !(Number.isInteger(filterId))
                || !(filterId > 0)
                || !(REQUIRED_ENDINGS.includes(keyNameParts[2]));
        });
    return areValidKeys;
};

/**
 * Validates locale messages values
 * @param {string[]} values
 */
const areValidMessagesValues = (values) => values.every((v) => v !== '');

/**
 * Prepares invalid locales data object for results
 * @param {Object} obj iterable locales messages object
 * @returns {Array}
 */
const prepareWarningDetails = (obj) => Object.entries(obj).map(([key, value]) => `"${key}": "${value}"`);

/**
 * Returns map of base locale keys
 * @param dirPath
 */
const getBaseLocaleKeys = (dirPath) => {
    const baseLocaleKeys = {};

    const baseLocalePath = path$1.join(dirPath, BASE_LOCALE);
    const baseLocaleFiles = readDir(baseLocalePath);

    baseLocaleFiles.forEach((fileName) => {
        const baseLocaleData = JSON.parse(readFile(path$1.join(baseLocalePath, fileName)));
        baseLocaleKeys[fileName] = baseLocaleData.flatMap((entry) => Object.keys(entry));
    });
    return baseLocaleKeys;
};

/**
 * Compares messagesData keys to base locale keys
 * @param baseLocaleKeys
 * @param messagesData
 * @param localeWarnings
 */
const compareKeys = (baseLocaleKeys, messagesData, localeWarnings) => {
    const messagesDataKeys = messagesData.flatMap((entry) => Object.keys(entry));

    baseLocaleKeys.forEach((entry) => {
        if (!messagesDataKeys.includes(entry)) {
            localeWarnings.push([
                WARNING_TYPES.CRITICAL,
                WARNING_REASONS.INVALID_DATA_OBJ,
                [entry],
            ]);
        }
    });
};

/**
 * Prepares raw warnings for results
 * @param {Array[]} warnings collected raw warnings
 * @returns {Warning[]}
 */
const prepareWarnings = (warnings) => warnings.map(([type, reason, details]) => ({ type, reason, details }));

/**
 * @typedef {Object} Warning
 * @property {string} type
 * @property {string} reason
 * @property {string[]} details
 */

/**
 * @typedef {Object} Result
 * @property {string} locale
 * @property {Warning[]} warnings
 */

/**
 * Logs collected results of locales validation
 * @param {Result[]} results
 * @returns {string}
 */
const createLog = (results) => {
    const log = [];
    log.push('There are issues with:');
    results.forEach((res) => {
        log.push(`- ${res.locale}:`);
        res.warnings.forEach((warning) => {
            log.push(`  - ${warning.type} priority - ${warning.reason}:`);
            warning.details.forEach((detail) => {
                log.push(`      ${detail}`);
            });
        });
    });
    return log.join('\n');
};

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} ok
 * @property {Result[]} data
 * @property {string} log
 */

/**
 * Validates locales messages
 * @param {string} dirPath relative path to locales directory
 * @returns {ValidationResult}
 */
const validate = (dirPath, requiredLocales) => {
    logger.info('Validating locales...');
    const results = [];
    let locales;
    try {
        locales = readDir(dirPath);
    } catch (e) {
        throw new Error(`There is no locales dir '${dirPath}'`);
    }

    if (locales.length === 0) {
        throw new Error(`Locales dir '${dirPath}' is empty`);
    }

    const baseLocaleKeysMap = getBaseLocaleKeys(dirPath);

    locales.forEach((locale) => {
        const localeWarnings = [];
        const filesList = readDir(path$1.join(dirPath, locale));
        // checks all needed files presence
        const missedFiles = REQUIRED_FILES
            .filter((el) => !filesList.includes(el));
        if (missedFiles.length !== 0) {
            localeWarnings.push([
                // if there are missedFiles, we consider it's critical
                WARNING_TYPES.CRITICAL,
                WARNING_REASONS.MISSED_FILES,
                missedFiles,
            ]);
        }

        const presentFiles = REQUIRED_FILES
            .filter((el) => !missedFiles.includes(el));

        // iterate over existent files
        presentFiles.forEach((fileName) => {
            const messagesPath = path$1.join(dirPath, locale, fileName);
            let messagesData;
            try {
                messagesData = JSON.parse(readFile(messagesPath));
            } catch (e) {
                localeWarnings.push([
                    // if there is invalid data format, we consider it's critical
                    WARNING_TYPES.CRITICAL,
                    WARNING_REASONS.NO_MESSAGES,
                    [fileName],
                ]);
                return;
            }

            if (messagesData.length === 0) {
                // for some locales there is no translations
                // so it should bt critical only for required (our) locales
                const warningType = requiredLocales.includes(locale)
                    ? WARNING_TYPES.CRITICAL
                    : WARNING_TYPES.LOW;
                localeWarnings.push([
                    warningType,
                    WARNING_REASONS.NO_MESSAGES,
                    [fileName],
                ]);
            }

            if (requiredLocales.includes(locale)) {
                // check if all keys from base locale are presented in messagesData
                compareKeys(baseLocaleKeysMap[fileName], messagesData, localeWarnings);
            }

            messagesData.forEach((obj) => {
                const messagesKeys = Object.keys(obj);
                const messagesValues = Object.values(obj);
                const extensionLength = LOCALES_FILE_EXTENSION.length;
                const id = fileName.slice(0, -extensionLength);
                if (!areValidMessagesKeys(messagesKeys, id)
                    || !areValidMessagesValues(messagesValues)) {
                    localeWarnings.push([
                        // invalid messages data object is always critical
                        WARNING_TYPES.CRITICAL,
                        WARNING_REASONS.INVALID_DATA_OBJ,
                        prepareWarningDetails(obj),
                    ]);
                }
            });
        });

        if (localeWarnings.length !== 0) {
            const warnings = prepareWarnings(localeWarnings);
            results.push({ locale, warnings });
        }
    });

    if (results.length === 0) {
        logger.info('Validation result: OK');
        return { ok: true };
    }

    const isOK = !results
        .some((res) => {
            const isCriticalWarning = res.warnings
                .some((warning) => warning.type === WARNING_TYPES.CRITICAL);
            return isCriticalWarning;
        });
    const resultsLog = createLog(results);
    if (isOK) {
        logger.warn(resultsLog);
    } else {
        logger.error(resultsLog);
    }

    return { ok: isOK, data: results, log: resultsLog };
};

const localesValidator = { validate };

/**
 * @file Platforms configuration.
 *
 * It shall be overridden by custom configuration:
 * @see {@link https://github.com/AdguardTeam/FiltersRegistry/blob/master/scripts/build/custom_platforms.js}
 *
 * IMPORTANT: During making any changes in this file,
 * the custom_platforms.js should also be updated through PR on GitHub.
 */

/**
 * Pattern to check if rule contains `$domain` modifier with regular expression
 *
 * In Safari, `if-domain` and `unless-domain` do not support regexps, only `*`
 * https://github.com/AdguardTeam/FiltersRegistry/pull/806
 *
 * @example
 * ```[$domain=/^inattv\d+\.pro$/]#%#//scriptlet('set-constant', 'config.adv', 'emptyObj')```
 */
const DOMAIN_WITH_REGEXPS_PATTERNS = [
    '\\$domain=\/',
    ',domain=\/',
];

/**
 * Pattern to check if rule contains `$all` modifier
 *
 * @example
 * ```/?t=popunder&$all```
 */
const ALL_MODIFIER_PATTERNS = [
    '\\$all',
];

/**
 * Pattern to check if rule contains `$mp4` modifier
 *
 * @example
 * ```Deprecated, use $redirect=noopmp4-1s instead```
 */
const MP4_MODIFIER_PATTERNS = [
    '\\$(.*,)?mp4',
];

/**
 * Pattern to check if rule contains `$network` modifier
 *
 * @example
 * ```57.128.71.215$network```
 */
const NETWORK_MODIFIER_PATTERNS = [
    '\\$network',
];

/**
 * Pattern to check if rule contains `$webrtc` modifier
 *
 * @example
 * ```Removed and no longer supported```
 */
const WEBRTC_MODIFIER_PATTERNS = [
    '\\$webrtc',
];

/**
 * Pattern to check if rule contains `$csp` modifier
 *
 * @example
 * ```||deloplen.com^$csp=script-src 'none'```
 */
const CSP_MODIFIER_PATTERNS = [
    '\\$csp',
];

/**
 * Pattern to check if rule contains `$$` modifier
 *
 * Do not exclude scriptlets which contain '$$' when excluding '$$' and '$@$' rules
 * https://github.com/AdguardTeam/FiltersRegistry/issues/731
 *
 * @example
 * ```mail.com$$script[tag-content="uabp"][min-length="20000"][max-length="300000"]```
 */
const HTML_FILTERING_MODIFIER_PATTERNS = [
    '^((?!#%#).)*\\$\\$|\\$\\@\\$',
];

/**
 * Pattern to check if rule contains `$protobuf` modifier
 * and does not contain non-basic modifiers like `$domain` or `$path`.
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!#|(path|domain)=.*]|.*removeparam=).*` — negative lookahead to exclude CSS rules (#$#) and rules like
 *   `[$path=...]##.textad,protobuf` and rules with `$removeparam` modifier like `$removeparam=protobuf`
 * - `.*protobuf` — protobuf modifier itself
 * - `(,|=|$)` — end of line or modifiers divider, as `$protobuf` can be followed by other modifiers (`,`),
 *   it may have a value (`=`), or it may be the last modifier in the rule (`$`).
 *
 * Currently it is not supported, but it can be added in the future
 * https://github.com/AdguardTeam/CoreLibs/issues/1778
 */
const PROTOBUF_MODIFIER_PATTERNS = [
    '\\$(?!#|(path|domain)=.*]|.*removeparam=).*protobuf(,|=|$)',
];

/**
 * Pattern to check if rule contains `$app` modifier
 * and does not contain non-basic modifiers like `$domain` or `$path`.
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!#|(path|domain)=.*]|.*removeparam=).*` — negative lookahead to exclude CSS rules (#$#) and rules like
 *   `[$path=...]##.textad,[app="ads"]` and rules with `$removeparam` modifier like `$removeparam=app=ads`
 * - `.*app=` — app= modifier itself
 *
 * @example
 * ```@@||imasdk.googleapis.com^$app=tv.htv.app```
 */
const APP_MODIFIER_PATTERNS = [
    '\\$(?!#|(path|domain)=.*]|.*removeparam=).*app=',
];

/**
 * Pattern to check if rule contains `$extension` modifier
 * and does not contain non-basic modifiers like `$domain` or `$path`.
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!#|(path|domain)=.*]|.*removeparam=).*` — negative lookahead to exclude CSS rules (#$#) and rules like
 *   `[$path=...]##.textad,extension` and rules with `$removeparam` modifier like `$removeparam=extension`
 * - `.*extension` — extension modifier itself
 * - `(,|=|$)` — end of line or modifiers divider, as `$extension` can be followed by other modifiers (`,`),
 *   it may have a value (`=`), or it may be the last modifier in the rule (`$`).
 *
 * @example
 * ```@@||radar.cloudflare.com^$elemhide,extension,content```
 */
const EXTENSION_MODIFIER_PATTERNS = [
    '\\$(?!#|(path|domain)=.*]|.*removeparam=).*extension(,|=|$)',
];

/**
 * Pattern to check if rule contains only `$content` modifier.
 *
 * @example
 * ```@@||telegram.hr^$content```
 */
const ONLY_CONTENT_MODIFIER_PATTERNS = [
    '\\$content$',
];

/**
 * Pattern to check if rule contains `$content` modifier
 * and does not contain non-basic modifiers like `$domain` or `$path`.
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!#|(path|domain)=.*]|.*removeparam=).*` — negative lookahead to exclude CSS rules (#$#) and rules like
 *   `[$path=...]##.textad,content` and rules with `$removeparam` modifier like `$removeparam=content`
 * - `.*content` — content modifier itself
 * - `(,|$)` — end of line or modifiers divider, as `$content` can be followed by other modifiers (`,`).
 *
 * @example
 * ```@@||dnsleaktest.com^$content,elemhide,jsinject```
 */
const CONTENT_MODIFIER_PATTERNS = [
    '\\$(?!#|(path|domain)=.*]|.*removeparam=).*content(,|$)',
];

/**
 * Pattern to check if rule contains `$jsinject` modifier
 * and does not contain non-basic modifiers like `$domain` or `$path`.
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!#|(path|domain)=.*]|.*removeparam=).*` — negative lookahead to exclude CSS rules (#$#) and rules like
 *   `[$path=...]##.textad,jsinject` and rules with `$removeparam` modifier like `$removeparam=jsinject`
 * - `.*jsinject` — jsinject modifier itself
 * - `(,|$)` — end of line or modifiers divider, as `$jsinject` can be followed by other modifiers (`,`).
 *
 * @example
 * ```@@://www.atlassian.com^$elemhide,jsinject,extension```
 */
const JSINJECT_MODIFIER_PATTERNS = [
    '\\$(?!#|(path|domain)=.*]|.*removeparam=).*jsinject(,|$)',
];

/**
 * Pattern to check if rule contains `$urlblock` modifier
 * and does not contain non-basic modifiers like `$domain` or `$path`.
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!#|(path|domain)=.*]|.*removeparam=).*` — negative lookahead to exclude CSS rules (#$#) and rules like
 *   `[$path=...]##.textad,urlblock` and rules with `$removeparam` modifier like `$removeparam=urlblock`
 * - `.*urlblock` — urlblock modifier itself
 * - `(,|$)` — end of line or modifiers divider, as `$urlblock` can be followed by other modifiers (`,`).
 *
 * @example
 * ```@@||google.com/settings/ads/onweb$urlblock```
 */
const URLBLOCK_MODIFIER_PATTERNS = [
    '\\$(?!#|(path|domain)=.*]|.*removeparam=).*urlblock(,|$)',
];

/**
 * Pattern to check if rule contains `$referrerpolicy` modifier
 * and does not contain non-basic modifiers like `$domain` or `$path`.
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!#|(path|domain)=.*]|.*removeparam=).*` — negative lookahead to exclude CSS rules (#$#) and rules like
 *   `[$path=...]##.textad,referrerpolicy` and rules with `$removeparam` modifier like `$removeparam=referrerpolicy`
 * - `.*referrerpolicy` — referrerpolicy modifier itself
 * - `(,|=|$)` — end of line or modifiers divider, as `$referrerpolicy` can be followed by other modifiers (`,`),
 *   it may have a value (`=`), or it may be the last modifier in the rule (`$`).
 *
 * @example
 * ```||yallo.tv^$referrerpolicy=origin```
 */
const REFERRERPOLICY_MODIFIER_PATTERNS = [
    '\\$(?!#|(path|domain)=.*]|.*removeparam=).*referrerpolicy(,|=|$)',
];

/**
 * Pattern to check if rule contains `$replace` modifier
 * and does not contain non-basic modifiers like `$domain` or `$path`.
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!#|(path|domain)=.*]|.*removeparam=).*` — negative lookahead to exclude CSS rules (#$#) and rules like
 *   `[$path=...]##.textad,[replace="ads"]` and rules with `$removeparam` modifier like `$removeparam=replace=ads`
 * - `.*replace` — replace modifier itself
 * - `(,|=|$)` — end of line or modifiers divider, as `$replace` can be followed by other modifiers (`,`),
 *   it may have a value (`=`), or it may be the last modifier in the rule (`$`).
 *
 * @example
 * ```||pubads.g.doubleclick.net/gampad/live/ads?correlator=$replace=/(<VAST[\s\S]*?>)[\s\S]*<\/VAST>/\$1<\/VAST>/```
 */
const REPLACE_MODIFIER_PATTERNS = [
    '\\$(?!#|(path|domain)=.*]|.*removeparam=).*replace(,|=|$)',
];

/* eslint-disable max-len */

/**
 * Pattern to check if rule contains `$hls` modifier
 * and does not contain non-basic modifiers like `$domain` or `$path`.
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!#|(path|domain)=.*]|.*removeparam=).*` — negative lookahead to exclude CSS rules (#$#) and rules like
 *   `[$path=...]##.textad,[hls="ads"]` and rules with `$removeparam` modifier like `$removeparam=hls=ads`
 * - `.*hls` — hls modifier itself
 * - `(,|=|$)` — end of line or modifiers divider, as `$hls` can be followed by other modifiers (`,`),
 *   it may have a value (`=`), or it may be the last modifier in the rule (`$`).
 *
 * @example
 * ```||pubads.g.doubleclick.net/ondemand/hls/*.m3u8$hls=/redirector\.googlevideo\.com\/videoplayback[\s\S]*?dclk_video_ads/,domain=10play.com.au```
 */
const HLS_MODIFIER_PATTERNS = [
    '\\$(?!#|(path|domain)=.*]|.*removeparam=).*hls(,|=|$)',
];

/**
 * Pattern to check if rule contains `$jsonprune` modifier
 * and does not contain non-basic modifiers like `$domain` or `$path`.
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!#|(path|domain)=.*]|.*removeparam=).*` — negative lookahead to exclude CSS rules (#$#) and rules like
 *   `[$path=...]##.textad,[jsonprune="ads"]` and rules with `$removeparam` modifier like `$removeparam=jsonprune`
 * - `.*jsonprune` — jsonprune modifier itself
 * - `(,|=|$)` — end of line or modifiers divider, as `$jsonprune` can be followed by other modifiers (`,`),
 *   it may have a value (`=`), or it may be the last modifier in the rule (`$`).
 *
 * @example
 * ```.com/watch?v=$xmlhttprequest,jsonprune=\$..[adPlacements\, adSlots\, playerAds],domain=youtubekids.com|youtube-nocookie.com|youtube.com```
 */
const JSONPRUNE_MODIFIER_PATTERNS = [
    '\\$(?!#|(path|domain)=.*]|.*removeparam=).*jsonprune(,|=|$)',
];

/* eslint-enable max-len */

/**
 * Pattern to check if rule contains `$removeparam` modifier
 * and does not contain non-basic modifiers like `$domain` or `$path`.
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!#|(path|domain)=.*]).*` — negative lookahead to exclude CSS rules (#$#) and rules like
 *   `[$path=...]##.textad,[removeparam="ads"]`
 * - `.*removeparam` — removeparam modifier itself
 * - `(,|=|$)` — end of line or modifiers divider, as `$removeparam` can be followed by other modifiers (`,`),
 *   it may have a value (`=`), or it may be the last modifier in the rule (`$`).
 *
 * @example
 * ```$removeparam=fb_ref```
 */
const REMOVEPARAM_MODIFIER_PATTERNS = [
    '\\$(?!#|(path|domain)=.*]).*removeparam(,|=|$)',
];

/**
 * Pattern to check if rule contains `$removeheader` modifier
 * and does not contain non-basic modifiers like `$domain` or `$path`.
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!#|(path|domain)=.*]|.*removeparam=).*` — negative lookahead to exclude CSS rules (#$#) and rules like
 *   `[$path=...]##.textad,[removeheader="ads"]` and rules with `$removeparam` modifier like `$removeparam=removeheader`
 * - `.*removeheader` — removeheader modifier itself
 * - `(,|=|$)` — end of line or modifiers divider, as `$removeheader` can be followed by other modifiers (`,`),
 *   it may have a value (`=`), or it may be the last modifier in the rule (`$`).
 *
 * @example
 * ```||dubznetwork.com^$removeheader=refresh```
 */
const REMOVEHEADER_MODIFIER_PATTERNS = [
    '\\$(?!#|(path|domain)=.*]|.*removeparam=).*removeheader(,|=|$)',
];

/**
 * Pattern to check if rule contains `$stealth` modifier
 * and does not contain non-basic modifiers like `$domain` or `$path`.
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!#|(path|domain)=.*]|.*removeparam=).*` — negative lookahead to exclude CSS rules (#$#) and rules like
 *  `[$path=...]##.textad,[stealth="ads"]` and rules with `$removeparam` modifier like `$removeparam=stealth`
 * - `.*stealth` — stealth modifier itself
 * - `(,|=|$)` — end of line or modifiers divider, as `$stealth` can be followed by other modifiers (`,`),
 *   it may have a value (`=`), or it may be the last modifier in the rule (`$`).
 *
 * @example
 * ```@@.php?play_vid=$subdocument,stealth=referrer,domain=xyflv.cc```
 */
const STEALTH_MODIFIER_PATTERNS = [
    '\\$(?!#|(path|domain)=.*]|.*removeparam=).*stealth(,|=|$)',
];

/**
 * Pattern to check if rule contains `$cookie` modifier
 * and does not contain non-basic modifiers like `$domain` or `$path`.
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!#|(path|domain)=.*]|.*removeparam=).*` — negative lookahead to exclude CSS rules (#$#) and rules like
 *   `[$path=...]##.textad,cookie` and rules with `$removeparam` modifier like `$removeparam=cookie`
 * - `.*cookie` — cookie modifier itself
 * - `(,|=|$)` — end of line or modifiers divider, as `$cookie` can be followed by other modifiers (`,`),
 *   it may have a value (`=`), or it may be the last modifier in the rule (`$`).
 *
 * @example
 * ```$cookie=_ga```
 */
const COOKIE_MODIFIER_PATTERNS = [
    '\\$(?!#|(path|domain)=.*]|.*removeparam=).*cookie(,|=|$)',
];

/**
 * Pattern to check if rule contains `$redirect` modifier
 * and does not contain non-basic modifiers like `$domain` or `$path`.
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!#|(path|domain)=.*]|.*removeparam=).*` — negative lookahead to exclude CSS rules (#$#) and rules like
 *   `[$path=...]##.textad,redirect` and rules with `$removeparam` modifier like `$removeparam=redirect`
 * - `.*redirect` — redirect modifier itself
 * - `(,|=|$)` — end of line or modifiers divider, as `$redirect` can be followed by other modifiers (`,`),
 *   it may have a value (`=`), or it may be the last modifier in the rule (`$`).
 *
 * @example
 * ```||google-analytics.com/analytics.js$script,redirect=google-analytics,domain=~olx.*|~banki.ru|~bigc.co.th```
 */
const REDIRECT_MODIFIER_PATTERNS = [
    '\\$(?!#|(path|domain)=.*]|.*removeparam=).*redirect(,|=|$)',
];

/**
 * Pattern to check if rule contains `$redirect-rule` modifier
 * and does not contain non-basic modifiers like `$domain` or `$path`.
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!#|(path|domain)=.*]|.*removeparam=).*` — negative lookahead to exclude CSS rules (#$#) and rules like
 *   `[$path=...]##.textad,redirect-rule` and rules with `$removeparam` modifier like `$removeparam=redirect-rule`
 * - `.*redirect-rule` — redirect-rule modifier itself
 * - `(,|=|$)` — end of line or modifiers divider, as `$redirect-rule` can be followed by other modifiers (`,`),
 *   it may have a value (`=`), or it may be the last modifier in the rule (`$`).
 *
 * @example
 * ```$script,third-party,redirect-rule=noopjs,domain=paraphraser.io```
 */
const REDIRECT_RULE_MODIFIER_PATTERNS = [
    '\\$(?!#|(path|domain)=.*]|.*removeparam=).*redirect-rule(,|=|$)',
];

/**
 * Pattern to check if rule contains `$empty` modifier
 * and does not contain non-basic modifiers like `$domain` or `$path`.
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!#|(path|domain)=.*]|.*removeparam=).*` — negative lookahead to exclude CSS rules (#$#) and rules like
 *   `[$path=...]##.textad,empty` and rules with `$removeparam` modifier like `$removeparam=empty`
 * - `.*empty` — empty modifier itself
 * - `(,|$)` — end of line or modifiers divider, as `$empty` can be followed by other modifiers (`,`).
 *
 * @example
 * ```Deprecated, use $redirect=nooptext instead```
 */
const EMPTY_MODIFIER_PATTERNS = [
    '\\$(?!#|(path|domain)=.*]|.*removeparam=).*empty(,|$)',
];

/**
 * Pattern to detect scriptlets and JavaScript rules
 *
 * @example
 * ```w3resource.com#%#//scriptlet('prevent-setTimeout', 'ins.adsbygoogle')```
 * @example
 * ```meczyki.pl#%#!function(){window.YLHH={bidder:{startAuction:function(){}}};}();```
 */
const JAVASCRIPT_RULES_PATTERNS = [
    '#%#',
    '#@%#',
];

/**
 * Pattern to detect CSS rules
 *
 * @example
 * ```windowslite.net#$#body { overflow: auto !important; }```
 */
const CSS_RULES_PATTERNS = [
    '#\\$#',
    '#@\\$#',
];

/**
 * Pattern to detect CSS rules with `@media` queries
 *
 * @example
 * ```windowslite.net#$#body { overflow: auto !important; }```
 */
const CSS_MEDIA_RULES_PATTERNS = [
    '#\\$#@media ',
];

/**
 * Patterns to match unblocking basic rules with `$important` modifier
 * which is not supported by uBlock Origin.
 *
 * @see {@link https://github.com/AdguardTeam/FiltersCompiler/issues/200}
 */
const UNBLOCKING_IMPORTANT_RULES_PATTERNS = [
    '@@.*?(\\$|,)important',
];

/**
 * Pattern to detect Extended CSS rules
 *
 * @example
 * ```xup.in#?##xupab```
 * @example
 * ```lunar.az#?#.sagpanel div[class^="yenisb"]:contains(Reklam)```
 * @example
 * ```haal.fashion#?#div:has(> div > div > div.dfp-ad-unit)```
 */
const EXTENDED_CSS_RULES_PATTERNS = [
    '\\[-ext-',
    ':has\\(',
    ':has-text\\(',
    ':contains\\(',
    ':matches-css\\(',
    ':matches-attr\\(',
    ':matches-property\\(',
    ':xpath\\(',
    ':nth-ancestor\\(',
    ':upward\\(',
    ':remove\\(',
    ':matches-css-before\\(',
    ':matches-css-after\\(',
    ':-abp-has\\(',
    ':-abp-contains\\(',
    '#\\?#',
    '#\\$\\?#',
    '#@\\?#',
    '#@\\$\\?#',
];

/**
 * Used for `EXTENSION_CHROMIUM`, `EXTENSION_CHROMIUM_MV3`, `EXTENSION_EDGE`,
 * `EXTENSION_OPERA`, and `EXTENSION_OPERA_MV3` platforms.
 */
const CHROMIUM_BASED_EXTENSION_PATTERNS = [
    ...HTML_FILTERING_MODIFIER_PATTERNS,
    ...REPLACE_MODIFIER_PATTERNS,
    ...APP_MODIFIER_PATTERNS,
    ...NETWORK_MODIFIER_PATTERNS,
    ...PROTOBUF_MODIFIER_PATTERNS,
    ...EXTENSION_MODIFIER_PATTERNS,
    ...HLS_MODIFIER_PATTERNS,
    ...JSONPRUNE_MODIFIER_PATTERNS,
    ...REFERRERPOLICY_MODIFIER_PATTERNS,
    ...CONTENT_MODIFIER_PATTERNS,
];

/**
 * Used for `EXTENSION_SAFARI` and `IOS` platforms.
 */
const SAFARI_BASED_EXTENSION_PATTERNS = [
    ...DOMAIN_WITH_REGEXPS_PATTERNS,
    ...HTML_FILTERING_MODIFIER_PATTERNS,
    ...EXTENSION_MODIFIER_PATTERNS,
    ...REMOVEPARAM_MODIFIER_PATTERNS,
    ...REMOVEHEADER_MODIFIER_PATTERNS,
    ...MP4_MODIFIER_PATTERNS,
    ...REPLACE_MODIFIER_PATTERNS,
    ...STEALTH_MODIFIER_PATTERNS,
    ...COOKIE_MODIFIER_PATTERNS,
    ...APP_MODIFIER_PATTERNS,
    ...PROTOBUF_MODIFIER_PATTERNS,
    ...REDIRECT_MODIFIER_PATTERNS,
    ...REDIRECT_RULE_MODIFIER_PATTERNS,
    ...EMPTY_MODIFIER_PATTERNS,
    ...WEBRTC_MODIFIER_PATTERNS,
    ...CSP_MODIFIER_PATTERNS,
    ...ONLY_CONTENT_MODIFIER_PATTERNS,
    ...NETWORK_MODIFIER_PATTERNS,
    ...REFERRERPOLICY_MODIFIER_PATTERNS,
    ...HLS_MODIFIER_PATTERNS,
    ...JSONPRUNE_MODIFIER_PATTERNS,
];

/* eslint-disable max-len */
/**
 * Pattern to detect Extended CSS `:matches-property()` rules
 *
 * @example
 * ```unsplash.com#?#.ripi6 > div:matches-property(/__reactFiber/.return.return.memoizedProps.ad)```
 * @example
 * ```
 * androidauthority.com#?#main div[class]:has(> div[class]:matches-property(/__reactFiber/.return.memoizedProps.type=med_rect_atf))
 * ```
 */
const CSS_MATCHES_PROPERTY_RULES_PATTERNS = [
    ':matches-property\\(',
];

/**
 * Pattern to detect generic CSS rules
 *
 * @example
 * ```#$#div[class="adsbygoogle"][id="ad-detector"] { display: block !important; }```
 * @example
 * ```#$#.pub_728x90.text-ad.textAd.text_ad.text_ads.text-ads.text-ad-links { display: block !important; }```
 */
const CSS_GENERIC_RULES_PATTERNS = [
    '^#\\$#',
];

const platformsConfig = {
    'WINDOWS': {
        'platform': 'windows',
        'path': 'windows',
        'expires': '12 hours',
        'configuration': {
            'ignoreRuleHints': false,
            'replacements': null,
        },
        'defines': {
            'adguard': true,
            'adguard_app_windows': true,
        },
    },
    'MAC': {
        'platform': 'mac',
        'path': 'mac',
        'configuration': {
            'ignoreRuleHints': false,
            'replacements': null,
        },
        'defines': {
            'adguard': true,
            'adguard_app_mac': true,
        },
    },
    'MAC_V2': {
        'platform': 'mac',
        'path': 'mac_v2',
        'expires': '12 hours',
        'configuration': {
            'ignoreRuleHints': false,
            'replacements': null,
        },
        'defines': {
            'adguard': true,
            'adguard_app_mac': true,
        },
    },
    'MAC_V3': {
        'platform': 'mac',
        'path': 'mac_v3',
        'expires': '12 hours',
        'configuration': {
            'ignoreRuleHints': false,
            'replacements': null,
        },
        'defines': {
            'adguard': true,
            'adguard_app_mac': true,
        },
    },
    'ANDROID': {
        'platform': 'android',
        'path': 'android',
        'configuration': {
            'ignoreRuleHints': false,
            'replacements': null,
        },
        'defines': {
            'adguard': true,
            'adguard_app_android': true,
        },
    },
    'CLI': {
        'platform': 'cli',
        'path': 'cli',
        'expires': '12 hours',
        'configuration': {
            'ignoreRuleHints': false,
            'replacements': null,
        },
        'defines': {
            'adguard': true,
            'adguard_app_cli': true,
        },
    },
    'EXTENSION_CHROMIUM': {
        'platform': 'ext_chromium',
        'path': 'extension/chromium',
        'expires': '10 days',
        'configuration': {
            'removeRulePatterns': CHROMIUM_BASED_EXTENSION_PATTERNS,
            'replacements': null,
            'ignoreRuleHints': false,
        },
        'defines': {
            'adguard': true,
            'adguard_ext_chromium': true,
        },
    },
    'EXTENSION_CHROMIUM_MV3': {
        'platform': 'ext_chromium_mv3',
        'path': 'extension/chromium-mv3',
        'expires': '10 days',
        'configuration': {
            'removeRulePatterns': [
                ...CHROMIUM_BASED_EXTENSION_PATTERNS,
                ...REDIRECT_RULE_MODIFIER_PATTERNS,
            ],
            'replacements': null,
            'ignoreRuleHints': false,
        },
        'defines': {
            'adguard': true,
            'adguard_ext_chromium_mv3': true,
        },
    },
    'EXTENSION_EDGE': {
        'platform': 'ext_edge',
        'path': 'extension/edge',
        'expires': '10 days',
        'configuration': {
            'removeRulePatterns': CHROMIUM_BASED_EXTENSION_PATTERNS,
            'replacements': null,
            'ignoreRuleHints': false,
        },
        'defines': {
            'adguard': true,
            'adguard_ext_edge': true,
            'adguard_ext_chromium': true,
        },
    },
    'EXTENSION_OPERA': {
        'platform': 'ext_opera',
        'path': 'extension/opera',
        'expires': '10 days',
        'configuration': {
            'removeRulePatterns': CHROMIUM_BASED_EXTENSION_PATTERNS,
            'replacements': null,
            'ignoreRuleHints': false,
        },
        'defines': {
            'adguard': true,
            'adguard_ext_opera': true,
            'adguard_ext_chromium': true,
        },
    },
    'EXTENSION_OPERA_MV3': {
        'platform': 'ext_opera_mv3',
        'path': 'extension/opera-mv3',
        'expires': '10 days',
        'configuration': {
            'removeRulePatterns': [
                ...CHROMIUM_BASED_EXTENSION_PATTERNS,
                ...REDIRECT_RULE_MODIFIER_PATTERNS,
            ],
            'replacements': null,
            'ignoreRuleHints': false,
        },
        'defines': {
            'adguard': true,
            'adguard_ext_opera_mv3': true,
            'adguard_ext_chromium_mv3': true,
        },
    },
    'EXTENSION_FIREFOX': {
        'platform': 'ext_ff',
        'path': 'extension/firefox',
        'expires': '10 days',
        'configuration': {
            'removeRulePatterns': [
                ...HTML_FILTERING_MODIFIER_PATTERNS,
                ...APP_MODIFIER_PATTERNS,
                ...NETWORK_MODIFIER_PATTERNS,
                ...PROTOBUF_MODIFIER_PATTERNS,
                ...EXTENSION_MODIFIER_PATTERNS,
                ...HLS_MODIFIER_PATTERNS,
                ...JSONPRUNE_MODIFIER_PATTERNS,
                ...REFERRERPOLICY_MODIFIER_PATTERNS,

            ],
            'replacements': null,
            'ignoreRuleHints': false,
        },
        'defines': {
            'adguard': true,
            'adguard_ext_firefox': true,
        },
    },
    'EXTENSION_SAFARI': {
        'platform': 'ext_safari',
        'path': 'extension/safari',
        'configuration': {
            'removeRulePatterns': SAFARI_BASED_EXTENSION_PATTERNS,
            'replacements': null,
            'ignoreRuleHints': false,
        },
        'defines': {
            'adguard': true,
            'adguard_ext_safari': true,
        },
    },
    'IOS': {
        'platform': 'ios',
        'path': 'ios',
        'configuration': {
            'removeRulePatterns': SAFARI_BASED_EXTENSION_PATTERNS,
            'replacements': null,
            'ignoreRuleHints': false,
        },
        'defines': {
            'adguard': true,
            'adguard_app_ios': true,
        },
    },
    'EXTENSION_ANDROID_CONTENT_BLOCKER': {
        'platform': 'ext_android_cb',
        'path': 'extension/android-content-blocker',
        'configuration': {
            'removeRulePatterns': [
                ...DOMAIN_WITH_REGEXPS_PATTERNS,
                ...HTML_FILTERING_MODIFIER_PATTERNS,
                ...EXTENSION_MODIFIER_PATTERNS,
                ...REMOVEPARAM_MODIFIER_PATTERNS,
                ...REMOVEHEADER_MODIFIER_PATTERNS,
                ...JAVASCRIPT_RULES_PATTERNS,
                ...CSS_RULES_PATTERNS,
                ...MP4_MODIFIER_PATTERNS,
                ...REPLACE_MODIFIER_PATTERNS,
                ...STEALTH_MODIFIER_PATTERNS,
                ...COOKIE_MODIFIER_PATTERNS,
                ...EMPTY_MODIFIER_PATTERNS,
                ...APP_MODIFIER_PATTERNS,
                ...PROTOBUF_MODIFIER_PATTERNS,
                ...CSP_MODIFIER_PATTERNS,
                ...EXTENDED_CSS_RULES_PATTERNS,
                ...REDIRECT_MODIFIER_PATTERNS,
                ...REDIRECT_RULE_MODIFIER_PATTERNS,
                ...ONLY_CONTENT_MODIFIER_PATTERNS,
                ...ALL_MODIFIER_PATTERNS,
                ...NETWORK_MODIFIER_PATTERNS,
                ...REFERRERPOLICY_MODIFIER_PATTERNS,
                ...HLS_MODIFIER_PATTERNS,
                ...JSONPRUNE_MODIFIER_PATTERNS,
                ...JSINJECT_MODIFIER_PATTERNS,
                ...URLBLOCK_MODIFIER_PATTERNS,
            ],
            'ignoreRuleHints': false,
        },
        'defines': {
            'adguard': true,
            'adguard_ext_android_cb': true,
        },
    },
    'EXTENSION_UBLOCK': {
        'platform': 'ext_ublock',
        'path': 'extension/ublock',
        'configuration': {
            'removeRulePatterns': [
                ...HTML_FILTERING_MODIFIER_PATTERNS,
                ...MP4_MODIFIER_PATTERNS,
                ...REPLACE_MODIFIER_PATTERNS,
                ...STEALTH_MODIFIER_PATTERNS,
                ...COOKIE_MODIFIER_PATTERNS,
                ...APP_MODIFIER_PATTERNS,
                ...NETWORK_MODIFIER_PATTERNS,
                ...PROTOBUF_MODIFIER_PATTERNS,
                ...EXTENSION_MODIFIER_PATTERNS,
                ...JSINJECT_MODIFIER_PATTERNS,
                ...URLBLOCK_MODIFIER_PATTERNS,
                ...CONTENT_MODIFIER_PATTERNS,
                ...WEBRTC_MODIFIER_PATTERNS,
                ...CSS_MEDIA_RULES_PATTERNS,
                ...HLS_MODIFIER_PATTERNS,
                ...REFERRERPOLICY_MODIFIER_PATTERNS,
                ...JSONPRUNE_MODIFIER_PATTERNS,
                ...UNBLOCKING_IMPORTANT_RULES_PATTERNS,
                ...REMOVEHEADER_MODIFIER_PATTERNS,
                ...CSS_MATCHES_PROPERTY_RULES_PATTERNS, // TODO: remove when this issue is fixed - https://github.com/AdguardTeam/FiltersCompiler/issues/252
                ...CSS_GENERIC_RULES_PATTERNS,
            ],
            'ignoreRuleHints': false,
            'adbHeader': '![Adblock Plus 2.0]',
        },
        'defines': {
            'ext_ublock': true,
        },
    },
};

// Sets configuration compatibility
tsurlfilter.setConfiguration({ compatibility: tsurlfilter.CompatibilityTypes.Corelibs });

const __dirname$1 = path$1.dirname(url.fileURLToPath((typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('index.cjs', document.baseURI).href))));

const jsonSchemasConfigDir = path$1.join(__dirname$1, './schemas/');

process.on('unhandledRejection', (error) => {
    throw error;
});

const compile = (path, logPath, reportFile, platformsPath, whitelist, blacklist, customPlatformsConfig) => {
    if (customPlatformsConfig) {
        logger.info('Using custom platforms configuration');
        // eslint-disable-next-line no-restricted-syntax, guard-for-in
        for (const platform in customPlatformsConfig) {
            logger.info(`Redefining platform ${platform}`);
            platformsConfig[platform] = customPlatformsConfig[platform];
        }
    }

    return build(
        path,
        logPath,
        reportFile,
        platformsPath,
        platformsConfig,
        whitelist,
        blacklist,
    );
};

const validateJSONSchema = (platformsPath, requiredFiltersAmount) => {
    return schemaValidator.validate(platformsPath, jsonSchemasConfigDir, requiredFiltersAmount);
};

const validateLocales = (localesDirPath, requiredLocales) => {
    return localesValidator.validate(localesDirPath, requiredLocales);
};

exports.compile = compile;
exports.optimizationConfigLocal = optimizationConfigLocal;
exports.validateJSONSchema = validateJSONSchema;
exports.validateLocales = validateLocales;
