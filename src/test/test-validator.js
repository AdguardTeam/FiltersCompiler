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

    let validator = require("../main/validator.js");
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

    let validator = require("../main/validator.js");
    validator.init();

    let rules = ['||example.com##.div',
        'test$$domain=yandex.ru',
        'test$domain=yandex.ru,google.com'];
    assert.ok(validator.validate(rules).length === 0);
});

QUnit.test("Test blacklist domains", (assert) => {
    'use strict';

    let before = `
||graph.com^$domain=google.com
||graph.facebook.com^$domain=jp.gocro.smartnews.android|onemore.ru|google.com|plus.one
||image.winudf.com/*/upload/promopure/$~third-party,empty,domain=apkpure.com|yahoo.com`;

    let path = require('path');
    let domainsBlacklist = path.join(__dirname, './resources/domains-blacklist.txt');

    let validator = require("../main/validator.js");
    validator.init(domainsBlacklist);

    let after = validator.blacklistDomains(before.trim().split('\n'));

    assert.ok(after);
    assert.equal(after.length, 2);

    let correct = `
||graph.facebook.com^$domain=jp.gocro.smartnews.android|onemore.ru|plus.one
||image.winudf.com/*/upload/promopure/$~third-party,empty,domain=apkpure.com`;

    assert.equal(after.join('\n').trim(), correct.trim());
});
