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

    testRunner.run({
        code: "./src/main/utils/version.js",
        tests: "./src/test/test-version.js"
    }, (err, report) => {
        console.log(err);
    });

    testRunner.run({
        code: "./src/main/rule/rule-parser.js",
        tests: "./src/test/test-rule-parser.js"
    }, (err, report) => {
        console.log(err);
    });

    testRunner.run({
        code: "./src/main/rule/rule.js",
        tests: "./src/test/test-rules.js"
    }, (err, report) => {
        console.log(err);
    });

    testRunner.run({
        code: "./src/main/converter.js",
        tests: "./src/test/test-converter.js"
    }, (err, report) => {
        console.log(err);
    });

    testRunner.run({
        code: "./src/main/validator.js",
        tests: "./src/test/test-validator.js"
    }, (err, report) => {
        console.log(err);
    });

    testRunner.run({
        code: "./src/main/sorting.js",
        tests: "./src/test/test-sorting.js"
    }, (err, report) => {
        console.log(err);
    });

    testRunner.run({
        code: "./src/main/platforms/filter.js",
        tests: "./src/test/test-platforms-filter.js"
    }, (err, report) => {
        console.log(err);
    });

    testRunner.run({
        deps: ["./src/main/utils/version.js", "./src/main/converter.js"],
        code: "./src/main/builder.js",
        tests: "./src/test/test-builder.js"
    }, (err, report) => {
        console.log(err);
    });
})();