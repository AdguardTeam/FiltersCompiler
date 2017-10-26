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

QUnit.test("Test domain validation", function (assert) {
    'use strict';

    let path = require('path');
    let fs = require('fs');

    let domainsBlacklist = path.join(__dirname, './resources/domains-blacklist.txt');

    let validator = require("../main/validator.js");
    validator.init(domainsBlacklist);

    let rules = [
        'test$domain=google.com',
        'test$domain=www.google.com',
        'test$domain=yandex.ru',
        'test$domain=yahoo.com'
    ];

    let result = validator.validate(rules);

    assert.ok(result);
    assert.equal(result.length, 2);
    assert.equal(result[0], 'test$domain=www.google.com');
    assert.equal(result[1], 'test$domain=yandex.ru');
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
