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
     * @private
     */
    #fd: number | null = null;

    /**
     * Log file path, set after successful initialization.
     */
    logFile: string | undefined;

    /**
     * Helper to append message to log file
     */
    #append(message: unknown, level: 'INFO' | 'WARN' | 'ERROR'): void {
        if (this.#fd == null) {
            return;
        }

        const line = `[${new Date().toLocaleTimeString()}] [${level}]: ${message}${os.EOL}`;

        // Using appendFileSync with an fd ensures atomic append semantics.
        fs.appendFileSync(this.#fd, line, 'utf8');
    }

    /** @inheritdoc */
    info(message: unknown): void {
        super.info(message);
        this.#append(message, 'INFO');
    }

    /** @inheritdoc */
    error(message: unknown): void {
        super.error(message);
        this.#append(message, 'ERROR');
    }

    /** @inheritdoc */
    warn(message: unknown): void {
        super.warn(message);
        this.#append(message, 'WARN');
    }

    /**
     * Initializes logger
     *
     * @param logFilePath - log file path
     *
     * The log file is opened with 'w' (truncate/create). Subsequent writes are appended.
     */
    initialize(logFilePath: string | undefined): void {
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

        // Open (truncate) now; we'll append to the same fd later.
        this.#fd = fs.openSync(logFilePath, 'w');
        this.logFile = logFilePath;
    }

    /**
     * Optional: call to close the file descriptor when done (e.g., on shutdown)
     */
    close(): void {
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
