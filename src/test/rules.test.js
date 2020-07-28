const RuleTypes = require('../main/rule/rule-types.js');
const ruleParser = require('../main/rule/rule-parser.js');
const Rule = require('../main/rule/rule.js');

// Mock log to hide error messages
jest.mock('../main/utils/log');

describe('rules test', () => {
    it('Test url rules modifiers', () => {
        const line = '||example.com^$domain=domain-one.org|domain-two.org';
        const rule = ruleParser.parseRule(line);
        expect(rule).toBeDefined();
        expect(rule.ruleText).toBe(line);
        expect(rule.ruleType).toBe(RuleTypes.UrlBlocking);
        expect(rule.modifiers).toBeDefined();
        expect(rule.modifiers.domain).toBeDefined();
        expect(rule.modifiers.domain).toHaveLength(2);
        expect(rule.modifiers.domain[0]).toBe('domain-one.org');
        expect(rule.modifiers.domain[1]).toBe('domain-two.org');
    });

    it('Test rules builds', () => {
        let ruleText = Rule.buildNewLeadingDomainsRuleText('selector', ['one.com', 'two.com'], '##');
        expect(ruleText).toBeDefined();
        expect(ruleText).toBe('one.com,two.com##selector');

        ruleText = Rule.buildNewUrlBlockingRuleText('url', ['one.com', 'two.com']);
        expect(ruleText).toBeDefined();
        expect(ruleText).toBe('url$domain=one.com|two.com');
    });
});
