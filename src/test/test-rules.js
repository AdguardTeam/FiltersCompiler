const RuleTypes = require('../main/rule/rule-types.js');
const ruleParser = require('../main/rule/rule-parser.js');
const Rule = require('../main/rule/rule.js');

QUnit.test('Test url rules changing modifiers', (assert) => {
    const line = '||example.com^$domain=domain-one.org|domain-two.org';
    const rule = ruleParser.parseRule(line);
    assert.ok(rule);
    assert.equal(rule.ruleText, line);
    assert.equal(rule.ruleType, RuleTypes.UrlBlocking);
    assert.ok(rule.modifiers);
    assert.ok(rule.modifiers.domain);
    assert.equal(rule.modifiers.domain.length, 2);
    assert.equal(rule.modifiers.domain[0], 'domain-one.org');
    assert.equal(rule.modifiers.domain[1], 'domain-two.org');

    rule.modifiers.domain.push('domain-three.org');

    const changed = rule.buildNewModifiers(rule.modifiers);
    assert.equal(changed, '||example.com^$domain=domain-one.org|domain-two.org|domain-three.org');
});

QUnit.test('Test rules builds', (assert) => {
    let ruleText = Rule.buildNewLeadingDomainsRuleText('selector', ['one.com', 'two.com'], '##');
    assert.ok(ruleText);
    assert.equal(ruleText, 'one.com,two.com##selector');

    ruleText = Rule.buildNewUrlBlockingRuleText('url', ['one.com', 'two.com']);
    assert.ok(ruleText);
    assert.equal(ruleText, 'url$domain=one.com|two.com');
});
