/* globals require, QUnit */

QUnit.test("Test rule utils", (assert) => {
    'use strict';

    let ruleUtils = require('../main/utils/rule-utils.js');

    let rule = 'example.com##div[align="center"] > a > img';
    assert.ok(ruleUtils.isElementHidingRule(rule));

    rule = 'example.com$script';
    assert.notOk(ruleUtils.isElementHidingRule(rule));

    try {
        rule = 'example.com$empty,script';
        assert.ok(ruleUtils.parseRuleModifiers(rule));
    } catch (e) {
        assert.ok(false);
    }

    rule = 'example.com$$empty';
    assert.ok(ruleUtils.parseRuleModifiers(rule).empty);

    rule = '||example.com^$domain=domain.org';
    assert.ok(ruleUtils.parseRuleModifiers(rule).domain);
    assert.equal(ruleUtils.parseRuleModifiers(rule).domain[0], 'domain.org');
});

