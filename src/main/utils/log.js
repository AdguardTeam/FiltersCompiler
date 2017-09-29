/* globals module, console, require */

module.exports = (function () {

    'use strict';

    var fs = require('fs');

    var file;

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

    var initialize = function (path) {
        file = path;

        if (file) {
            fs.openSync(file, 'w');
        }
    };

    var log = function (message) {
        console.log(message);
        appendFile(message, 'LOG');
    };

    var warn = function (message) {
        console.warn(message);
        appendFile(message, 'WARN');
    };

    var error = function (message) {
        console.error(message);
        appendFile(message, 'ERROR');
    };

    return {
        initialize: initialize,
        log: log,
        warn: warn,
        error: error
    };
})();