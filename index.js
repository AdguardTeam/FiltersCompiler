/* globals require */

module.exports = (function () {

    'use strict';

    let builder = require("./src/main/builder.js");

    let compile = function (path, logPath) {
        return builder.build(path, logPath);
    };

    return {
        compile: compile
    };
})();