/* globals require, QUnit */

QUnit.test("Test rule parser - ruleTypes", (assert) => {
    'use strict';

    let RuleTypes = require('../main/rule/rule-types.js');
    let ruleParser = require('../main/rule/rule-parser.js');

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

    line = 'example.com$$script[data-src="banner"]';
    rule = ruleParser.parseRule(line);
    assert.ok(rule);
    assert.equal(rule.ruleText, line);
    assert.equal(rule.ruleType, RuleTypes.Content);

    line = 'test-common-rule.com$xmlhttprequest';
    rule = ruleParser.parseRule(line);
    assert.ok(rule);
    assert.equal(rule.ruleText, line);
    assert.equal(rule.ruleType, RuleTypes.UrlBlocking);

    line = 'example.com#$#smth';
    rule = ruleParser.parseRule(line);
    assert.ok(rule);
    assert.equal(rule.ruleText, line);
    assert.equal(rule.ruleType, RuleTypes.Other);
});

QUnit.test("Test rule parser - element hiding rules", (assert) => {
    'use strict';

    let RuleTypes = require('../main/rule/rule-types.js');
    let ruleParser = require('../main/rule/rule-parser.js');

    let line = 'example.com##div[align="center"] > a > img';
    let rule = ruleParser.parseRule(line);
    assert.ok(rule);
    assert.equal(rule.ruleText, line);
    assert.equal(rule.ruleType, RuleTypes.ElementHiding);
    assert.equal(rule.cssSelector, 'div[align="center"] > a > img');
    assert.equal(rule.cssDomains.length, 1);
    assert.equal(rule.cssDomains[0], 'example.com');
});

QUnit.test("Test rule parser - url blocking rules", (assert) => {
    'use strict';

    let RuleTypes = require('../main/rule/rule-types.js');
    let ruleParser = require('../main/rule/rule-parser.js');

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

