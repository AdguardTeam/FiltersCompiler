/**
 * @vitest-environment jsdom
 */
import {
    describe,
    it,
    expect,
    beforeAll,
    afterAll,
    afterEach,
    vi,
} from 'vitest';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { include } from '../src/main/builder';
import { logger } from '../src/main/utils/log';
import { createTempDir } from './utils/fixtures';

const USERNAME = 'user';
const PASSWORD = 'pass';
const RULE = '||example.org^';
const SERVER_PATH = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'utils',
    'credentials-server.js',
);

describe('credentials in @include URLs', () => {
    let serverProcess;
    let port;
    let baseUrl;
    let credentialsUrl;
    let consoleOutput;

    beforeAll(async () => {
        serverProcess = spawn(process.execPath, [SERVER_PATH], {
            stdio: ['ignore', 'pipe', 'inherit'],
        });

        port = await new Promise((resolve, reject) => {
            serverProcess.stdout.setEncoding('utf8');
            serverProcess.stdout.once('data', (chunk) => resolve(Number(chunk.trim())));
            serverProcess.once('error', reject);
        });

        baseUrl = `http://127.0.0.1:${port}`;
        credentialsUrl = `http://${USERNAME}:${PASSWORD}@127.0.0.1:${port}`;
    });

    afterAll(async () => {
        if (serverProcess.exitCode === null) {
            const exited = new Promise((resolve) => {
                serverProcess.once('exit', resolve);
            });
            serverProcess.kill();
            await exited;
        }
    });

    afterEach(() => {
        logger.close();
        vi.restoreAllMocks();
    });

    /**
     * Runs `include()` with credentials in the URL and collects the log output.
     *
     * @param includePath Path of the included file on the test server.
     * @param options Include directive options.
     * @returns Include result, error, and log file content.
     */
    const runInclude = async (includePath, options = '') => {
        const dir = createTempDir('filters-compiler-credentials-');
        const logPath = path.join(dir, 'compile.log');

        try {
            consoleOutput = [];
            ['info', 'warn', 'error'].forEach((method) => {
                vi.spyOn(console, method).mockImplementation((...args) => {
                    consoleOutput.push(...args.map(String));
                });
            });

            logger.initialize(logPath);

            const directiveLine = `@include "${credentialsUrl}${includePath}"${options}`;
            let result;
            let error;

            try {
                result = await include(dir, directiveLine, []);
            } catch (e) {
                error = e;
            }

            logger.close();

            return {
                result,
                error,
                log: fs.readFileSync(logPath, 'utf8'),
            };
        } finally {
            logger.close();
            fs.rmSync(dir, { recursive: true, force: true });
        }
    };

    /**
     * Asserts that the password is absent from every output channel.
     *
     * @param log Log file content.
     * @param error Error thrown by `include()`, if any.
     */
    const expectNoPassword = (log, error) => {
        expect(log).not.toContain(PASSWORD);
        expect(consoleOutput.join('\n')).not.toContain(PASSWORD);

        if (error) {
            expect(String(error.stack)).not.toContain(PASSWORD);
        }
    };

    it('does not log credentials for a successful include', async () => {
        const { result, error, log } = await runInclude('/filter.txt');

        expect(error).toBeUndefined();
        expect(result.includedLines).toContain(RULE);
        expect(log).toContain(`Applying inclusion from: ${baseUrl}/filter.txt`);
        expect(log).toContain(`Downloading: ${baseUrl}/filter.txt`);
        expectNoPassword(log, error);
    });

    it('does not expose credentials in a redirect directive error', async () => {
        const { error, log } = await runInclude('/redirect.txt');

        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain(`Error: include ${baseUrl}/redirect.txt`);
        expect(error.message).toContain('contains redirect directive');
        expect(error.message).toContain('! Redirect: http://example.org/next.txt');
        expectNoPassword(log, error);
    });

    it('does not expose credentials in an ignoreTrustLevel error', async () => {
        const { error, log } = await runInclude('/filter.txt', ' /ignoreTrustLevel');

        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('Trust level ignoring option is not supported');
        expect(error.message).toContain(`@include "${baseUrl}/filter.txt" /ignoreTrustLevel`);
        expectNoPassword(log, error);
    });

    it('does not expose credentials when a download fails', async () => {
        const { error, log } = await runInclude('/missing.txt');

        expect(error).toBeInstanceOf(Error);
        expect(String(error.stack)).toContain('curl');
        expectNoPassword(log, error);
    });
});
