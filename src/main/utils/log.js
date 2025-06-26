/* eslint-disable global-require,no-console */
import fs from 'fs';
import os from 'os';

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

// TODO: consider using @adguard/logger

export const logger = {
    /**
     * Writes log message
     *
     * @param message
     */
    log(message) {
        if (isLevelIncluded(Levels.LOG)) {
            appendFile(message, 'LOG');
        }
    },

    /**
     * Writes log message
     *
     * @param message
     */
    info(message) {
        if (isLevelIncluded(Levels.INFO)) {
            console.info(message);
            appendFile(message, 'INFO');
        }
    },

    /**
     * Writes log message
     *
     * @param message
     */
    warn(message) {
        if (isLevelIncluded(Levels.WARN)) {
            console.warn(message);
            appendFile(message, 'WARN');
        }
    },

    /**
     * Writes log message
     *
     * @param message
     */
    error(message) {
        if (isLevelIncluded(Levels.ERROR)) {
            console.log(message);
            appendFile(message, 'ERROR');
        }
    },

    /**
     * Initializes logger
     *
     * @param path log file
     * @param level log lvl
     */
    initialize(path, level) {
        if (level) {
            logLevel = level;
        }

        if (path) {
            fd = fs.openSync(path, 'w');
        } else {
            console.warn('Log file is not specified');
        }
    },

    debug(message) {
        if (isLevelIncluded(Levels.LOG)) {
            console.debug(message);
            appendFile(message, 'DEBUG');
        }
    },
};
