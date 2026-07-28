import {
    describe,
    it,
    expect,
    vi,
    beforeAll,
} from 'vitest';

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

describe('downloadFile', async () => {
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
