import {
    describe,
    it,
    expect,
    vi,
} from 'vitest';
import {
    getFiltersOptimizationPercent,
    skipRuleWithOptimization,
} from '../src/main/optimization';

// Mock log to hide error messages
vi.mock('../src/main/utils/log');

describe('optimization', () => {
    it('Test optimization', () => {
        const filtersOptimizationPercent = getFiltersOptimizationPercent();

        expect(filtersOptimizationPercent.config.length).toBeGreaterThan(0);

        expect(getFiltersOptimizationPercent(1)).toBeDefined();
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
