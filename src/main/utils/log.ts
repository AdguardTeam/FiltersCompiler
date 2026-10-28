import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Logger } from '@adguard/logger';

/**
 * Formats a log message for the log file.
 *
 * Non-string values (for example Ajv error arrays) would otherwise be written
 * as `[object Object]`.
 *
 * @param message Message to format.
 *
 * @returns Message as text.
 */
const formatMessage = (message: unknown): string => {
    if (typeof message === 'string') {
        return message;
    }

    if (message instanceof Error) {
        return message.stack ?? message.message;
    }

    return JSON.stringify(message, null, 2) ?? String(message);
};

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
     * Helper to append message to log file
     */
    #append(message: unknown, level: 'INFO' | 'WARN' | 'ERROR'): void {
        if (this.#fd == null) {
            return;
        }

        const line = `[${new Date().toLocaleTimeString()}] [${level}]: ${formatMessage(message)}${os.EOL}`;

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
     * @param append - append to the file instead of truncating it
     *
     * By default, the log file is opened with 'w' (truncate/create). With
     * `append`, it is opened with 'a' (create/append). Subsequent writes are
     * appended in both modes.
     */
    initialize(logFilePath: string | undefined, append = false): void {
        if (!logFilePath) {
            /* eslint-disable no-console */
            console.warn('Log file is not specified');
            return;
        }

        // Ensure the directory exists before creating the log file
        const dir = path.dirname(logFilePath);
        fs.mkdirSync(dir, { recursive: true });

        // Close any previous descriptor to avoid leaks
        this.close();

        // Open now; we'll append to the same fd later.
        this.#fd = fs.openSync(logFilePath, append ? 'a' : 'w');
    }

    /**
     * Optional: call to close the file descriptor when done (e.g., on shutdown)
     */
    close(): void {
        if (this.#fd != null) {
            try {
                fs.closeSync(this.#fd);
            } catch {
                /* noop */
            } finally {
                this.#fd = null;
            }
        }
    }
}

const logger = new CompilerLogger();

export { logger };
