/* eslint-disable global-require,no-console */
module.exports = (function () {
    const fs = require('fs');
    const os = require('os');

    let fd;
    let logLevel = 'LOG';

    const Levels = {
        LOG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3,
    };

    const appendFile = function (message, level) {
        if (fd) {
            message = `[${new Date().toLocaleTimeString()}][${level}]:${message}${os.EOL}`;

            fs.appendFileSync(fd, message, 'utf8');
        }
    };

    const isLevelIncluded = function (level) {
        return Levels[logLevel] <= level;
    };

    /**
     * Initializes logger
     *
     * @param path log file
     * @param level log lvl
     */
    const initialize = function (path, level) {
        if (level) {
            logLevel = level;
        }

        if (path) {
            fd = fs.openSync(path, 'w');
        } else {
            console.warn('Log file is not specified');
        }
    };

    /**
     * Writes log message
     *
     * @param message
     */
    const log = function (message) {
        if (isLevelIncluded(Levels.LOG)) {
            appendFile(message, 'LOG');
        }
    };

    /**
     * Writes log message
     *
     * @param message
     */
    const info = function (message) {
        if (isLevelIncluded(Levels.INFO)) {
            console.info(message);
            appendFile(message, 'INFO');
        }
    };

    /**
     * Writes log message
     *
     * @param message
     */
    const warn = function (message) {
        if (isLevelIncluded(Levels.WARN)) {
            console.warn(message);
            appendFile(message, 'WARN');
        }
    };

    /**
     * Writes log message
     *
     * @param message
     */
    const error = function (message) {
        if (isLevelIncluded(Levels.ERROR)) {
            console.error(message);
            appendFile(message, 'ERROR');
        }
    };

    return {
        initialize,
        log,
        info,
        warn,
        error,
    };
}());
