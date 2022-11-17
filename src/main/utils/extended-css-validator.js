/* eslint-disable global-require */
module.exports = (function () {
    /**
     * ExtendedCss is not supposed to work without window environment,
     * so we pass some wrapper dummy.
     */
    const jsdom = require('jsdom');
    const { JSDOM } = jsdom;
    const dom = new JSDOM('<!DOCTYPE html><p>Empty</p>');
    global.window = dom.window;
    global.document = global.window.document;
    global.navigator = global.window.navigator;
    global.Element = global.window.Element;

    const { ExtendedCss } = require('@adguard/extended-css');

    // TODO: in future SelectorValidationResult from ExtendedCss may be imported and used instead of it
    /**
     * @typedef {Object} SelectorValidationResult
     * @property {boolean} ok selector validation status
     * @property {string|null} error reason of invalid selector for invalid selector
     * and `null` for valid one
     */

    /**
     * Validates css selector, uses ExtendedCss.validate() for it.
     *
     * @param selectorText
     *
     * @returns {SelectorValidationResult}
     */
    const validateCssSelector = function (selectorText) {
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

        return ExtendedCss.validate(selectorText);
    };

    return {
        validateCssSelector,
    };
}());
