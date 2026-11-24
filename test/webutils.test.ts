import {
    describe,
    it,
    expect,
    vi,
    beforeAll,
    beforeEach,
} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { downloadFile, RETRY_NUM } from '../src/main/utils/webutils';

vi.mock('../src/main/utils/log');

const { execFileSync } = vi.hoisted(() => ({
    execFileSync: vi.fn(),
}));

// webutils.ts resolves `child_process` via `createRequire(import.meta.url)`,
// which bypasses Vite's static import graph, so `vi.mock('child_process', ...)`
// alone would never intercept it. Stubbing `createRequire` itself is what
// actually reaches the call site.
vi.mock('module', async (importOriginal) => {
    const actual = await importOriginal<typeof import('module')>();
    return {
        ...actual,
        createRequire: () => (id: string) => {
            if (id === 'child_process') {
                return { execFileSync };
            }
            return actual.createRequire(import.meta.url)(id);
        },
    };
});

describe('downloadFile', () => {
    const EXPECT_CONTENT = 'raw content';
    let result: string;

    beforeAll(async () => {
        execFileSync
            .mockImplementationOnce(() => {
                throw new Error('curl failed');
            })
            .mockImplementationOnce(() => EXPECT_CONTENT);

        result = await downloadFile('https://filters.adtidy.org/extension/chromium/filter.txt');
    });

    it('should have been called twice', async () => {
        expect(result).toBe(EXPECT_CONTENT);
        expect(execFileSync).toHaveBeenCalledTimes(2);
    });

    it('first call should not have --retry', async () => {
        const [command, args] = execFileSync.mock.calls[0];
        expect(command).toBe('curl');
        expect(args).not.toContain('--retry');
    });

    it('second call should have --retry 5', async () => {
        const [command, args] = execFileSync.mock.calls[1];
        expect(command).toBe('curl');
        expect(args).toContain('--retry');
        expect(args).toContain(String(RETRY_NUM));
    });
});

describe('downloadFile transport', () => {
    const USERNAME = 'adg-user';
    // Distinctive enough that a temporary path or an option cannot contain it
    // by accident, unlike a word such as `pass`.
    const PASSWORD = 'adg-s3cr3t-9f4c';
    const URL_WITH_CREDENTIALS = `https://${USERNAME}:${PASSWORD}@example.org/filter.txt`;
    const CONTENT = 'raw content';

    beforeEach(() => {
        execFileSync.mockReset();
    });

    /**
     * Returns the path of the curl config file from a call argument list.
     *
     * @param args Arguments of the curl call.
     *
     * @returns Path to the curl config file.
     */
    const getConfigPath = (args: string[]): string => {
        const optionIndex = args.indexOf('-K');
        expect(optionIndex).toBeGreaterThan(-1);

        return args[optionIndex + 1];
    };

    it('keeps the URL and the password out of the curl arguments', async () => {
        let configPath: string | undefined;
        let configContent: string | undefined;

        execFileSync.mockImplementationOnce((_command: string, args: string[]) => {
            configPath = getConfigPath(args);
            configContent = fs.readFileSync(configPath, 'utf8');

            return CONTENT;
        });

        await expect(downloadFile(URL_WITH_CREDENTIALS)).resolves.toBe(CONTENT);

        const [command, args] = execFileSync.mock.calls[0];
        const serializedArgs = JSON.stringify(args);

        expect(command).toBe('curl');
        expect(serializedArgs).not.toContain(URL_WITH_CREDENTIALS);
        expect(serializedArgs).not.toContain(PASSWORD);
        expect(serializedArgs).not.toContain(USERNAME);
        // The URL with the credentials still reaches curl, but through the
        // config file that `-K` names.
        expect(configContent).toBe(`url = "${URL_WITH_CREDENTIALS}"\n`);
        expect(configPath).toBeDefined();
    });

    it('escapes characters that are special in a curl config file', async () => {
        let configContent: string | undefined;
        const rawUrl = 'https://adg-user:p"a\\ss word@example.org/fi\nlter.txt';

        execFileSync.mockImplementationOnce((_command: string, args: string[]) => {
            configContent = fs.readFileSync(getConfigPath(args), 'utf8');

            return CONTENT;
        });

        await downloadFile(rawUrl);

        // The backslash must be escaped before the double quote. Otherwise the
        // quote escape would produce a real closing quote and the rest of the
        // URL would become a second config line.
        expect(configContent).toBe('url = "https://adg-user:p\\"a\\\\ss word@example.org/fi\\nlter.txt"\n');
        expect(configContent?.split('\n')).toHaveLength(2);
    });

    it('creates the config file with mode 0600', async () => {
        let configMode: number | undefined;

        execFileSync.mockImplementationOnce((_command: string, args: string[]) => {
            configMode = fs.statSync(getConfigPath(args)).mode & 0o777;

            return CONTENT;
        });

        await downloadFile(URL_WITH_CREDENTIALS);

        if (process.platform !== 'win32') {
            expect(configMode).toBe(0o600);
        }
    });

    it('removes the config file after a successful download', async () => {
        let configPath: string | undefined;

        execFileSync.mockImplementationOnce((_command: string, args: string[]) => {
            configPath = getConfigPath(args);

            return CONTENT;
        });

        await expect(downloadFile(URL_WITH_CREDENTIALS)).resolves.toBe(CONTENT);

        expect(configPath).toBeDefined();
        expect(fs.existsSync(configPath as string)).toBe(false);
        expect(fs.existsSync(path.dirname(configPath as string))).toBe(false);
    });

    it('removes the config file after a failed download', async () => {
        const configPaths: string[] = [];

        execFileSync.mockImplementation((_command: string, args: string[]) => {
            configPaths.push(getConfigPath(args));

            throw new Error('curl failed');
        });

        await expect(downloadFile(URL_WITH_CREDENTIALS)).rejects.toThrow('curl failed');

        // `downloadFile` retries once after the first failure, and each attempt
        // must remove its own file.
        expect(configPaths).toHaveLength(2);
        configPaths.forEach((configPath) => {
            expect(fs.existsSync(configPath)).toBe(false);
            expect(fs.existsSync(path.dirname(configPath))).toBe(false);
        });
    });

    it('does not replace the download result when cleanup fails', async () => {
        let configPath: string | undefined;

        execFileSync.mockImplementationOnce((_command: string, args: string[]) => {
            configPath = getConfigPath(args);

            return CONTENT;
        });

        const rmSpy = vi.spyOn(fs, 'rmSync').mockImplementationOnce(() => {
            throw new Error('EPERM: operation not permitted');
        });

        try {
            await expect(downloadFile(URL_WITH_CREDENTIALS)).resolves.toBe(CONTENT);
        } finally {
            rmSpy.mockRestore();
            if (configPath !== undefined) {
                fs.rmSync(path.dirname(configPath), { recursive: true, force: true });
            }
        }
    });

    it('does not replace the curl error when cleanup fails', async () => {
        const configDirectories: string[] = [];

        execFileSync.mockImplementation((_command: string, args: string[]) => {
            configDirectories.push(path.dirname(getConfigPath(args)));

            throw new Error('curl failed');
        });

        const rmSpy = vi.spyOn(fs, 'rmSync').mockImplementation(() => {
            throw new Error('EPERM: operation not permitted');
        });

        try {
            await expect(downloadFile(URL_WITH_CREDENTIALS)).rejects.toThrow('curl failed');
            expect(configDirectories).toHaveLength(2);
        } finally {
            rmSpy.mockRestore();
            configDirectories.forEach((directory) => {
                fs.rmSync(directory, { recursive: true, force: true });
            });
        }
    });

    it('keeps the TLS=insecure handling and the retry argument', async () => {
        const originalTls = process.env.TLS;
        const calls: string[][] = [];
        process.env.TLS = 'insecure';

        try {
            execFileSync
                .mockImplementationOnce((_command: string, args: string[]) => {
                    calls.push(args);

                    throw new Error('curl failed');
                })
                .mockImplementationOnce((_command: string, args: string[]) => {
                    calls.push(args);

                    return CONTENT;
                });

            await expect(downloadFile(URL_WITH_CREDENTIALS)).resolves.toBe(CONTENT);

            expect(calls).toHaveLength(2);
            calls.forEach((args) => {
                expect(args[0]).toBe('--insecure');
                expect(args).toContain('--fail');
                expect(args).toContain('--silent');
                expect(args).toContain('--user-agent');
                expect(args).toContain('-L');
            });
            expect(calls[0]).not.toContain('--retry');
            expect(calls[1]).toContain('--retry');
            expect(calls[1]).toContain(String(RETRY_NUM));
        } finally {
            if (originalTls === undefined) {
                delete process.env.TLS;
            } else {
                process.env.TLS = originalTls;
            }
        }
    });
});
