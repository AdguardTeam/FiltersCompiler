/* globals require, QUnit, __dirname */

/**
 * @typedef {Object} assert
 * @property {function} equal
 * @property {function} ok
 * @property {function} notOk
 */

/**
 * @typedef {Object} path
 * @property {function} join
 */

QUnit.test("Test css validation", function (assert) {
    'use strict';

    const validator = require("../main/validator.js");
    validator.init();

    let rules = ['example.com##.div'];
    assert.ok(validator.validate(rules).length > 0);
    rules = ['example.com###div-id'];
    assert.ok(validator.validate(rules).length > 0);
    rules = ['example.com##a[href^=/], .container:has(nav) > a[href]:lt($var)'];
    assert.ok(validator.validate(rules).length > 0);
    rules = ['example.com##%'];
    assert.notOk(validator.validate(rules).length > 0);
});

QUnit.test("Test incorrect rules", function (assert) {
    'use strict';

    const validator = require("../main/validator.js");
    validator.init();

    const rules = ['||example.com##.div',
        'test$$domain=yandex.ru',
        'test$domain=yandex.ru,google.com'];
    assert.ok(validator.validate(rules).length === 0);
});

QUnit.test("Test blacklist domains", (assert) => {
    'use strict';

    const before = `
||graph.com^$domain=google.com
||graph.facebook.com^$domain=jp.gocro.smartnews.android|onemore.ru|google.com|plus.one
||image.winudf.com/*/upload/promopure/$~third-party,empty,domain=apkpure.com|yahoo.com`;

    const path = require('path');
    const domainsBlacklist = path.join(__dirname, './resources/domains-blacklist.txt');

    const validator = require("../main/validator.js");
    validator.init(domainsBlacklist);

    const after = validator.blacklistDomains(before.trim().split('\n'));

    assert.ok(after);
    assert.equal(after.length, 2);

    const correct = `
||graph.facebook.com^$domain=jp.gocro.smartnews.android|onemore.ru|plus.one
||image.winudf.com/*/upload/promopure/$~third-party,empty,domain=apkpure.com`;

    assert.equal(after.join('\n').trim(), correct.trim());
});
