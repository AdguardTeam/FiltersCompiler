/* globals require, QUnit */

/**
 * @typedef {Object} assert
 * @property {function} equal
 * @property {function} ok
 * @property {function} notOk
 */

(() => {
    "use strict";

    let testRunner = require("qunit");

    testRunner.run({
        code: "./src/main/utils/version.js",
        tests: "./src/test/test-version.js"
    }, (err, report) => {
        //Do nothing
    });

    testRunner.run({
        code: "./src/main/converter.js",
        tests: "./src/test/test-converter.js"
    }, (err, report) => {
        //Do nothing
    });

    testRunner.run({
        code: "./src/main/sorting.js",
        tests: "./src/test/test-sorting.js"
    }, (err, report) => {
        //Do nothing
    });

    testRunner.run({
        deps: ["./src/main/utils/version.js", "./src/main/converter.js"],
        code: "./src/main/builder.js",
        tests: "./src/test/test-builder.js"
    }, (err, report) => {
        //Do nothing
    });
})();