/* globals require, module */

module.exports = (function () {

    'use strict';

    var builder = require("./src/compiler/builder.js");

    var compile = function (path) {
        return builder.build(path);
    };

    return {
        compile: compile
    };
})();