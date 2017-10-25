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

    try {
        rule = 'example.com$$empty';
        assert.ok(ruleUtils.parseRuleModifiers(rule));
        assert.ok(false);
    } catch (e) {
        assert.ok(e);
    }

    try {
        rule = '||example.com^$domain=domain.org,domain2.com';
        assert.ok(ruleUtils.parseRuleModifiers(rule));
        assert.ok(false);
    } catch (e) {
        assert.ok(e);
    }
});

