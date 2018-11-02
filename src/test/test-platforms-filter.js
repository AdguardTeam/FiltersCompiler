/* globals require, QUnit */

QUnit.test("Test hints", (assert) => {
    'use strict';

    const filter = require('../main/platforms/filter.js');

    const config = {
        "platform": "test",
        "path": "hints",
        "configuration": {
            "removeRulePatterns": false,
            "ignoreRuleHints": false
        }
    };

    const before = [
        "! Comment",
        "example.com",
        "!+ PLATFORM(test, windows)",
        "included_platform",
        "!+ NOT_PLATFORM( windows, test )",
        "excluded_platform",
        "!+ PLATFORM(test) NOT_PLATFORM(windows)",
        "included_platform_2",
        "!+ NOT_OPTIMIZED",
        "not_optimized",
        "!+ INVALID_HINT",
        "invalid_hint"
    ];

    const after = filter.cleanupRules(before, config);

    assert.ok(after);
    assert.equal(after.length, 10);

    assert.ok(after.indexOf('example.com') >= 0);
    assert.ok(after.indexOf('included_platform') >= 0);
    assert.notOk(after.indexOf('excluded_platform') >= 0);
    assert.ok(after.indexOf('included_platform_2') >= 0);
    assert.ok(after.indexOf('not_optimized') >= 0);
    assert.ok(after.indexOf('invalid_hint') >= 0);
});

QUnit.test("Test optimization hints", (assert) => {
    'use strict';

    const filter = require('../main/platforms/filter.js');

    const config = {
        "platform": "test",
        "path": "hints",
        "configuration": {
            "removeRulePatterns": false,
            "ignoreRuleHints": false
        }
    };

    const optimizationConfig = {
        "groups": [
            {
                "config": {
                    "type": "WHITELIST",
                    "scope": "DOMAIN",
                    "hits": 1
                },
                "rules": {
                    "optimized.com": 0,
                    "other.com": 4,
                    "not_optimized": 1
                }
            },
            {
                "config": {
                    "type": "ELEMHIDE",
                    "scope": "DOMAIN",
                    "hits": 70
                },
                "rules": {
                    "###optimized": 0,
                    "###rule2": 4,
                    "###rule3": 1
                }
            }
        ],
        "percent": 10
    };

    //TODO: Check optimization percent

    const before = [
        "! Comment",
        "example.com",
        "optimized.com",
        "###optimized",
        "!+ NOT_OPTIMIZED",
        "not_optimized"
    ];

    const after = filter.cleanupAndOptimizeRules(before, config, optimizationConfig, 0);

    assert.ok(after);
    assert.equal(after.length, 3);

    assert.notOk(after.indexOf('! Comment') >= 0);
    assert.ok(after.indexOf('example.com') >= 0);
    assert.notOk(after.indexOf('optimized.com') >= 0);
    assert.notOk(after.indexOf('###optimized') >= 0);
    assert.ok(after.indexOf('not_optimized') >= 0);
});

QUnit.test("Test remove rule patterns", (assert) => {
    'use strict';

    const filter = require('../main/platforms/filter.js');

    const config = {
        "platform": "test",
        "path": "hints",
        "configuration": {
            "removeRulePatterns": [
                "\\[-ext-",
                ":has\\(",
                "\\$stealth"
            ],
            "ignoreRuleHints": false
        }
    };

    const before = [
        "! Comment",
        "example.com",
        "example.com$stealth",
        "javarchive.com##.sidebar_list > .widget_text:has(a[title = \"ads\"])",
        "aranzulla.it##body > div[id][class][-ext-has=\"a[href^='/locked-no-script.php']\"]"
    ];

    const after = filter.cleanupRules(before, config);

    assert.ok(after);
    assert.equal(after.length, 2);

    assert.ok(after.indexOf('! Comment') >= 0);
    assert.ok(after.indexOf('example.com') >= 0);
});
