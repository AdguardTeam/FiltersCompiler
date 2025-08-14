import { Logger } from '@adguard/logger';
import fs from 'fs';
import os from 'os';

let logLevel = 'LOG';
let fd;

/**
 * Log levels
 */
const Levels = {
    LOG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
};

/**
 * Check if specified level is included in current logging level
 * @param {string} level - Level to check
 * @returns {boolean} True if level should be logged
 */
const isLevelIncluded = (level) => {
    return Levels[logLevel] <= level;
};

/**
 * Append message to log file
 * @param {string} message - Message to append
 * @param {string} level - Log level
 */
const appendFile = (message, level) => {
    if (fd) {
        message = `[${new Date().toLocaleTimeString()}][${level}]:${message}${os.EOL}`;

        fs.appendFileSync(fd, message, 'utf8');
    }
};

/**
 * Extend logger implementation
 */
class CompilerLogger extends Logger {
    /**
     * Log info message
     * @param {string} message - Message to log
     */
    info(message) {
        // Call parent implementation
        super.info(message);

        // Additional file logging
        if (isLevelIncluded(Levels.INFO)) {
            appendFile(message, 'INFO');
        }
    }

    /**
     * Log error message
     * @param {string} message - Message to log
     */
    error(message) {
        // Call parent implementation
        super.error(message);

        // Additional file logging
        if (isLevelIncluded(Levels.ERROR)) {
            appendFile(message, 'ERROR');
        }
    }

    /**
     * Log warning message
     * @param {string} message - Message to log
     */
    warn(message) {
        // Call parent implementation
        super.warn(message);

        // Additional file logging
        if (isLevelIncluded(Levels.WARN)) {
            appendFile(message, 'WARN');
        }
    }

    /**
     * Log debug message
     * @param {string} message - Message to log
     */
    debug(message) {
        // Call parent implementation
        super.debug(message);

        // Additional file logging
        if (isLevelIncluded(Levels.DEBUG)) {
            appendFile(message, 'DEBUG');
        }
    }

    /**
     * Log regular message
     * @param {string} message - Message to log
     */
    log(message) {
        // Call parent implementation like in debug method
        super.log(message);

        // Additional file logging
        if (isLevelIncluded(Levels.LOG)) {
            appendFile(message, 'LOG');
        }
    }

    /**
     * Initializes logger
     *
     * @param {string} path - log file path
     * @param {string} level - log level (optional)
     */
    initialize(path, level) {
        if (level) {
            logLevel = level;
        }
        if (path) {
            fd = fs.openSync(path, 'w');
            this.logFile = path;
        } else {
            /* eslint-disable no-console */
            console.warn('Log file is not specified');
        }
    }
}

const logger = new CompilerLogger();

export { logger, Levels };
