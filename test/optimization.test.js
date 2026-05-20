import {
    describe,
    it,
    expect,
    vi,
    afterEach,
    suite,
} from 'vitest';

import fs from 'fs';
import path from 'path';
import os from 'os';
import {
    localOptimizationConfig,
    skipRuleWithOptimization,
} from '../src/main/optimization';

// Mock log to hide error messages
vi.mock('../src/main/utils/log');

// Mock downloadFile to avoid live HTTP calls in CI
vi.mock('../src/main/utils/webutils', () => ({
    downloadFile: vi.fn((url) => {
        if (url.includes('percent.json')) return JSON.stringify({ config: [{ filterId: 1, percent: 50 }] });

        return JSON.stringify({ groups: [{ config: { hits: 1 }, rules: {} }] });
    }),
}));

describe('local optimization config', () => {
    let tmpDir;

    afterEach(() => {
        localOptimizationConfig.reset(tmpDir);
    });

    describe('download the percent.json', async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opt-test-'));
        await localOptimizationConfig.downloadPercentJson(tmpDir);

        const percent = JSON.parse(fs.readFileSync(path.join(tmpDir, 'percent.json'), 'utf-8'));

        it('it writes percent.json to cacheDir', async () => {
            expect(percent.config).toBeDefined();
            expect(percent.config).toBeInstanceOf(Array);
        });
    });

    describe('download each filter\'s stats.json', async () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opt-test-'));
        await localOptimizationConfig.downloadPercentJson(tmpDir);

        const percent = JSON.parse(fs.readFileSync(path.join(tmpDir, 'percent.json'), 'utf-8'));
        await localOptimizationConfig.downloadStatsFromPercentJson(tmpDir);

        suite('it writes stats.json for each filterId in percent.json', async () => {
            percent.config.forEach(({ filterId }) => {
                it(`writes stats.json for filterId: ${filterId}`, () => {
                    const statsPath = path.join(tmpDir, 'filters', String(filterId), 'stats.json');
                    expect(fs.existsSync(statsPath)).toBeTruthy();

                    const statsContent = fs.readFileSync(statsPath, 'utf-8');
                    expect(JSON.parse(statsContent).groups).toBeInstanceOf(Array);
                });
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

describe('optimization', () => {
    it('Test optimization skip rule', () => {
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
