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

    const ExtendedCss = require('../third-party/extended-css.js');

    /**
     * Validates css selector
     *
     * @param selectorText
     * @returns {boolean}
     */
    const validateCssSelector = function (selectorText) {
        try {
            // jsdom is crashing when selector is a script
            if (selectorText.indexOf('##script:contains') !== -1
                || selectorText.indexOf('##script:inject') !== -1) {
                return false;
            }

            // skip :before and :after selectors
            if (selectorText.match(/[^:\s]([:]{1,2}before(\s|$))|[^:\s]([:]{1,2}after(\s|$))/ig)) {
                return true;
            }

            // skip selectors with case-insensitive attribute, for example: div[class^="Abc_123" i]
            if (selectorText.match(/\[[a-z\d-_]+[\^$*]?=['"][^'"]+['"]\si]/g)) {
                return true;
            }

            ExtendedCss.query(selectorText, true);
            return true;
        } catch (ex) {
            return false;
        }
    };

    return {
        validateCssSelector,
    };
}());
