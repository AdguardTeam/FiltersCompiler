import { Logger } from '@adguard/logger';
import fs from 'fs';
import os from 'os';
import path from 'path';

/*
 * File directory for logging
 */
let fileDir;

/**
 * Append message to log file
 * @param {string} message - Message to append
 * @param {string} level - Log level
 */
const appendFile = (message, level) => {
    if (fileDir) {
        message = `[${new Date().toLocaleTimeString()}] [${level}]: ${message}${os.EOL}`;

        fs.appendFileSync(fileDir, message, 'utf8');
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
        appendFile(message, 'INFO');
    }

    /**
     * Log error message
     * @param {string} message - Message to log
     */
    error(message) {
        // Call parent implementation
        super.error(message);

        // Additional file logging
        appendFile(message, 'ERROR');
    }

    /**
     * Log warning message
     * @param {string} message - Message to log
     */
    warn(message) {
        // Call parent implementation
        super.warn(message);

        // Additional file logging
        appendFile(message, 'WARN');
    }

    /**
     * Initializes logger
     *
     * @param {string} logFilePath - log file path
     * @param {string} level - log level (optional)
     *
     * The log file is opened with 'w' mode (write-only), which:
     * - Creates the file if it doesn't exist (and creates parent directories if needed)
     * - Truncates the file to zero length if it already exists (overwrites existing content)
     * - Opens the file for writing only
     * This means any existing log content will be lost when the logger is initialized.
     *
     */
    initialize(logFilePath) {
        if (logFilePath) {
            // Ensure the directory exists before creating the log file
            const dir = path.dirname(logFilePath);
            fs.mkdirSync(dir, { recursive: true });

            fileDir = fs.openSync(logFilePath, 'w');
            this.logFile = logFilePath;
        } else {
            /* eslint-disable no-console */
            console.warn('Log file is not specified');
        }
    }
}

const logger = new CompilerLogger();

export { logger };
