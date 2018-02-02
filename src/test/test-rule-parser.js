/* globals require, QUnit */

QUnit.test("Test rule parser - ruleTypes", (assert) => {
    'use strict';

    const RuleTypes = require('../main/rule/rule-types.js');
    const ruleParser = require('../main/rule/rule-parser.js');

    let line = '! comment';
    let rule = ruleParser.parseRule(line);
    assert.ok(rule);
    assert.equal(rule.ruleText, line);
    assert.equal(rule.ruleType, RuleTypes.Comment);

    line = 'example.com##selector';
    rule = ruleParser.parseRule(line);
    assert.ok(rule);
    assert.equal(rule.ruleText, line);
    assert.equal(rule.ruleType, RuleTypes.ElementHiding);
    assert.equal(rule.mask, '##');

    line = 'example.com$$script[data-src="banner"]';
    rule = ruleParser.parseRule(line);
    assert.ok(rule);
    assert.equal(rule.ruleText, line);
    assert.equal(rule.ruleType, RuleTypes.Content);
    assert.equal(rule.mask, '$$');

    line = 'example.org#%#window.__gaq = undefined;';
    rule = ruleParser.parseRule(line);
    assert.ok(rule);
    assert.equal(rule.ruleText, line);
    assert.equal(rule.ruleType, RuleTypes.Script);
    assert.equal(rule.mask, '#%#');

    line = 'test-common-rule.com$xmlhttprequest';
    rule = ruleParser.parseRule(line);
    assert.ok(rule);
    assert.equal(rule.ruleText, line);
    assert.equal(rule.ruleType, RuleTypes.UrlBlocking);

    line = 'example.com#$#smth';
    rule = ruleParser.parseRule(line);
    assert.ok(rule);
    assert.equal(rule.ruleText, line);
    assert.equal(rule.ruleType, RuleTypes.Css);
});

QUnit.test("Test rule parser - element hiding rules", (assert) => {
    'use strict';

    const RuleTypes = require('../main/rule/rule-types.js');
    const ruleParser = require('../main/rule/rule-parser.js');

    let line = 'example.com##div[align="center"] > a > img';
    let rule = ruleParser.parseRule(line);
    assert.ok(rule);
    assert.equal(rule.ruleText, line);
    assert.equal(rule.ruleType, RuleTypes.ElementHiding);
    assert.equal(rule.contentPart, 'div[align="center"] > a > img');
    assert.equal(rule.domains.length, 1);
    assert.equal(rule.domains[0], 'example.com');
});

QUnit.test("Test rule parser - cosmetic css rules", (assert) => {
    'use strict';

    const RuleTypes = require('../main/rule/rule-types.js');
    const ruleParser = require('../main/rule/rule-parser.js');

    let line = 'example.com#$#body { background-color: #333!important; }';
    let rule = ruleParser.parseRule(line);
    assert.ok(rule);
    assert.equal(rule.ruleText, line);
    assert.equal(rule.ruleType, RuleTypes.Css);
    assert.equal(rule.contentPart, 'body { background-color: #333!important; }');
    assert.equal(rule.domains.length, 1);
    assert.equal(rule.domains[0], 'example.com');
});

QUnit.test("Test rule parser - element hiding rules - extended css", (assert) => {
    'use strict';

    const RuleTypes = require('../main/rule/rule-types.js');
    const ruleParser = require('../main/rule/rule-parser.js');

    let line = '~gamespot.com,~mint.com,~slidetoplay.com,~smh.com.au,~zattoo.com##.sponsored[-ext-contains=test]';
    let rule = ruleParser.parseRule(line);
    assert.ok(rule);
    assert.equal(rule.ruleText, line);
    assert.equal(rule.ruleType, RuleTypes.ElementHiding);
    assert.equal(rule.contentPart, '.sponsored[-ext-contains=test]');
    assert.equal(rule.domains.length, 5);

    line = '~gamespot.com,~mint.com,~slidetoplay.com,~smh.com.au,~zattoo.com##.sponsored[-ext-has=test]';
    rule = ruleParser.parseRule(line);
    assert.ok(rule);
    assert.equal(rule.ruleText, line);
    assert.equal(rule.ruleType, RuleTypes.ElementHiding);
    assert.equal(rule.contentPart, '.sponsored[-ext-has=test]');
    assert.equal(rule.domains.length, 5);

    line = '~gamespot.com,~mint.com,~slidetoplay.com,~smh.com.au,~zattoo.com##.sponsored:has(test)';
    rule = ruleParser.parseRule(line);
    assert.ok(rule);
    assert.equal(rule.ruleText, line);
    assert.equal(rule.ruleType, RuleTypes.ElementHiding);
    assert.equal(rule.contentPart, '.sponsored:has(test)');
    assert.equal(rule.domains.length, 5);
});

QUnit.test("Test rule parser - url blocking rules", (assert) => {
    'use strict';

    const RuleTypes = require('../main/rule/rule-types.js');
    const ruleParser = require('../main/rule/rule-parser.js');

    let line = 'test-common-rule.com$xmlhttprequest';
    let rule = ruleParser.parseRule(line);
    assert.ok(rule);
    assert.equal(rule.ruleText, line);
    assert.equal(rule.ruleType, RuleTypes.UrlBlocking);
    assert.equal(rule.url, 'test-common-rule.com');
    assert.ok(rule.modifiers);
    assert.ok(rule.modifiers.xmlhttprequest);

    line = '||example.com^$domain=domain-one.org|domain-two.org';
    rule = ruleParser.parseRule(line);
    assert.ok(rule);
    assert.equal(rule.ruleText, line);
    assert.equal(rule.ruleType, RuleTypes.UrlBlocking);
    assert.equal(rule.url, '||example.com^');
    assert.ok(rule.modifiers);
    assert.ok(rule.modifiers.domain);
    assert.equal(rule.modifiers.domain.length, 2);
    assert.equal(rule.modifiers.domain[0], 'domain-one.org');
    assert.equal(rule.modifiers.domain[1], 'domain-two.org');
});

QUnit.test("Test rule parser - content rules", (assert) => {
    'use strict';

    const RuleTypes = require('../main/rule/rule-types.js');
    const ruleParser = require('../main/rule/rule-parser.js');

    let line = 'example.com$$script[data-src="banner"]';
    let rule = ruleParser.parseRule(line);
    assert.ok(rule);
    assert.equal(rule.ruleText, line);
    assert.equal(rule.ruleType, RuleTypes.Content);
    assert.equal(rule.domains.length, 1);
    assert.equal(rule.domains[0], 'example.com');
});

QUnit.test("Test rule parser - script rules", (assert) => {
    'use strict';

    const RuleTypes = require('../main/rule/rule-types.js');
    const ruleParser = require('../main/rule/rule-parser.js');

    let line = 'example.org#%#window.__gaq = undefined;';
    let rule = ruleParser.parseRule(line);
    assert.ok(rule);
    assert.equal(rule.ruleText, line);
    assert.equal(rule.ruleType, RuleTypes.Script);
    assert.equal(rule.domains.length, 1);
    assert.equal(rule.domains[0], 'example.org');
});

QUnit.test("Test rule parser - replace rules", (assert) => {
    'use strict';

    const RuleTypes = require('../main/rule/rule-types.js');
    const ruleParser = require('../main/rule/rule-parser.js');

    let line = '||api.ivi.ru/light/?$replace=/"files":[\s\S]*"mraid_file_url"/"files": []\, "mraid_file_url"/';
    let rule = ruleParser.parseRule(line);
    assert.ok(rule);
    assert.equal(rule.ruleText, line);
    assert.equal(rule.ruleType, RuleTypes.UrlBlocking);
    assert.ok(rule.modifiers.replace);
    assert.equal(rule.url, '||api.ivi.ru/light/?');
});

QUnit.test("Test rule parser - some rules", (assert) => {
    'use strict';

    const RuleTypes = require('../main/rule/rule-types.js');
    const ruleParser = require('../main/rule/rule-parser.js');

    let line = 'puls4.com##.media-actions-list > li:not(:nth-child(3)):not(:nth-child(4))';
    let rule = ruleParser.parseRule(line);
    assert.ok(rule);
    assert.equal(rule.ruleText, line);
    assert.equal(rule.ruleType, RuleTypes.ElementHiding);

    line = '@@||sedu.adhands.ru/view/?sid^$script,domain=tveda.ru';
    rule = ruleParser.parseRule(line);
    assert.ok(rule);
    assert.equal(rule.ruleText, line);
    assert.equal(rule.ruleType, RuleTypes.UrlBlocking);
    assert.equal(rule.url, '||sedu.adhands.ru/view/?sid^');
    assert.equal(rule.whiteList, true);

});

QUnit.test("Test rule parser - options parsing", (assert) => {
    'use strict';

    const RuleTypes = require('../main/rule/rule-types.js');
    const ruleParser = require('../main/rule/rule-parser.js');

    let line = '||news.yandex.*/*/*-*-*-*-$replace=/Ya[([0-9]{10\\,15})]([\\s\\S]*)\\$/,script,important,domain=news.yandex.by|news.yandex.com|news.yandex.fr|news.yandex.kz|news.yandex.ru|news.yandex.ua';
    let rule = ruleParser.parseRule(line);
    assert.ok(rule);
    assert.equal(rule.ruleText, line);
    assert.equal(rule.ruleType, RuleTypes.UrlBlocking);
    assert.equal(rule.url, '||news.yandex.*/*/*-*-*-*-');
    assert.ok(rule.modifiers.replace);
    assert.equal(rule.modifiers.replace, '/Ya[([0-9]{10\\,15})]([\\s\\S]*)\\$/');

    line = '||kopp-verlag.de/$WS/kopp-verlag/banners/$third-party';
    rule = ruleParser.parseRule(line);
    assert.ok(rule);
    assert.equal(rule.ruleText, line);
    assert.equal(rule.ruleType, RuleTypes.UrlBlocking);
    assert.equal(rule.url, '||kopp-verlag.de/$WS/kopp-verlag/banners/');
    assert.ok(rule.modifiers["third-party"]);

    line = '/\\.website\\/[0-9]{2,9}\\/$/$script,stylesheet,third-party,xmlhttprequest';
    rule = ruleParser.parseRule(line);
    assert.ok(rule);
    assert.equal(rule.ruleText, line);
    assert.equal(rule.ruleType, RuleTypes.UrlBlocking);
    assert.equal(rule.url, '/\\.website\\/[0-9]{2,9}\\/$/');
    assert.ok(rule.modifiers["third-party"]);
    assert.ok(rule.modifiers.script);
    assert.ok(rule.modifiers.stylesheet);
    assert.ok(rule.modifiers.xmlhttprequest);

    line = '/\\.party\\/[0-9]{2,9}\\/$/';
    rule = ruleParser.parseRule(line);
    assert.ok(rule);
    assert.equal(rule.ruleText, line);
    assert.equal(rule.ruleType, RuleTypes.UrlBlocking);
    assert.equal(rule.url, '/\\.party\\/[0-9]{2,9}\\/$/');

});

