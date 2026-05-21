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
    skipRuleWithOptimization,
} from '../src/main/optimization';
import { downloadFile } from '../src/main/utils/webutils';

// Mock log to hide error messages
vi.mock('../src/main/utils/log');

// Mock downloadFile to avoid live HTTP calls in CI
vi.mock('../src/main/utils/webutils', () => ({
    downloadFile: vi.fn((url) => {
        if (url.includes('percent.json')) return JSON.stringify({ config: [{ filterId: 1, percent: 50 }] });

        return JSON.stringify({ groups: [{ config: { hits: 1 }, rules: {} }] });
    }),
}));

describe('localOptimizationConfig', () => {
    describe('downloadPercentJson()', () => {
        let tmpDir;
        let percent;

        beforeAll(async () => {
            tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opt-test-'));
            await localOptimizationConfig.downloadPercentJson(tmpDir);
            percent = JSON.parse(fs.readFileSync(path.join(tmpDir, 'percent.json'), 'utf-8'));
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
            tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opt-test-'));
            await localOptimizationConfig.downloadPercentJson(tmpDir);
            percent = JSON.parse(fs.readFileSync(path.join(tmpDir, 'percent.json'), 'utf-8'));
            await localOptimizationConfig.downloadStatsFromPercentJson(tmpDir);
        });

        afterAll(async () => {
            await localOptimizationConfig.reset(tmpDir);
        });

        it('writes stats.json for each filterId in percent.json', () => {
            percent.config.forEach(({ filterId }) => {
                const statsPath = path.join(tmpDir, 'filters', String(filterId), 'stats.json');
                expect(fs.existsSync(statsPath)).toBeTruthy();

                const statsContent = fs.readFileSync(statsPath, 'utf-8');
                expect(JSON.parse(statsContent).groups).toBeInstanceOf(Array);
            });
        });

        it('does not overwrite an existing stats.json', async () => {
            const { filterId } = percent.config[0];
            const statsPath = path.join(tmpDir, 'filters', String(filterId), 'stats.json');
            const before = fs.readFileSync(statsPath, 'utf-8');
            await localOptimizationConfig.downloadStatsFromPercentJson(tmpDir);
            const after = fs.readFileSync(statsPath, 'utf-8');
            expect(after).toBe(before);
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
        const result = await getOptimizationStats(999);
        expect(result).toBeNull();

        // stats endpoint must NOT have been called for the unlisted filter
        const statsCallMade = vi.mocked(downloadFile).mock.calls.some(
            ([url]) => url.includes('/filters/999/stats.json'),
        );
        expect(statsCallMade).toBe(false);
    });

    it('returns stats for a filterId listed in percent.json', async () => {
        const result = await getOptimizationStats(1);
        expect(result).not.toBeNull();
        expect(Array.isArray(result.groups)).toBe(true);
    });
});

describe('skipRuleWithOptimization()', () => {
    it('skips rules below the hit threshold', () => {
        const config = {
            groups: [
                {
                    config: { hits: 2 },
                    rules: {
                        'low_hits1': 1,
                        'enough_hits1': 2,
                    },
                },
                {
                    config: { hits: 4 },
                    rules: {
                        'low_hits2': 1,
                        'enough_hits2': 5,
                    },
                },
            ],
        };

        expect(skipRuleWithOptimization('low_hits1', config)).toBeTruthy();
        expect(skipRuleWithOptimization('low_hits1', config)).toBeTruthy();
        expect(skipRuleWithOptimization('enough_hits1', config)).toBeFalsy();
        expect(skipRuleWithOptimization('enough_hits2', config)).toBeFalsy();
        expect(skipRuleWithOptimization('unknown_rule', config)).toBeFalsy();
    });
});
