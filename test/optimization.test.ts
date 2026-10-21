import {
    describe,
    it,
    expect,
    vi,
    beforeAll,
    afterAll,
    beforeEach,
    afterEach,
} from 'vitest';

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';
import {
    localOptimizationStatistics,
    getOptimizationStatistics,
    OptimizationStatsError,
    skipRuleWithOptimization,
    assertValidStats,
    disableOptimization,
    enableOptimization,
    STATS_JSON,
    FILTERS_DIR_NAME,
    type PercentJson,
    type OptimizationStats,
} from '../src/main/optimization';
import { logger } from '../src/main/utils/log';

// Mock log to hide error messages
vi.mock('../src/main/utils/log');

const PERCENT_JSON = 'percent.json';

const VALID_FILTER_IDS = [1, 2];
const VALID_FILTER_ID = VALID_FILTER_IDS[0];
const INVALID_FILTER_ID = 9999;

const MOCK_PERCENT_JSON: Readonly<PercentJson> = Object.freeze(
    { config: VALID_FILTER_IDS.map((filterId) => ({ filterId, percent: 50 })) },
);
const MOCK_STATS_JSON: Readonly<OptimizationStats> = Object.freeze(
    { groups: [{ config: { hits: 1 }, rules: {} }] },
);

// Mock downloadFile to avoid live HTTP calls in CI
// vi.hoisted lifts this alongside vi.mock below so `downloadFile` is initialized
// before the factory runs (plain top-level const would still be in TDZ at that point).
const { downloadFile } = vi.hoisted(() => ({
    downloadFile: vi.fn((url: string): string => {
        if (url.includes(PERCENT_JSON)) {
            return JSON.stringify(MOCK_PERCENT_JSON);
        }

        return JSON.stringify(MOCK_STATS_JSON);
    }),
}));
vi.mock('../src/main/utils/webutils', () => ({ downloadFile }));

describe('localOptimizationStatistics', () => {
    describe('download()', () => {
        let tmpDir: string;

        beforeAll(async () => {
            tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opt-test-'));
            await localOptimizationStatistics.download(tmpDir);
        });

        afterAll(async () => {
            await localOptimizationStatistics.reset(tmpDir);
        });

        it('does not write percent.json to disk', () => {
            expect(existsSync(path.join(tmpDir, PERCENT_JSON))).toBeFalsy();
        });

        it('writes stats.json for each filterId in percent.json', async () => {
            await Promise.all(
                MOCK_PERCENT_JSON.config.map(async ({ filterId }) => {
                    const statsPath = path.join(tmpDir, FILTERS_DIR_NAME, String(filterId), STATS_JSON);
                    expect(existsSync(statsPath)).toBeTruthy();

                    const raw = await fs.readFile(statsPath, 'utf-8');
                    expect(() => assertValidStats(filterId, JSON.parse(raw))).not.toThrow();
                }),
            );
        });
    });

    describe('download() with both includedFilterIds and excludedFilterIds non-empty', () => {
        let tmpDir: string;

        const [INCLUDED_FILTER_ID, EXCLUDED_FILTER_ID] = VALID_FILTER_IDS;

        beforeAll(async () => {
            tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opt-test-'));
            vi.clearAllMocks();
            await localOptimizationStatistics.download(
                tmpDir,
                [INCLUDED_FILTER_ID, EXCLUDED_FILTER_ID],
                [EXCLUDED_FILTER_ID],
            );
        });

        afterAll(async () => {
            await localOptimizationStatistics.reset(tmpDir);
        });

        it('downloads stats only for included filters not excluded', () => {
            const statsCalls = downloadFile.mock.calls.filter(([url]) => url.includes(`/${STATS_JSON}`));
            expect(statsCalls).toHaveLength(1);
            expect(statsCalls[0][0]).toContain(`/${FILTERS_DIR_NAME}/${INCLUDED_FILTER_ID}/${STATS_JSON}`);
        });
    });

    describe('download() with includedFilterIds', () => {
        describe('includedFilterIds matches a listed filter', () => {
            let tmpDir: string;

            beforeAll(async () => {
                tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opt-test-'));
                vi.clearAllMocks();
                await localOptimizationStatistics.download(tmpDir, [VALID_FILTER_ID]);
            });

            afterAll(async () => {
                await localOptimizationStatistics.reset(tmpDir);
            });

            it('downloads stats only for the specified filter', () => {
                const statsCalls = downloadFile.mock.calls.filter(([url]) => url.includes(`/${STATS_JSON}`));
                expect(statsCalls).toHaveLength(1);
                expect(statsCalls[0][0]).toContain(`/${FILTERS_DIR_NAME}/${VALID_FILTER_ID}/${STATS_JSON}`);
            });

            it('writes stats.json for the specified filter', () => {
                const statsPath = path.join(tmpDir, FILTERS_DIR_NAME, String(VALID_FILTER_ID), STATS_JSON);
                expect(existsSync(statsPath)).toBeTruthy();
            });
        });

        describe(`includedFilterIds contains no filter listed in remote ${PERCENT_JSON}`, () => {
            let tmpDir: string;

            beforeAll(async () => {
                tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opt-test-'));
                vi.clearAllMocks();
                await localOptimizationStatistics.download(tmpDir, [INVALID_FILTER_ID]);
            });

            afterAll(async () => {
                await localOptimizationStatistics.reset(tmpDir);
            });

            it('downloads no stats', () => {
                const statsCalls = downloadFile.mock.calls.filter(([url]) => url.includes(`/${STATS_JSON}`));
                expect(statsCalls).toHaveLength(0);
            });
        });
    });

    describe('download() with excludedFilterIds', () => {
        describe('excludedFilterIds matches a listed filter', () => {
            let tmpDir: string;

            const [EXCLUDED_FILTER_ID, NON_EXCLUDED_FILTER_ID] = VALID_FILTER_IDS;

            beforeAll(async () => {
                tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opt-test-'));
                vi.clearAllMocks();
                await localOptimizationStatistics.download(tmpDir, [], [EXCLUDED_FILTER_ID]);
            });

            afterAll(async () => {
                await localOptimizationStatistics.reset(tmpDir);
            });

            it('downloads stats for every listed filter except the excluded one', () => {
                const statsCalls = downloadFile.mock.calls.filter(([url]) => url.includes(`/${STATS_JSON}`));
                expect(statsCalls).toHaveLength(1);
                expect(statsCalls[0][0]).toContain(`/${FILTERS_DIR_NAME}/${NON_EXCLUDED_FILTER_ID}/${STATS_JSON}`);
            });

            it('does not write stats.json for the excluded filter', () => {
                const statsPath = path.join(tmpDir, FILTERS_DIR_NAME, String(EXCLUDED_FILTER_ID), STATS_JSON);
                expect(existsSync(statsPath)).toBeFalsy();
            });

            it('writes stats.json for the non-excluded filter', () => {
                const statsPath = path.join(tmpDir, FILTERS_DIR_NAME, String(NON_EXCLUDED_FILTER_ID), STATS_JSON);
                expect(existsSync(statsPath)).toBeTruthy();
            });
        });

        describe(`excludedFilterIds contains every filter listed in remote ${PERCENT_JSON}`, () => {
            let tmpDir: string;

            beforeAll(async () => {
                tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opt-test-'));
                vi.clearAllMocks();
                await localOptimizationStatistics.download(
                    tmpDir,
                    [],
                    VALID_FILTER_IDS,
                );
            });

            afterAll(async () => {
                await localOptimizationStatistics.reset(tmpDir);
            });

            it('downloads no stats', () => {
                const statsCalls = downloadFile.mock.calls.filter(([url]) => url.includes(`/${STATS_JSON}`));
                expect(statsCalls).toHaveLength(0);
            });
        });
    });

    describe('download() preserves existing cache when a later refresh fails', () => {
        let tmpDir: string;
        let originalStats: string;
        let downloadError: unknown;

        const defaultImpl = downloadFile.getMockImplementation()!;
        const NETWORK_FAILURE_MESSAGE = 'network failure';

        beforeAll(async () => {
            tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opt-test-'));
            vi.clearAllMocks();

            // Seed a valid cache first.
            await localOptimizationStatistics.download(tmpDir);
            originalStats = await fs.readFile(
                path.join(tmpDir, FILTERS_DIR_NAME, String(VALID_FILTER_ID), STATS_JSON),
                'utf-8',
            );

            // percent.json still resolves, but every stats.json fetch now fails,
            // simulating a network error partway through a refresh.
            downloadFile.mockImplementation((url: string) => {
                if (url.includes(PERCENT_JSON)) {
                    return JSON.stringify(MOCK_PERCENT_JSON);
                }
                throw new Error(NETWORK_FAILURE_MESSAGE);
            });

            downloadError = await localOptimizationStatistics.download(tmpDir).catch((e: unknown) => e);
        });

        afterAll(async () => {
            downloadFile.mockImplementation(defaultImpl);
            await localOptimizationStatistics.reset(tmpDir);
        });

        it('rejects instead of silently keeping stale data, and does not leave a staged directory behind', async () => {
            expect(downloadError).toBeInstanceOf(Error);
            expect((downloadError as Error).message).toBe(NETWORK_FAILURE_MESSAGE);

            const entries = await fs.readdir(tmpDir);
            expect(entries).toEqual([FILTERS_DIR_NAME]);
        });

        it('keeps the previously cached stats.json intact', async () => {
            const statsPath = path.join(tmpDir, FILTERS_DIR_NAME, String(VALID_FILTER_ID), STATS_JSON);
            const currentStats = await fs.readFile(statsPath, 'utf-8');
            expect(currentStats).toBe(originalStats);
        });
    });
});

describe('getOptimizationStatistics()', () => {
    const mockDownloadFileImplementation = downloadFile.getMockImplementation()!;

    afterEach(async () => {
        downloadFile.mockImplementation(mockDownloadFileImplementation);
        vi.clearAllMocks();
        // clear module-level state between tests
        const fakeDir = path.join(os.tmpdir(), `nonexistent-opt-reset-${Date.now()}`);
        await localOptimizationStatistics.reset(fakeDir).catch(() => {});
    });

    it('throws when stats contents is empty', async () => {
        downloadFile.mockImplementation((url: string) => {
            const EMPTY_STRING = '';

            if (url.includes(PERCENT_JSON)) {
                return JSON.stringify(MOCK_PERCENT_JSON);
            }
            return EMPTY_STRING;
        });

        const error = await getOptimizationStatistics(VALID_FILTER_ID)
            .catch((e: unknown) => e) as OptimizationStatsError;

        expect(error).toBeInstanceOf(OptimizationStatsError);
        expect(error).toMatchObject({
            filterId: VALID_FILTER_ID,
            sourcePath: expect.stringContaining(`/${FILTERS_DIR_NAME}/${VALID_FILTER_ID}/${STATS_JSON}`),
            code: 'OPTIMIZATION_STATS_UNAVAILABLE',
            cause: expect.any(Error),
        });
        // User should be able to see the specific cause message in the error log.
        const causeMessage = (error.cause as Error)?.message;
        expect(error.message).toContain(causeMessage);
    });

    it('throws when stats contents is valid JSON but fails structural validation', async () => {
        downloadFile.mockImplementation((url: string) => {
            if (url.includes(PERCENT_JSON)) {
                return JSON.stringify(MOCK_PERCENT_JSON);
            }
            return JSON.stringify({ groups: 'not an array' });
        });

        const error = await getOptimizationStatistics(VALID_FILTER_ID)
            .catch((e: unknown) => e) as OptimizationStatsError;

        expect(error).toBeInstanceOf(OptimizationStatsError);
        expect(error).toMatchObject({
            filterId: VALID_FILTER_ID,
            sourcePath: expect.stringContaining(`/${FILTERS_DIR_NAME}/${VALID_FILTER_ID}/${STATS_JSON}`),
            code: 'OPTIMIZATION_STATS_INVALID',
            cause: expect.any(TypeError),
        });
        // User should be able to see the specific cause message in the error log.
        const causeMessage = (error.cause as TypeError).message;
        expect((error).message).toContain(causeMessage);
    });

    it('returns null and warns when stats have empty groups', async () => {
        downloadFile.mockImplementation((url: string) => {
            if (url.includes(PERCENT_JSON)) {
                return JSON.stringify(MOCK_PERCENT_JSON);
            }
            return JSON.stringify({ groups: [] });
        });

        const result = await getOptimizationStatistics(VALID_FILTER_ID);

        expect(result).toBeNull();
        expect(logger.warn).toHaveBeenCalledTimes(1);
        const [warning] = vi.mocked(logger.warn).mock.calls[0];
        expect(warning).toContain(`Optimization stats for ${VALID_FILTER_ID} at `);
        expect(warning).toContain(`https://chrome.adtidy.org/filters/${VALID_FILTER_ID}/stats.json`);
        expect(warning).toContain('built without optimization');
    });

    describe('with a local cache: validation failures', () => {
        // The test above only exercises the remote path; this needs its own use() setup.
        let tmpDir: string;

        beforeAll(async () => {
            tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opt-local-invalid-'));

            const statsDir = path.join(tmpDir, FILTERS_DIR_NAME, String(VALID_FILTER_ID));
            await fs.mkdir(statsDir, { recursive: true });
            await fs.writeFile(
                path.join(statsDir, STATS_JSON),
                JSON.stringify({ groups: 'not an array' }),
                'utf-8',
            );
        });

        // The outer afterEach resets the module-level localStatsPath, so re-arm
        // the local cache before every test, not just once per block.
        beforeEach(() => {
            localOptimizationStatistics.use(tmpDir);
        });

        afterAll(async () => {
            await localOptimizationStatistics.reset(tmpDir);
        });

        it('throws with the local sourcePath and validation code, not the remote URL', async () => {
            const error = await getOptimizationStatistics(VALID_FILTER_ID)
                .catch((e: unknown) => e) as OptimizationStatsError;

            expect(error).toBeInstanceOf(OptimizationStatsError);
            expect(error).toMatchObject({
                filterId: VALID_FILTER_ID,
                sourcePath: path.join(tmpDir, FILTERS_DIR_NAME, String(VALID_FILTER_ID), STATS_JSON),
                code: 'OPTIMIZATION_STATS_INVALID',
                cause: expect.any(TypeError),
            });
            expect(error.message).toContain(
                (error.cause as Error).message,
            );
        });
    });

    describe('with a local cache: empty stats', () => {
        let tmpDir: string;

        beforeAll(async () => {
            tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opt-local-empty-'));

            const statsDir = path.join(tmpDir, FILTERS_DIR_NAME, String(VALID_FILTER_ID));
            await fs.mkdir(statsDir, { recursive: true });
            await fs.writeFile(
                path.join(statsDir, STATS_JSON),
                JSON.stringify({ groups: [] }),
                'utf-8',
            );
        });

        // The outer afterEach resets the module-level localStatsPath, so re-arm
        // the local cache before every test, not just once per block.
        beforeEach(() => {
            localOptimizationStatistics.use(tmpDir);
        });

        afterAll(async () => {
            await localOptimizationStatistics.reset(tmpDir);
        });

        it('returns null and warns with the local source path', async () => {
            const result = await getOptimizationStatistics(VALID_FILTER_ID);

            expect(result).toBeNull();
            expect(logger.warn).toHaveBeenCalledTimes(1);
            const [warning] = vi.mocked(logger.warn).mock.calls[0];
            expect(warning).toContain(`Optimization stats for ${VALID_FILTER_ID} at `);
            expect(warning).toContain(
                path.join(tmpDir, FILTERS_DIR_NAME, String(VALID_FILTER_ID), STATS_JSON),
            );
            expect(warning).toContain('built without optimization');
        });
    });

    it(`returns null for a filterId not listed in remote ${PERCENT_JSON}`, async () => {
        const result = await getOptimizationStatistics(INVALID_FILTER_ID);
        expect(result).toBeNull();
    });

    it(`returns stats for a filterId listed in remote ${PERCENT_JSON}`, async () => {
        const result = await getOptimizationStatistics(VALID_FILTER_ID);
        expect(result).not.toBeNull();
    });
});

describe('use()', () => {
    let tmpDir: string;

    beforeAll(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opt-local-'));

        const statsDir = path.join(tmpDir, FILTERS_DIR_NAME, String(VALID_FILTER_ID));
        await fs.mkdir(statsDir, { recursive: true });
        await fs.writeFile(
            path.join(statsDir, STATS_JSON),
            JSON.stringify(MOCK_STATS_JSON),
            'utf-8',
        );

        localOptimizationStatistics.use(tmpDir);
    });

    afterAll(async () => {
        await localOptimizationStatistics.reset(tmpDir);
    });

    afterEach(() => {
        // With use() active, no test in this block should ever hit the
        // remote stats endpoint: listed filters read stats.json locally, and
        // unlisted filters return null before the stats fetch is attempted.
        const anyStatsCallMade = downloadFile.mock.calls.some(([url]) => url.includes(`/${STATS_JSON}`));
        expect(anyStatsCallMade).toBe(false);

        vi.clearAllMocks();
    });

    it(`reads stats from local file, listed in remote ${PERCENT_JSON}`, async () => {
        const result = await getOptimizationStatistics(VALID_FILTER_ID);
        expect(result).not.toBeNull();
    });

    it(`returns null for filter not listed in remote ${PERCENT_JSON}`, async () => {
        const result = await getOptimizationStatistics(INVALID_FILTER_ID);
        expect(result).toBeNull();
    });

    it('throws with the local file path when the listed filter has no local stats.json', async () => {
        const [, FILTER_ID_WITHOUT_LOCAL_STATS] = VALID_FILTER_IDS;

        const error = await getOptimizationStatistics(FILTER_ID_WITHOUT_LOCAL_STATS).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(OptimizationStatsError);
        expect(error).toMatchObject({
            filterId: FILTER_ID_WITHOUT_LOCAL_STATS,
            sourcePath: path.join(tmpDir, FILTERS_DIR_NAME, String(FILTER_ID_WITHOUT_LOCAL_STATS), STATS_JSON),
            code: 'OPTIMIZATION_STATS_UNAVAILABLE',
        });
    });
});

describe('percentPath injection', () => {
    const LOCAL_FILTER_ID = 7;
    let tmpDir: string;
    let percentPath: string;

    const percentCallCount = () => downloadFile.mock.calls.filter(([url]) => url.includes(PERCENT_JSON)).length;

    const writeLocalStats = async (filterId: number) => {
        const statsDir = path.join(tmpDir, FILTERS_DIR_NAME, String(filterId));
        await fs.mkdir(statsDir, { recursive: true });
        await fs.writeFile(path.join(statsDir, STATS_JSON), JSON.stringify(MOCK_STATS_JSON), 'utf-8');
    };

    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opt-percent-'));
        percentPath = path.join(tmpDir, 'percent-config.json');
        await writeLocalStats(LOCAL_FILTER_ID);
        vi.clearAllMocks();
    });

    afterEach(async () => {
        await localOptimizationStatistics.reset(tmpDir);
        vi.clearAllMocks();
    });

    it('use() without percentPath clears a previously injected percentPath', async () => {
        await fs.writeFile(percentPath, JSON.stringify([{ filterId: LOCAL_FILTER_ID }]), 'utf-8');
        localOptimizationStatistics.use(tmpDir, { percentPath });
        localOptimizationStatistics.use(tmpDir);

        expect(await getOptimizationStatistics(LOCAL_FILTER_ID)).toBeNull();
        expect(percentCallCount()).toBe(1);
    });

    // Both entry points resolve optimizable ids from percentPath; `run` resolves with those ids.
    describe.each([
        ['use()', async (file: string) => {
            localOptimizationStatistics.use(tmpDir, { percentPath: file });
            const found = await Promise.all(
                [LOCAL_FILTER_ID, VALID_FILTER_ID].map(async (id) => (
                    await getOptimizationStatistics(id) === null ? null : id
                )),
            );
            return found.filter((id) => id !== null);
        }],
        ['download()', async (file: string) => {
            const downloadDir = path.join(tmpDir, 'downloaded');
            await localOptimizationStatistics.download(downloadDir, [], [], { percentPath: file });
            const dirs = await fs.readdir(path.join(downloadDir, FILTERS_DIR_NAME));
            return dirs.map(Number);
        }],
    ])('%s', (_, run) => {
        it('takes optimizable ids from an array of { filterId } entries in percentPath without fetching', async () => {
            const entries = [{ filterId: LOCAL_FILTER_ID, percent: 40, strict: true }];
            await fs.writeFile(percentPath, JSON.stringify(entries), 'utf-8');

            // VALID_FILTER_ID is listed in the mocked remote percent.json, but absent from the local file.
            expect(await run(percentPath)).toEqual([LOCAL_FILTER_ID]);
            expect(percentCallCount()).toBe(0);
        });

        it.each([
            ['an object instead of an array', { filterId: LOCAL_FILTER_ID }],
            ['an entry without filterId', [{ id: 1 }]],
        ])('throws a TypeError naming the path for %s in percentPath', async (__, content) => {
            await fs.writeFile(percentPath, JSON.stringify(content), 'utf-8');

            const error = await run(percentPath).catch((e: unknown) => e);

            expect(error).toBeInstanceOf(TypeError);
            expect((error as TypeError).message).toContain(percentPath);
        });

        it('throws an Error naming the path and keeping the cause for a file that is not valid JSON', async () => {
            await fs.writeFile(percentPath, '[{ "filterId": 7 ', 'utf-8');

            const error = await run(percentPath).catch((e: unknown) => e);

            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toContain(percentPath);
            expect((error as Error).cause).toBeInstanceOf(SyntaxError);
        });
    });

    it('reads the percentPath file once across repeated lookups', async () => {
        await fs.writeFile(percentPath, JSON.stringify([{ filterId: LOCAL_FILTER_ID }]), 'utf-8');
        const readFile = vi.spyOn(fs, 'readFile');
        localOptimizationStatistics.use(tmpDir, { percentPath });

        await Promise.all([
            getOptimizationStatistics(LOCAL_FILTER_ID),
            getOptimizationStatistics(LOCAL_FILTER_ID),
            getOptimizationStatistics(INVALID_FILTER_ID),
        ]);
        await getOptimizationStatistics(LOCAL_FILTER_ID);

        const percentReads = readFile.mock.calls.filter(([file]) => file === percentPath);
        readFile.mockRestore();
        expect(percentReads).toHaveLength(1);
    });

    it('reuses the cached entries for repeated use() calls with the same percentPath', async () => {
        await fs.writeFile(percentPath, JSON.stringify([{ filterId: LOCAL_FILTER_ID }]), 'utf-8');
        const readFile = vi.spyOn(fs, 'readFile');

        localOptimizationStatistics.use(tmpDir, { percentPath });
        await getOptimizationStatistics(LOCAL_FILTER_ID);
        localOptimizationStatistics.use(tmpDir, { percentPath });
        await getOptimizationStatistics(LOCAL_FILTER_ID);

        const percentReads = readFile.mock.calls.filter(([file]) => file === percentPath);
        readFile.mockRestore();
        expect(percentReads).toHaveLength(1);
    });

    it('reads each distinct percentPath once when download() and use() alternate between them', async () => {
        const otherPercentPath = path.join(tmpDir, 'other-percent-config.json');
        await fs.writeFile(percentPath, JSON.stringify([{ filterId: LOCAL_FILTER_ID }]), 'utf-8');
        await fs.writeFile(otherPercentPath, JSON.stringify([{ filterId: VALID_FILTER_ID }]), 'utf-8');
        const readFile = vi.spyOn(fs, 'readFile');
        const downloadDir = path.join(tmpDir, 'downloaded');

        localOptimizationStatistics.use(tmpDir, { percentPath });
        await getOptimizationStatistics(LOCAL_FILTER_ID);
        await localOptimizationStatistics.download(downloadDir, [], [], { percentPath: otherPercentPath });
        await getOptimizationStatistics(LOCAL_FILTER_ID);
        await localOptimizationStatistics.download(downloadDir, [], [], { percentPath: otherPercentPath });

        const reads = (file: string) => readFile.mock.calls.filter(([f]) => f === file).length;
        const counts = [reads(percentPath), reads(otherPercentPath)];
        readFile.mockRestore();
        expect(counts).toEqual([1, 1]);
    });

    it('download() without percentPath reuses the remote percent.json fetched earlier in the process', async () => {
        await localOptimizationStatistics.download(path.join(tmpDir, 'first'));
        await localOptimizationStatistics.download(path.join(tmpDir, 'second'));

        expect(percentCallCount()).toBe(1);
    });

    it('reset() clears the injected percentPath', async () => {
        await fs.writeFile(percentPath, JSON.stringify([{ filterId: LOCAL_FILTER_ID }]), 'utf-8');
        localOptimizationStatistics.use(tmpDir, { percentPath });
        await localOptimizationStatistics.reset(tmpDir);
        await writeLocalStats(VALID_FILTER_ID);
        localOptimizationStatistics.use(tmpDir);

        expect(await getOptimizationStatistics(VALID_FILTER_ID)).not.toBeNull();
        expect(percentCallCount()).toBe(1);
    });

    it('download() applies includedFilterIds and excludedFilterIds to the ids from percentPath', async () => {
        const OTHER_FILTER_ID = 8;
        await fs.writeFile(
            percentPath,
            JSON.stringify([{ filterId: LOCAL_FILTER_ID }, { filterId: OTHER_FILTER_ID }]),
            'utf-8',
        );
        const downloadDir = path.join(tmpDir, 'downloaded');

        await localOptimizationStatistics.download(
            downloadDir,
            [LOCAL_FILTER_ID, OTHER_FILTER_ID],
            [OTHER_FILTER_ID],
            { percentPath },
        );

        const dirs = await fs.readdir(path.join(downloadDir, FILTERS_DIR_NAME));
        expect(dirs).toEqual([String(LOCAL_FILTER_ID)]);
    });

    it('download() does not leave percentPath active for a later use() without percentPath', async () => {
        await fs.writeFile(percentPath, JSON.stringify([{ filterId: LOCAL_FILTER_ID }]), 'utf-8');
        await localOptimizationStatistics.download(path.join(tmpDir, 'downloaded'), [], [], { percentPath });
        localOptimizationStatistics.use(tmpDir);

        expect(await getOptimizationStatistics(LOCAL_FILTER_ID)).toBeNull();
        expect(percentCallCount()).toBe(1);
    });
});

describe('assertValidStats()', () => {
    const getStatsValidationError = (stats: unknown): TypeError => {
        try {
            assertValidStats(VALID_FILTER_ID, stats);
        } catch (e) {
            return e as TypeError;
        }
        throw new Error('assertValidStats did not throw');
    };

    describe('throws non-object stats', () => {
        it.each([
            { label: 'null', value: null, printed: 'null' },
            { label: 'undefined', value: undefined, printed: 'undefined' },
            { label: 'a number', value: 5, printed: '5' },
            { label: 'a string', value: 'oops', printed: '"oops"' },
            { label: 'a BigInt', value: BigInt(10), printed: '10' },
            { label: 'a NaN', value: NaN, printed: 'NaN' },
            { label: 'a Infinity', value: Infinity, printed: 'Infinity' },
            { label: 'a -Infinity', value: -Infinity, printed: '-Infinity' },
        ])('throws a TypeError for $label', ({ value, printed }) => {
            const error = getStatsValidationError(value);

            expect(error).toBeInstanceOf(TypeError);
            expect(error.message).toBe(
                `Optimization stats for ${VALID_FILTER_ID}: must be a non-null object, but got ${printed}`,
            );
        });
    });

    describe('throws on invalid groups', () => {
        it.each([
            { label: 'groups is missing', value: {}, printed: 'undefined' },
            { label: 'groups is null', value: { groups: null }, printed: 'null' },
            { label: 'groups is not an array', value: { groups: 'nope' }, printed: '"nope"' },
        ])('throws a TypeError naming the offending groups value when $label', ({ value, printed }) => {
            const error = getStatsValidationError(value);

            expect(error).toBeInstanceOf(TypeError);
            expect(error.message).toBe(
                `Optimization stats for ${VALID_FILTER_ID}: groups must be an array, but got ${printed}`,
            );
        });

        it('accepts an empty groups array, leaving the "no hit data" policy to the caller', () => {
            expect(() => assertValidStats(VALID_FILTER_ID, { groups: [] })).not.toThrow();
        });
    });

    describe('throws on malformed group entries', () => {
        it.each([
            { label: 'a group missing rules', group: { config: { hits: 1 } } },
            { label: 'a group missing config', group: { rules: {} } },
            { label: 'a group with rules as an array', group: { config: { hits: 1 }, rules: [] } },
            { label: 'a group with rules as null', group: { config: { hits: 1 }, rules: null } },
            { label: 'a group with rules as a primitive', group: { config: { hits: 1 }, rules: 'oops' } },
            { label: 'a group with config as null', group: { rules: {}, config: null } },
            { label: 'a group with config as a primitive', group: { rules: {}, config: 'oops' } },
            { label: 'a group with a non-numeric config.hits', group: { config: { hits: '1' }, rules: {} } },
            { label: 'a group that is null', group: null },
            { label: 'a group that is a primitive', group: 'oops' },
            { label: 'a group that is an array', group: [] },
        ])('throws a TypeError naming the offending group when $label', ({ group }) => {
            const error = getStatsValidationError({ groups: [group] });

            expect(error).toBeInstanceOf(TypeError);
            expect(error.message).toBe(
                `Optimization stats for ${VALID_FILTER_ID}: groups[0] must have a "rules" object `
                + `and a numeric "config.hits", but got ${JSON.stringify(group)}`,
            );
        });

        it('reports the index of the first malformed group among otherwise-valid ones', () => {
            const validGroup = { config: { hits: 1 }, rules: {} };
            const malformedGroup = { config: { hits: 1 } };

            const error = getStatsValidationError({ groups: [validGroup, malformedGroup] });

            expect(error.message).toContain('groups[1]');
        });

        it('truncates a large but validly-serializable offending group instead of embedding it whole', () => {
            const manyRules = Object.fromEntries(
                Array.from({ length: 1000 }, (_, i) => [`rule-${i}`, i]),
            );
            const malformedGroup = { rules: manyRules };

            const error = getStatsValidationError({ groups: [malformedGroup] });

            expect(error.message.length).toBeLessThan(400);
        });
    });

    it('does not throw for valid stats', () => {
        expect(() => assertValidStats(VALID_FILTER_ID, MOCK_STATS_JSON)).not.toThrow();
    });
});

describe('skipRuleWithOptimization()', () => {
    it('skips rules below the hit threshold', () => {
        const stats: OptimizationStats = {
            groups: [
                {
                    config: { hits: 2 },
                    rules: {
                        low_hits1: 1,
                        enough_hits1: 2,
                    },
                },
                {
                    config: { hits: 4 },
                    rules: {
                        low_hits2: 1,
                        enough_hits2: 5,
                    },
                },
            ],
        };

        expect(skipRuleWithOptimization('low_hits1', stats)).toBeTruthy();
        expect(skipRuleWithOptimization('low_hits2', stats)).toBeTruthy();
        expect(skipRuleWithOptimization('low_hits1', null)).toBeFalsy();
        expect(skipRuleWithOptimization('low_hits2', null)).toBeFalsy();

        expect(skipRuleWithOptimization('enough_hits1', stats)).toBeFalsy();
        expect(skipRuleWithOptimization('enough_hits2', stats)).toBeFalsy();
        expect(skipRuleWithOptimization('enough_hits1', null)).toBeFalsy();
        expect(skipRuleWithOptimization('enough_hits2', null)).toBeFalsy();

        expect(skipRuleWithOptimization('unknown_rule', stats)).toBeFalsy();
        expect(skipRuleWithOptimization('unknown_rule', null)).toBeFalsy();
    });
});

describe('disableOptimization()', () => {
    afterEach(() => {
        enableOptimization();
    });

    it('returns null after disabling', async () => {
        const result1 = await getOptimizationStatistics(VALID_FILTER_ID);
        expect(result1).not.toBeNull();

        disableOptimization();

        const result2 = await getOptimizationStatistics(VALID_FILTER_ID);
        expect(result2).toBeNull();
    });
});
