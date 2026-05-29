import {
    describe,
    it,
    expect,
    vi,
    beforeAll,
    afterAll,
    afterEach,
} from 'vitest';

import fs from 'fs';
import path from 'path';
import os from 'os';
import {
    localOptimizationConfig,
    getOptimizationStats,
    shouldSkipRule,
    assertValidStats,
    PERCENT_JSON,
    STATS_JSON,
    FILTERS_DIR,
} from '../src/main/optimization';
import { downloadFile } from '../src/main/utils/webutils';

// Mock log to hide error messages
vi.mock('../src/main/utils/log');

const EMPTY_FILTER_IDS = Object.freeze([]);
const VALID_FILTER_ID = 1;
const INVALID_FILTER_ID = 9999;

// Mock downloadFile to avoid live HTTP calls in CI
vi.mock('../src/main/utils/webutils', () => ({
    downloadFile: vi.fn((url) => {
        if (url.includes(PERCENT_JSON)) {
            return JSON.stringify({ config: [{ filterId: VALID_FILTER_ID, percent: 50 }] });
        }

        return JSON.stringify({ groups: [{ config: { hits: 1 }, rules: {} }] });
    }),
}));

describe('localOptimizationConfig', () => {
    describe('downloadPercentJson()', () => {
        let tmpDir;
        let percent;

        beforeAll(async () => {
            tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'opt-test-'));
            await localOptimizationConfig.downloadPercentJson(tmpDir);
            percent = JSON.parse(await fs.promises.readFile(path.join(tmpDir, PERCENT_JSON), 'utf-8'));
        });

        afterAll(async () => {
            await localOptimizationConfig.reset(tmpDir);
        });

        it('writes percent.json to cacheDir', () => {
            expect(percent.config).toBeDefined();
            expect(percent.config).toBeInstanceOf(Array);
        });
    });

    describe('downloadStatsFromPercentJson()', () => {
        let tmpDir;
        let percent;

        beforeAll(async () => {
            tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'opt-test-'));
            await localOptimizationConfig.downloadPercentJson(tmpDir);
            percent = JSON.parse(await fs.promises.readFile(path.join(tmpDir, PERCENT_JSON), 'utf-8'));
            await localOptimizationConfig.downloadStatsFromPercentJson(tmpDir, EMPTY_FILTER_IDS);
        });

        afterAll(async () => {
            await localOptimizationConfig.reset(tmpDir);
        });

        it('writes stats.json for each filterId in percent.json', async () => {
            await Promise.all(
                percent.config.map(async ({ filterId }) => {
                    const statsPath = path.join(tmpDir, FILTERS_DIR, String(filterId), STATS_JSON);
                    expect(fs.existsSync(statsPath)).toBeTruthy();

                    const raw = await fs.promises.readFile(statsPath, 'utf-8');
                    expect(() => assertValidStats(filterId, JSON.parse(raw))).not.toThrow();
                }),
            );
        });

        it('does not overwrite an existing stats.json', async () => {
            const { filterId } = percent.config[0];
            const statsPath = path.join(tmpDir, FILTERS_DIR, String(filterId), STATS_JSON);
            const before = await fs.promises.readFile(statsPath, 'utf-8');
            await localOptimizationConfig.downloadStatsFromPercentJson(tmpDir, EMPTY_FILTER_IDS);
            const after = await fs.promises.readFile(statsPath, 'utf-8');
            expect(after).toBe(before);
        });
    });

    describe('downloadStatsFromPercentJson() with filterIds', () => {
        describe('filterIds matches a listed filter', () => {
            let tmpDir;

            beforeAll(async () => {
                tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'opt-test-'));
                await localOptimizationConfig.downloadPercentJson(tmpDir);
                vi.clearAllMocks();
                await localOptimizationConfig.downloadStatsFromPercentJson(tmpDir, [VALID_FILTER_ID]);
            });

            afterAll(async () => {
                await localOptimizationConfig.reset(tmpDir);
            });

            it('downloads stats only for the specified filter', () => {
                const statsCalls = vi.mocked(downloadFile).mock.calls.filter(([url]) => url.includes('/stats.json'));
                expect(statsCalls).toHaveLength(1);
                expect(statsCalls[0][0]).toContain(`/filters/${VALID_FILTER_ID}/stats.json`);
            });

            it('writes stats.json for the specified filter', () => {
                const statsPath = path.join(tmpDir, FILTERS_DIR, String(VALID_FILTER_ID), STATS_JSON);
                expect(fs.existsSync(statsPath)).toBeTruthy();
            });
        });

        describe('filterIds contains no filter listed in percent.json', () => {
            let tmpDir;

            beforeAll(async () => {
                tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'opt-test-'));
                await localOptimizationConfig.downloadPercentJson(tmpDir);
                vi.clearAllMocks();
                await localOptimizationConfig.downloadStatsFromPercentJson(tmpDir, [INVALID_FILTER_ID]);
            });

            afterAll(async () => {
                await localOptimizationConfig.reset(tmpDir);
            });

            it('downloads no stats', () => {
                const statsCalls = vi.mocked(downloadFile).mock.calls.filter(([url]) => url.includes(`/${STATS_JSON}`));
                expect(statsCalls).toHaveLength(0);
            });
        });
    });
});

describe('getOptimizationStats()', () => {
    afterEach(async () => {
        vi.clearAllMocks();
        // clear module-level state between tests
        const fakeDir = path.join(os.tmpdir(), `nonexistent-opt-reset-${Date.now()}`);
        await localOptimizationConfig.reset(fakeDir).catch(() => {});
    });

    it('returns null for a filterId not listed in percent.json', async () => {
        const result = await getOptimizationStats(INVALID_FILTER_ID);
        expect(result).toBeNull();

        // stats endpoint must NOT have been called for the unlisted filter
        const statsCallMade = vi
            .mocked(downloadFile)
            .mock.calls.some(([url]) => url.includes(`/${FILTERS_DIR}/${INVALID_FILTER_ID}/${STATS_JSON}`));
        expect(statsCallMade).toBe(false);
    });

    it('returns stats for a filterId listed in percent.json', async () => {
        const result = await getOptimizationStats(VALID_FILTER_ID);
        expect(result).not.toBeNull();
        expect(() => assertValidStats(VALID_FILTER_ID, result)).not.toThrow();
    });
});

describe('useLocalConfig()', () => {
    let tmpDir;

    beforeAll(async () => {
        tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'opt-local-'));

        await fs.promises.writeFile(
            path.join(tmpDir, PERCENT_JSON),
            JSON.stringify({ config: [{ filterId: VALID_FILTER_ID, percent: 50 }] }),
            'utf-8',
        );

        const statsDir = path.join(tmpDir, FILTERS_DIR, String(VALID_FILTER_ID));
        await fs.promises.mkdir(statsDir, { recursive: true });
        await fs.promises.writeFile(
            path.join(statsDir, STATS_JSON),
            JSON.stringify({ groups: [{ config: { hits: 1 }, rules: {} }] }),
            'utf-8',
        );

        localOptimizationConfig.useLocalConfig(tmpDir);
    });

    afterAll(async () => {
        await localOptimizationConfig.reset(tmpDir);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('reads stats from local file without remote calls', async () => {
        const result = await getOptimizationStats(VALID_FILTER_ID);
        expect(result).not.toBeNull();
        expect(() => assertValidStats(VALID_FILTER_ID, result)).not.toThrow();

        const remoteCallMade = vi.mocked(downloadFile).mock.calls.some(([url]) => url.includes(`/${PERCENT_JSON}`));
        expect(remoteCallMade).toBe(false);
    });

    it(`returns null for filter not listed in local ${PERCENT_JSON}`, async () => {
        const result = await getOptimizationStats(INVALID_FILTER_ID);
        expect(result).toBeNull();
    });
});

describe('assertValidStats()', () => {
    it('throws when groups is missing', () => {
        expect(() => assertValidStats(VALID_FILTER_ID, {})).toThrow('missing or empty groups');
    });

    it('throws when groups is an empty array', () => {
        expect(() => assertValidStats(VALID_FILTER_ID, { groups: [] })).toThrow('missing or empty groups');
    });

    it('throws when groups is not an array', () => {
        expect(() => assertValidStats(VALID_FILTER_ID, { groups: null })).toThrow('missing or empty groups');
    });

    it('does not throw for valid stats', () => {
        expect(() => assertValidStats(VALID_FILTER_ID, { groups: [{ config: { hits: 1 }, rules: {} }] })).not.toThrow();
    });
});

describe('shouldSkipRule()', () => {
    it('skips rules below the hit threshold', () => {
        const config = {
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

        expect(shouldSkipRule('low_hits1', config)).toBeTruthy();
        expect(shouldSkipRule('low_hits1', config)).toBeTruthy();
        expect(shouldSkipRule('enough_hits1', config)).toBeFalsy();
        expect(shouldSkipRule('enough_hits2', config)).toBeFalsy();
        expect(shouldSkipRule('unknown_rule', config)).toBeFalsy();
    });
});
