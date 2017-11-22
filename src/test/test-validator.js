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
        'test$domain=yandex.ru,google.com'];
    assert.ok(validator.validate(rules).length === 0);
});

QUnit.test("Test blacklist domains", (assert) => {
    'use strict';

    const before = `
||graph.com^$domain=google.com
||graph.facebook.com^$domain=jp.gocro.smartnews.android|onemore.ru|google.com|plus.one
||image.winudf.com/*/upload/promopure/$~third-party,empty,domain=apkpure.com|yahoo.com
example.com##.div
google.com###id
google.com,one.com##a[href^=/], .container:has(nav) > a[href]:lt($var)
`;

    const path = require('path');
    const domainsBlacklist = path.join(__dirname, './resources/domains-blacklist.txt');

    const validator = require("../main/validator.js");
    validator.init(domainsBlacklist);

    const after = validator.blacklistDomains(before.trim().split('\n'));

    assert.ok(after);
    assert.equal(after.length, 4);

    const correct = `
||graph.facebook.com^$domain=jp.gocro.smartnews.android|onemore.ru|plus.one
||image.winudf.com/*/upload/promopure/$~third-party,empty,domain=apkpure.com
example.com##.div
one.com##a[href^=/], .container:has(nav) > a[href]:lt($var)`;

    assert.equal(after.join('\n').trim(), correct.trim());
});

QUnit.test("Test ext-css validation", function (assert) {
    'use strict';

    const validator = require("../main/validator.js");
    validator.init();

    let selector = "#main > table.w3-table-all.notranslate:first-child > tbody > tr:nth-child(17) > td.notranslate:nth-child(2)";
    let ruleText = "w3schools.com##" + selector;
    let rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    selector = "#:root div.ads";
    ruleText = "w3schools.com##" + selector;
    rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    selector = "#body div[attr='test']:first-child  div";
    ruleText = "w3schools.com##" + selector;
    rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    selector = ".todaystripe::after";
    ruleText = "w3schools.com##" + selector;
    rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    selector = ".todaystripe:matches-css(display: block)";
    ruleText = "w3schools.com##" + selector;
    rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    selector = ".todaystripe:matches-css-before(display: block)";
    ruleText = "w3schools.com##" + selector;
    rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    selector = ".todaystripe:matches-css-after(display: block)";
    ruleText = "w3schools.com##" + selector;
    rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    selector = ".todaystripe:has(.banner)";
    ruleText = "w3schools.com##" + selector;
    rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    selector = ".todaystripe:contains(test)";
    ruleText = "w3schools.com##" + selector;
    rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    //Invalid pseudo class
    ruleText = "yandex.ru##[-ext-has=test]:matches(.whatisthis)";
    rules = [ruleText];
    assert.notOk(validator.validate(rules).length > 0);
});
