/* globals module, console, require */

module.exports = (function () {

    'use strict';

    var fs = require('fs');

    var file;
    var logLevel = "DEBUG";

    var levels = {
        "DEBUG": 0,
        "LOG": 1,
        "WARN": 2,
        "ERROR": 3
    };

    var appendFile = function (message, level) {
        if (file) {
            message = '[' + new Date().toLocaleTimeString() + '][' + level + ']: ' + message;
            message += '\r\n';

            fs.appendFile(file, message, function (err) {
                if (err) {
                    throw err;
                }
            });
        }
    };

    var isLevelIncluded = function (level) {
        return levels[logLevel] <= level;
    };

    /**
     * Initializes logger
     *
     * @param path log file
     * @param level log lvl
     */
    var initialize = function (path, level) {

        file = path;
        if (level) {
            logLevel = level;
        }

        if (file) {
            fs.openSync(file, 'w');
        } else {
            console.warn('Log file is not specified');
        }
    };

    /**
     * Writes log message
     *
     * @param message
     */
    var log = function (message) {
        if (isLevelIncluded(levels.LOG)) {
            console.log(message);
            appendFile(message, 'LOG');
        }
    };

    /**
     * Writes log message
     *
     * @param message
     */
    var warn = function (message) {
        if (isLevelIncluded(levels.WARN)) {
            console.warn(message);
            appendFile(message, 'WARN');
        }
    };

    /**
     * Writes log message
     *
     * @param message
     */
    var error = function (message) {
        if (isLevelIncluded(levels.ERROR)) {
            console.error(message);
            appendFile(message, 'ERROR');
        }
    };

    return {
        initialize: initialize,
        log: log,
        warn: warn,
        error: error
    };
})();