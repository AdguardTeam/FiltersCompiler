/* globals require, QUnit */

QUnit.test("Test optimization", (assert) => {

    'use strict';

    const optimization = require('../main/optimization.js');

    const filtersOptimizationPercent = optimization.getFiltersOptimizationPercent();

    assert.ok(filtersOptimizationPercent.config.length > 0);

    assert.ok(optimization.getFilterOptimizationConfig(1) !== null);
    //assert.ok(optimization.getFilterOptimizationConfig(4) === null);
});

QUnit.test("Test optimization skip rule", (assert) => {

        'use strict';

        const optimization = require('../main/optimization.js');

        const config = {
            groups: [
                {
                    config: {hits: 2},
                    rules: {
                        'low_hits1': 1,
                        'enough_hits1': 2
                    }
                },
                {
                    config: {hits: 4},
                    rules: {
                        'low_hits2': 1,
                        'enough_hits2': 5
                    }
                }
            ]
        };

        assert.ok(optimization.skipRuleWithOptimization('low_hits1', config));
        assert.ok(optimization.skipRuleWithOptimization('low_hits1', config));
        assert.notOk(optimization.skipRuleWithOptimization('enough_hits1', config));
        assert.notOk(optimization.skipRuleWithOptimization('enough_hits2', config));
        assert.notOk(optimization.skipRuleWithOptimization('unknown_rule', config));
    }
);

