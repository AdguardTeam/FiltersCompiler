/**
 * ExtendedCss is not supposed to work without window environment,
 * so we pass some wrapper dummy.
 */
// TODO: switch to aglint in compiler
import { TextEncoder, TextDecoder } from 'util';
import { createRequire } from 'module';

import { JSDOM } from 'jsdom';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const dom = new JSDOM('<!DOCTYPE html><p>Empty</p>');

global.window = dom.window;
global.document = global.window.document;
if (!global.navigator) {
    global.navigator = global.window.navigator;
}
global.Element = global.window.Element;

const require = createRequire(import.meta.url);
const { ExtendedCss } = require('@adguard/extended-css');

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
export const validateCssSelector = (selectorText) => {
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
