/* globals require, QUnit */

/**
 * @typedef {Object} assert
 * @property {function} equal
 * @property {function} ok
 * @property {function} notOk
 */

(() => {
    "use strict";

    const testRunner = require("qunit");

    const testCallback = function (err, report) {
        if (err) {
            console.error(err);
        }
    };

    testRunner.run({
        code: "./src/main/utils/version.js",
        tests: "./src/test/test-version.js"
    }, testCallback);

    testRunner.run({
        code: "./src/main/rule/rule-parser.js",
        tests: "./src/test/test-rule-parser.js"
    }, testCallback);

    testRunner.run({
        code: "./src/main/rule/rule.js",
        tests: "./src/test/test-rules.js"
    }, testCallback);

    testRunner.run({
        code: "./src/main/converter.js",
        tests: "./src/test/test-converter.js"
    }, testCallback);

    testRunner.run({
        code: "./src/main/validator.js",
        tests: "./src/test/test-validator.js"
    }, testCallback);

    testRunner.run({
        code: "./src/main/sorting.js",
        tests: "./src/test/test-sorting.js"
    }, testCallback);

    testRunner.run({
        code: "./src/main/optimization.js",
        tests: "./src/test/test-optimization.js"
    }, testCallback);

    testRunner.run({
        code: "./src/main/platforms/filter.js",
        tests: "./src/test/test-platforms-filter.js"
    }, testCallback);

    testRunner.run({
        deps: ["./src/main/utils/version.js", "./src/main/converter.js"],
        code: "./src/main/builder.js",
        tests: "./src/test/test-builder.js"
    }, testCallback);
})();