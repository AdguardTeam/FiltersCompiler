/* globals require, module */

module.exports = (function () {

    'use strict';

    var builder = require("./src/main/builder.js");

    var compile = function (path, logPath) {
        return builder.build(path, logPath);
    };

    return {
        compile: compile
    };
})();