import {
    describe,
    it,
    expect,
    afterEach,
    vi,
} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { logger } from '../src/main/utils/log';
import { withTempDir } from './utils/fixtures';

describe('compiler logger', () => {
    afterEach(() => {
        logger.close();
        vi.restoreAllMocks();
    });

    it('closes the previous log file when initialized without a path', () => withTempDir(
        'filters-compiler-log-',
        (dir) => {
            const logPath = path.join(dir, 'first.log');

            vi.spyOn(console, 'info').mockImplementation(() => {});
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            logger.initialize(logPath);
            logger.info('first message');
            logger.initialize(undefined);
            logger.info('second message');

            const log = fs.readFileSync(logPath, 'utf8');
            expect(log).toContain('first message');
            expect(log).not.toContain('second message');
            expect(warnSpy).toHaveBeenCalledWith('Log file is not specified');
        },
    ));
});
