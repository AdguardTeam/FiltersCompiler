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

import { FiltersDownloader } from '@adguard/filters-downloader';

import { build, compile, include } from '../src/main/builder';
import { logger } from '../src/main/utils/log';
import { createTempDir } from './utils/fixtures';

const USERNAME = 'adg-user';
// Distinctive enough that a log path, a stack frame, or a dependency name
// cannot contain it by accident, unlike a word such as `pass`.
const PASSWORD = 'adg-s3cr3t-9f4c';
// A password that starts with digits and then contains `#` looks like a port
// and a fragment, so the URL parser cannot detect it. A slash is possible in
// such a password too.
const DIGIT_FIRST_PASSWORD = '2024#Secret1';
const DIGIT_FIRST_SLASH_PASSWORD = '2024#Se/cret';
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
     * Runs a callback in a temporary directory and removes the directory
     * afterwards.
     *
     * @param prefix Directory name prefix.
     * @param callback Callback that receives the directory path.
     * @returns Callback result.
     */
    const withTempRoot = async (prefix, callback) => {
        const dir = createTempDir(prefix);

        try {
            return await callback(dir);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    };

    /**
     * Runs a callback with the logger and the console captured.
     *
     * @param dir Directory for the log file.
     * @param callback Callback to run.
     * @returns Callback result, error, log file content, and console output.
     */
    const withLog = async (dir, callback) => {
        const logPath = path.join(dir, 'compile.log');
        const consoleOutput = [];

        ['info', 'warn', 'error'].forEach((method) => {
            vi.spyOn(console, method).mockImplementation((...args) => {
                consoleOutput.push(...args.map(String));
            });
        });

        logger.initialize(logPath);

        let result;
        let error;

        try {
            result = await callback();
        } catch (e) {
            error = e;
        } finally {
            logger.close();
        }

        return {
            result,
            error,
            log: fs.readFileSync(logPath, 'utf8'),
            consoleOutput,
        };
    };

    /**
     * Runs `include()` with an arbitrary directive line and collects the output.
     *
     * @param directiveLine Include directive line.
     * @returns Include result, error, log file content, and console output.
     */
    const runDirective = (directiveLine) => withTempRoot(
        'filters-compiler-credentials-',
        (dir) => withLog(dir, () => include(dir, directiveLine, [])),
    );

    /**
     * Runs `include()` with credentials in the URL.
     *
     * @param includePath Path of the included file on the test server.
     * @param options Include directive options.
     * @returns Include result, error, log file content, and console output.
     */
    const runInclude = (includePath, options = '') => runDirective(
        `@include "${credentialsUrl}${includePath}"${options}`,
    );

    /**
     * Runs `compile()` with a template and optional local files.
     *
     * @param templateContent Content of `template.txt`.
     * @param files Local files to create, keyed by a path relative to the
     * filter directory.
     * @returns Compile result, error, log file content, and console output.
     */
    const runCompile = (templateContent, files = {}) => withTempRoot(
        'filters-compiler-compile-',
        (dir) => {
            const filterDir = path.join(dir, 'filter');
            fs.mkdirSync(filterDir, { recursive: true });

            Object.entries(files).forEach(([name, content]) => {
                const filePath = path.join(filterDir, name);
                fs.mkdirSync(path.dirname(filePath), { recursive: true });
                fs.writeFileSync(filePath, content);
            });

            const trustLevelSettings = path.join(dir, 'missing-exclusions.txt');

            return withLog(
                dir,
                () => compile(filterDir, 'Test filter', templateContent, trustLevelSettings),
            );
        },
    );

    /**
     * Runs `build()` for a filter directory with one filter.
     *
     * @param templateContent Content of `template.txt`.
     * @returns Build error, log file content, and console output.
     */
    const runBuild = (templateContent) => withTempRoot(
        'filters-compiler-build-',
        async (dir) => {
            const filtersDir = path.join(dir, 'filters');
            const filterDir = path.join(filtersDir, 'filter_1_Test');
            fs.mkdirSync(filterDir, { recursive: true });
            fs.writeFileSync(path.join(filterDir, 'template.txt'), templateContent);
            fs.writeFileSync(path.join(filterDir, 'metadata.json'), JSON.stringify({
                filterId: 1,
                name: 'Test filter',
                subscriptionUrl: 'https://example.org/filter.txt',
            }));

            const logPath = path.join(dir, 'build.log');
            const consoleOutput = [];

            ['info', 'warn', 'error'].forEach((method) => {
                vi.spyOn(console, method).mockImplementation((...args) => {
                    consoleOutput.push(...args.map(String));
                });
            });

            let error;

            try {
                await build(
                    filtersDir,
                    logPath,
                    path.join(dir, 'report.txt'),
                    path.join(dir, 'platforms'),
                    {
                        TEST: {
                            platform: 'test',
                            path: 'test',
                            configuration: {},
                            defines: {},
                        },
                    },
                );
            } catch (e) {
                error = e;
            } finally {
                logger.close();
            }

            return {
                error,
                log: fs.readFileSync(logPath, 'utf8'),
                consoleOutput,
            };
        },
    );

    /**
     * Asserts that the username and the password are absent from every output
     * channel.
     *
     * @param log Log file content.
     * @param error Error thrown by the compiler, if any.
     * @param consoleOutput Captured console output.
     */
    const expectNoCredentials = (log, error, consoleOutput) => {
        const secrets = [USERNAME, PASSWORD, DIGIT_FIRST_PASSWORD, DIGIT_FIRST_SLASH_PASSWORD];
        const consoleText = consoleOutput.join('\n');

        secrets.forEach((secret) => {
            expect(log).not.toContain(secret);
            expect(consoleText).not.toContain(secret);

            if (error) {
                expect(String(error.stack)).not.toContain(secret);
            }
        });
    };

    it('does not log credentials for a successful include', async () => {
        const {
            result, error, log, consoleOutput,
        } = await runInclude('/filter.txt');

        expect(error).toBeUndefined();
        expect(result.includedLines).toContain(RULE);
        expect(log).toContain(`Applying inclusion from: ${baseUrl}/filter.txt`);
        expect(log).toContain(`Downloading: ${baseUrl}/filter.txt`);
        expectNoCredentials(log, error, consoleOutput);
    });

    it('does not expose credentials in a redirect directive error', async () => {
        const { error, log, consoleOutput } = await runInclude('/redirect.txt');

        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain(`Error: include ${baseUrl}/redirect.txt`);
        expect(error.message).toContain('contains redirect directive');
        expect(error.message).toContain('! Redirect: http://example.org/next.txt');
        expectNoCredentials(log, error, consoleOutput);
    });

    it('does not expose a scheme-less redirect url in the error', async () => {
        // `stripUrlCredentials()` keeps the userinfo of a value without a
        // scheme, so the redirect line is sanitized token by token.
        const { error, log, consoleOutput } = await runCompile(
            '@include "./local.txt"',
            { 'local.txt': `! Redirect: ${USERNAME}:${PASSWORD}@example.org/next.txt` },
        );

        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('contains redirect directive');
        expect(error.message).toContain('! Redirect: example.org/next.txt');
        expectNoCredentials(log, error, consoleOutput);
    });

    it('does not expose a scheme-less redirect url with a digit-first password', async () => {
        const { error, log, consoleOutput } = await runCompile(
            '@include "./local.txt"',
            { 'local.txt': `! Redirect: ${USERNAME}:${DIGIT_FIRST_PASSWORD}@example.org/next.txt` },
        );

        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('contains redirect directive');
        expect(error.message).toContain('! Redirect: example.org/next.txt');
        expectNoCredentials(log, error, consoleOutput);
    });

    it('does not expose a scheme-less redirect url whose password contains a space', async () => {
        // The dependency helper keeps a password with a space only in a URL
        // with a scheme, and a token-wise pass cannot see a scheme-less form:
        // the colon and the at sign are in different tokens.
        const { error, log, consoleOutput } = await runCompile(
            '@include "./local.txt"',
            { 'local.txt': `! Redirect: ${USERNAME}:${PASSWORD} extra@example.org/next.txt` },
        );

        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('contains redirect directive');
        expect(error.message).toContain('! Redirect: example.org/next.txt');
        expectNoCredentials(log, error, consoleOutput);
    });

    it('does not expose a scheme-less redirect url with a slash in a digit-first password', async () => {
        // A digit-first password can contain a slash, so the sanitizer must
        // not stop the userinfo at a path separator.
        const { error, log, consoleOutput } = await runCompile(
            '@include "./local.txt"',
            {
                'local.txt': `! Redirect: sub/${USERNAME}:${DIGIT_FIRST_SLASH_PASSWORD}`
                    + '@example.org/next.txt',
            },
        );

        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('contains redirect directive');
        expect(error.message).toContain('! Redirect: sub/example.org/next.txt');
        expectNoCredentials(log, error, consoleOutput);
    });

    it('does not expose a scheme-less preprocessor include target in the error', async () => {
        // A local file that `@include` pulls in can contain a `!#include`
        // whose target is a scheme-less credential form. The downloader
        // resolves it as a local path and echoes it in the error.
        const { error, log, consoleOutput } = await runCompile(
            '@include "./local.txt"',
            { 'local.txt': `!#include ${USERNAME}:${PASSWORD}@example.org/missing.txt` },
        );

        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('Failed to resolve the include directive');
        expectNoCredentials(log, error, consoleOutput);
    });

    it('does not expose a digit-first password in a scheme-less preprocessor include error', async () => {
        // The slash in the password keeps a userinfo match from ending at a
        // path separator, so the dependency helper decides each segment.
        const { error, log, consoleOutput } = await runCompile(
            '@include "./local.txt"',
            {
                'local.txt': `!#include ${USERNAME}:${DIGIT_FIRST_SLASH_PASSWORD}`
                    + '@example.org/missing.txt',
            },
        );

        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('Failed to resolve the include directive');
        expectNoCredentials(log, error, consoleOutput);
    });

    it('does not expose credentials in an ignoreTrustLevel error', async () => {
        const { error, log, consoleOutput } = await runInclude('/filter.txt', ' /ignoreTrustLevel');

        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('Trust level ignoring option is not supported');
        expect(error.message).toContain(`@include "${baseUrl}/filter.txt" /ignoreTrustLevel`);
        expectNoCredentials(log, error, consoleOutput);
    });

    it('does not expose credentials when a download fails', async () => {
        const { error, log, consoleOutput } = await runInclude('/missing.txt');

        expect(error).toBeInstanceOf(Error);
        expect(String(error.stack)).toContain('curl');
        expectNoCredentials(log, error, consoleOutput);
    });

    it('does not expose credentials when the included file is empty', async () => {
        const { error, log, consoleOutput } = await runInclude('/empty.txt');

        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('Error handling include from');
        expect(error.message).toContain(`${baseUrl}/empty.txt`);
        expectNoCredentials(log, error, consoleOutput);
    });

    it('does not expose credentials in an invalid include directive error', async () => {
        const { error, log, consoleOutput } = await runDirective(
            `@include "" ${USERNAME}:${PASSWORD}@example.org/filter.txt`,
        );

        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('Invalid include directive');
        expect(error.message).toContain('example.org/filter.txt');
        expectNoCredentials(log, error, consoleOutput);
    });

    it('rejects a scheme-less external include without exposing credentials', async () => {
        const { error, log, consoleOutput } = await runDirective(
            `@include "${USERNAME}:${PASSWORD}@example.org/filter.txt"`,
        );

        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('Invalid external include URL');
        expect(error.message).toContain('example.org/filter.txt');
        expectNoCredentials(log, error, consoleOutput);
    });

    it('rejects a scheme-less external include with a digit-first password', async () => {
        const { error, log, consoleOutput } = await runDirective(
            `@include "${USERNAME}:${DIGIT_FIRST_PASSWORD}@example.org/filter.txt"`,
        );

        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('Invalid external include URL');
        expect(error.message).toContain('example.org/filter.txt');
        expectNoCredentials(log, error, consoleOutput);
    });

    it('rejects a scheme-less external include with a digit-first password that contains a slash', async () => {
        const { error, log, consoleOutput } = await runDirective(
            `@include "${USERNAME}:${DIGIT_FIRST_SLASH_PASSWORD}@example.org/filter.txt"`,
        );

        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('Invalid external include URL');
        expect(error.message).toContain('example.org/filter.txt');
        expectNoCredentials(log, error, consoleOutput);
    });

    it('does not log credentials for a credentialed include in compile()', async () => {
        const {
            result, error, log, consoleOutput,
        } = await runCompile(
            `@include "${credentialsUrl}/filter.txt"`,
        );

        expect(error).toBeUndefined();
        expect(result.lines).toContain(RULE);
        expect(log).toContain(`Applying inclusion from: ${baseUrl}/filter.txt`);
        expect(log).toContain(
            'Applying trust-level exclusions to Test filter @include directive:'
            + ` @include "${baseUrl}/filter.txt"`,
        );
        expectNoCredentials(log, error, consoleOutput);
    });

    it('does not log credentials for a local include with ignoreTrustLevel in compile()', async () => {
        const {
            result, error, log, consoleOutput,
        } = await runCompile(
            '@include "./local.txt" /ignoreTrustLevel',
            { 'local.txt': RULE },
        );

        expect(error).toBeUndefined();
        expect(result.lines).toContain(RULE);
        expect(log).toContain(
            'Ignoring trust level for Test filter due to @include directive:'
            + ' @include "./local.txt" /ignoreTrustLevel',
        );
        expectNoCredentials(log, error, consoleOutput);
    });

    it('does not expose credentials when compile() includes an empty remote file', async () => {
        const { error, log, consoleOutput } = await runCompile(
            `@include "${credentialsUrl}/empty.txt"`,
        );

        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('Error handling include from');
        expect(error.message).toContain(`${baseUrl}/empty.txt`);
        expectNoCredentials(log, error, consoleOutput);
    });

    it('does not expose credentials when a preprocessor include fails in compile()', async () => {
        const { log, consoleOutput } = await runCompile(
            `!#include "${credentialsUrl}/missing.txt"`,
        );

        expect(log).toContain('Error resolving includes in Test filter');
        expectNoCredentials(log, undefined, consoleOutput);
    });

    it('redacts credentials in a preprocessor include error the downloader did not sanitize', async () => {
        // The downloader sanitizes its own errors, so the guard in
        // getResolvedPreprocessorIncludes() is pinned with a rejection that
        // carries the credentials, as an unsanitized error would.
        vi.spyOn(FiltersDownloader, 'resolveIncludes').mockRejectedValueOnce(
            new Error(
                `Failed to resolve the include directive '!#include ${credentialsUrl}/missing.txt'`,
            ),
        );

        const { log, consoleOutput } = await runCompile(RULE);

        expect(log).toContain('Error resolving includes in Test filter');
        expectNoCredentials(log, undefined, consoleOutput);
    });

    it('redacts a scheme-less preprocessor include target the downloader did not sanitize', async () => {
        // `stripUrlCredentials()` needs a scheme, so the guard passes the
        // scheme-less form through. The message is sanitized token by token
        // instead.
        vi.spyOn(FiltersDownloader, 'resolveIncludes').mockRejectedValueOnce(
            new Error(
                `Failed to resolve the include directive '!#include ${USERNAME}:${PASSWORD}@example.org/missing.txt'`,
            ),
        );

        const { log, consoleOutput } = await runCompile(RULE);

        expect(log).toContain('Error resolving includes in Test filter');
        expectNoCredentials(log, undefined, consoleOutput);
    });

    it('does not expose a scheme-less preprocessor include in the build error', async () => {
        // The builder leaves a local `!#include` that it cannot resolve in
        // `filter.txt`, and the generator resolves it again. The dependency
        // keeps the scheme-less form in that error, so the generator must
        // sanitize it before the error leaves `build()`.
        const { error, log, consoleOutput } = await runBuild(
            `!#include ${USERNAME}:${PASSWORD}@example.org/missing.txt`,
        );

        expect(error).toBeInstanceOf(Error);
        expect(String(error.stack)).toContain('!#include');
        expectNoCredentials(log, error, consoleOutput);
    }, 30000);

    it.each([
        '..\\common.txt',
        '%2e%2e/common.txt',
        '.%2e/common.txt',
        '%2e./common.txt',
    ])('warns when a preprocessor include leaves the directory through %s', async (target) => {
        // The downloader normalizes Windows separators and percent-encoded
        // dot segments before it drops the include, so the warning must
        // normalize them too.
        const {
            result, error, log, consoleOutput,
        } = await runCompile(
            `!#include ${target}\n||inside.example^`,
            { '../common.txt': '||outside.example^' },
        );

        expect(error).toBeUndefined();
        expect(result.lines).toContain('||inside.example^');
        expect(result.lines.join('\n')).not.toContain('outside.example');
        expect(log).toContain(
            `Ignoring !#include outside the directory of the containing file: '!#include ${target}'`,
        );
        expectNoCredentials(log, error, consoleOutput);
    });

    it('does not expose credentials from an out-of-directory include target', async () => {
        // The warning repeats the directive line, so the sanitizer must remove
        // the scheme-less userinfo from the escaping target too.
        const target = `../${USERNAME}:${PASSWORD}@example.org/x.txt`;
        const {
            result, error, log, consoleOutput,
        } = await runCompile(`!#include ${target}\n||inside.example^`);

        expect(error).toBeUndefined();
        expect(result.lines).toContain('||inside.example^');
        expect(log).toContain(
            "Ignoring !#include outside the directory of the containing file: '!#include ../example.org/x.txt'",
        );
        expectNoCredentials(log, error, consoleOutput);
    });

    it('warns when a preprocessor include leaves the directory and drops its rules', async () => {
        const {
            result, error, log, consoleOutput,
        } = await runCompile(
            '!#include ../common.txt\n||inside.example^',
            { '../common.txt': '||outside.example^' },
        );

        expect(error).toBeUndefined();
        expect(result.lines).toContain('||inside.example^');
        expect(result.lines.join('\n')).not.toContain('outside.example');
        expect(log).toContain(
            "Ignoring !#include outside the directory of the containing file: '!#include ../common.txt'",
        );
        expectNoCredentials(log, error, consoleOutput);
    });

    it('warns when an included file has a preprocessor include that leaves the directory', async () => {
        const {
            result, error, log, consoleOutput,
        } = await runCompile(
            '@include "./local.txt"',
            {
                'local.txt': '!#include ../common.txt\n||inside.example^',
                '../common.txt': '||outside.example^',
            },
        );

        expect(error).toBeUndefined();
        expect(result.lines).toContain('||inside.example^');
        expect(result.lines.join('\n')).not.toContain('outside.example');
        expect(log).toContain(
            "Ignoring !#include outside the directory of the containing file: '!#include ../common.txt'",
        );
        expectNoCredentials(log, error, consoleOutput);
    });
});
