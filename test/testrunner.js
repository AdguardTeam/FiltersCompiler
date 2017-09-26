/* globals require, console */

var testrunner = require("qunit");

testrunner.run({
    code: "./src/compiler/version.js",
    tests: "./test/test-version.js"
}, function(err, report) {
    //Do nothing
});

testrunner.run({
    deps: ["./src/compiler/version.js"],
    code: "./src/compiler/builder.js",
    tests: "./test/test-builder.js"
}, function(err, report) {
    //Do nothing
});