/* globals require, QUnit */

QUnit.test("Test hints", (assert) => {
    'use strict';

    const filter = require('../main/platforms/filter.js');

    const config = {
        "platform": "test",
        "path": "hints",
        "configuration": {
            "omitAdgHackRules": false,
            "omitCommentRules": false,
            "omitContentRules": false,
            "omitRulePatterns": false,
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

    //TODO: Check NOT_OPTIMIZED hint
});

