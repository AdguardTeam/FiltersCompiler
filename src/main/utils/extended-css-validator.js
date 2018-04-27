/* globals require, global */

module.exports = (function () {

    'use strict';

    /**
     * Loads module from string source
     *
     * @param src string
     * @returns {*}
     */
    function requireFromString(src) {
        const Module = module.constructor;
        const m = new Module();
        m._compile(src, __filename);
        return m.exports;
    }

    // Read external library as string
    const extendedCssString = require('fs').readFileSync(require.resolve('../third-party/extended-css.js'));

    /**
     * ExtendedCss is not supposed to work without window environment,
     * so we pass some wrapper dummy.
     */
    const jsdom = require("jsdom");
    const { JSDOM } = jsdom;
    const dom = new JSDOM(`<!DOCTYPE html><p>Empty</p>`);
    global.window = dom.window;
    global.document = global.window.document;
    global.navigator = global.window.navigator;
    global.Element = global.window.Element;

    // Load module from string, adding module exports at the end
    const ExtendedCss = requireFromString(extendedCssString + '\r\nmodule.exports = ExtendedCss;');

    /**
     * Validates css selector
     *
     * @param selectorText
     * @returns {boolean}
     */
    const validateCssSelector = function (selectorText) {
        try {
            ExtendedCss.query(selectorText, true);
            return true;
        } catch (ex) {
            return false;
        }
    };

    return {
        validateCssSelector: validateCssSelector
    };
})();