const optimization = require('../main/optimization.js');

// Mock log to hide error messages
jest.mock('../main/utils/log');

describe('optimization', () => {
    it('Test optimization', () => {
        const filtersOptimizationPercent = optimization.getFiltersOptimizationPercent();

        expect(filtersOptimizationPercent.config.length).toBeGreaterThan(0);

        expect(optimization.getFilterOptimizationConfig(1)).toBeDefined();
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

        expect(optimization.skipRuleWithOptimization('low_hits1', config)).toBeTruthy();
        expect(optimization.skipRuleWithOptimization('low_hits1', config)).toBeTruthy();
        expect(optimization.skipRuleWithOptimization('enough_hits1', config)).toBeFalsy();
        expect(optimization.skipRuleWithOptimization('enough_hits2', config)).toBeFalsy();
        expect(optimization.skipRuleWithOptimization('unknown_rule', config)).toBeFalsy();
    });
});
