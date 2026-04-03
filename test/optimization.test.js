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
    optimizationConfigLocal,
    getOptimizationPercent,
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

describe('optimizationConfigLocal', () => {
    afterEach(() => {
        optimizationConfigLocal.reset();
    });

    describe('getOptimizationPercent with setPath', () => {
        it('Throws when setPath is called with non-existent directory', () => {
            const nonExistentDir = path.join(os.tmpdir(), `no-such-dir-${Date.now()}`);
            optimizationConfigLocal.setPath(nonExistentDir);

            expect(() => getOptimizationPercent()).toThrowError(
                /no such file or directory/i,
            );
        });

        it('Reads from cacheDir when setPath is called with existing directory', () => {
            const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opt-test-'));
            const percentData = { config: [{ filterId: 99, percent: 30 }] };
            fs.writeFileSync(path.join(tmpDir, 'percent.json'), JSON.stringify(percentData), 'utf-8');

            optimizationConfigLocal.setPath(tmpDir);

            const result = getOptimizationPercent();
            expect(result.config[0].filterId).toBe(percentData.config[0].filterId);
        });
    });

    describe('generate', async () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opt-test-'));
        await optimizationConfigLocal.generate(tmpDir);

        const percent = JSON.parse(fs.readFileSync(path.join(tmpDir, 'percent.json'), 'utf-8'));

        it('it writes percent.json to cacheDir', async () => {
            expect(percent.config).toBeDefined();
            expect(percent.config).toBeInstanceOf(Array);
        });
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
    });
});

describe('optimization', () => {
    it('Test optimization', () => {
        const filtersOptimizationPercent = getOptimizationPercent();

        expect(filtersOptimizationPercent.config.length).toBeGreaterThan(0);

        expect(getOptimizationPercent(1)).toBeDefined();
    });

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
