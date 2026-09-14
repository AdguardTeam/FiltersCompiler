import {
    describe,
    it,
    expect,
    vi,
    beforeAll,
    afterAll,
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
                    expect(() => assertValidStats(filterId, statsPath, JSON.parse(raw))).not.toThrow();
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

        const error = await getOptimizationStatistics(VALID_FILTER_ID).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(OptimizationStatsError);
        expect(error).toMatchObject({
            filterId: VALID_FILTER_ID,
            sourcePath: expect.stringContaining(`/${FILTERS_DIR_NAME}/${VALID_FILTER_ID}/${STATS_JSON}`),
            code: 'OPTIMIZATION_STATS_UNAVAILABLE',
        });
    });

    it('throws when stats contents is valid JSON but fails structural validation', async () => {
        downloadFile.mockImplementation((url: string) => {
            if (url.includes(PERCENT_JSON)) {
                return JSON.stringify(MOCK_PERCENT_JSON);
            }
            return JSON.stringify({ groups: [] });
        });

        const error = await getOptimizationStatistics(VALID_FILTER_ID).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(OptimizationStatsError);
        expect(error).toMatchObject({
            filterId: VALID_FILTER_ID,
            sourcePath: expect.stringContaining(`/${FILTERS_DIR_NAME}/${VALID_FILTER_ID}/${STATS_JSON}`),
            code: 'OPTIMIZATION_STATS_INVALID',
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

describe('assertValidStats()', () => {
    const SOURCE_PATH = '/tmp/filters/1/stats.json';

    const catchError = (stats: unknown): OptimizationStatsError => {
        try {
            assertValidStats(VALID_FILTER_ID, SOURCE_PATH, stats);
        } catch (e) {
            return e as OptimizationStatsError;
        }
        throw new Error('assertValidStats did not throw');
    };

    describe('rejects non-object stats', () => {
        it.each([
            { label: 'null', value: null, printed: 'null' },
            { label: 'undefined', value: undefined, printed: 'undefined' },
            { label: 'a number', value: 5, printed: '5' },
            { label: 'a string', value: 'oops', printed: '"oops"' },
            { label: 'a boolean', value: false, printed: 'false' },
            { label: 'a BigInt', value: BigInt(10), printed: '10' },
        ])('throws OptimizationStatsError with a TypeError cause for $label', ({ value, printed }) => {
            const error = catchError(value);

            expect(error).toBeInstanceOf(OptimizationStatsError);
            expect(error.filterId).toBe(VALID_FILTER_ID);
            expect(error.sourcePath).toBe(SOURCE_PATH);
            expect(error.code).toBe('OPTIMIZATION_STATS_INVALID');
            expect(error.cause).toBeInstanceOf(TypeError);
            expect((error.cause as Error).message).toBe(
                `Optimization stats for ${VALID_FILTER_ID} must be a non-null object, but got ${printed}`,
            );
        });

        it('throws OptimizationStatsError with a TypeError cause for a function, without a raw crash', () => {
            const error = catchError(() => {});

            expect(error).toBeInstanceOf(OptimizationStatsError);
            expect(error.code).toBe('OPTIMIZATION_STATS_INVALID');
            expect(error.cause).toBeInstanceOf(TypeError);
            expect((error.cause as Error).message).toContain(
                `Optimization stats for ${VALID_FILTER_ID} must be a non-null object, but got `,
            );
        });
    });

    describe('rejects invalid groups', () => {
        it.each([
            { label: 'groups is missing', value: {}, groups: undefined },
            { label: 'groups is an empty array', value: { groups: [] }, groups: [] },
            { label: 'groups is null', value: { groups: null }, groups: null },
            { label: 'groups is not an array', value: { groups: 'nope' }, groups: 'nope' },
        ])('throws OptimizationStatsError carrying the offending groups when $label', ({ value, groups }) => {
            const error = catchError(value);

            expect(error).toBeInstanceOf(OptimizationStatsError);
            expect(error.filterId).toBe(VALID_FILTER_ID);
            expect(error.sourcePath).toBe(SOURCE_PATH);
            expect(error.code).toBe('OPTIMIZATION_STATS_INVALID');
            expect(error.cause).toBeInstanceOf(TypeError);
            expect((error.cause as Error).message).toBe(
                `Optimization stats for ${VALID_FILTER_ID}: groups is missing, not an array, or empty`,
            );
            expect((error.cause as Error).cause).toEqual({ groups });
        });
    });

    it('does not throw for valid stats', () => {
        expect(() => assertValidStats(VALID_FILTER_ID, SOURCE_PATH, MOCK_STATS_JSON)).not.toThrow();
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
