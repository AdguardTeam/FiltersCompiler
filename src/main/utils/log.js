import { Logger } from '@adguard/logger';
import fs from 'fs';

/**
 * Export logger implementation.
 */
const logger = new Logger(console);

/**
 * Initializes logger
 *
 * @param path log file
 * @param level log lvl
 */
logger.initialize = (path) => {
    if (!path) {
        /* eslint-disable-next-line no-console */
        console.warn('Log file is not specified');
        return;
    }
    fs.openSync(path, 'w');
};

export { logger };
