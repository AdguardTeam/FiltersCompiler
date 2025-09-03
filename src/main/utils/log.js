import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Logger } from '@adguard/logger';

/**
 * Extend logger implementation
 */
class CompilerLogger extends Logger {
    /**
     * File descriptor
     *
     * @type {number | null}
     *
     * @private
     */
    #fd = null;

    /**
     * Helper to append message to log file
     *
     * @param {string} message
     * @param {'INFO'|'WARN'|'ERROR'} level
     *
     * @private
     */
    #append(message, level) {
        if (this.#fd == null) {
            return;
        }

        const line = `[${new Date().toLocaleTimeString()}] [${level}]: ${message}${os.EOL}`;

        // Using appendFileSync with an fd ensures atomic append semantics.
        fs.appendFileSync(this.#fd, line, 'utf8');
    }

    /** @inheritdoc */
    info(message) {
        super.info(message);
        this.#append(message, 'INFO');
    }

    /** @inheritdoc */
    error(message) {
        super.error(message);
        this.#append(message, 'ERROR');
    }

    /** @inheritdoc */
    warn(message) {
        super.warn(message);
        this.#append(message, 'WARN');
    }

    /**
     * Initializes logger
     *
     * @param {string} logFilePath - log file path
     *
     * The log file is opened with 'w' (truncate/create). Subsequent writes are appended.
     */
    initialize(logFilePath) {
        if (!logFilePath) {
            /* eslint-disable no-console */
            console.warn('Log file is not specified');
            return;
        }

        // Ensure the directory exists before creating the log file
        const dir = path.dirname(logFilePath);
        fs.mkdirSync(dir, { recursive: true });

        // Close any previous descriptor to avoid leaks
        if (this.#fd != null) {
            try {
                fs.closeSync(this.#fd);
            } catch {
                /* noop */
            }
            this.#fd = null;
        }

        // Open (truncate) now; we’ll append to the same fd later.
        this.#fd = fs.openSync(logFilePath, 'w');
        this.logFile = logFilePath;
    }

    /**
     * Optional: call to close the file descriptor when done (e.g., on shutdown)
     */
    close() {
        if (this.#fd != null) {
            try {
                fs.closeSync(this.#fd);
            } finally {
                this.#fd = null;
            }
        }
    }
}

const logger = new CompilerLogger();

export { logger };
