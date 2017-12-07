/* globals require */

module.exports = (function () {

    'use strict';

    let builder = require("./src/main/builder.js");

    let compile = function (path, logPath, domainBlacklistFile, platformsPath) {
        return builder.build(path, logPath, domainBlacklistFile, platformsPath);
    };

    return {
        compile: compile
    };
})();