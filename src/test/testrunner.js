/* globals require, console */

var testrunner = require("qunit");

testrunner.run({
    code: "./src/main/utils/version.js",
    tests: "./src/test/test-version.js"
}, function(err, report) {
    //Do nothing
});

testrunner.run({
    code: "./src/main/converter.js",
    tests: "./src/test/test-converter.js"
}, function(err, report) {
    //Do nothing
});

testrunner.run({
    deps: ["./src/main/utils/version.js", "./src/main/converter.js"],
    code: "./src/main/builder.js",
    tests: "./src/test/test-builder.js"
}, function(err, report) {
    //Do nothing
});