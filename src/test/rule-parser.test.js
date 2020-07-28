/* eslint-disable max-len */
const RuleTypes = require('../main/rule/rule-types.js');
const ruleParser = require('../main/rule/rule-parser.js');

// Mock log to hide error messages
jest.mock('../main/utils/log');

describe('rule parser', () => {
    it('Test rule parser - ruleTypes', () => {
        let line = '! comment';
        let rule = ruleParser.parseRule(line);
        expect(rule).toBeDefined();
        expect(rule.ruleText).toBe(line);
        expect(rule.ruleType).toBe(RuleTypes.Comment);

        line = 'example.com##selector';
        rule = ruleParser.parseRule(line);
        expect(rule).toBeDefined();
        expect(rule.ruleText).toBe(line);
        expect(rule.ruleType).toBe(RuleTypes.ElementHiding);

        line = 'example.com$$script[data-src="banner"]';
        rule = ruleParser.parseRule(line);
        expect(rule).toBeDefined();
        expect(rule.ruleText).toBe(line);
        expect(rule.ruleType).toBe(RuleTypes.Content);

        line = 'example.org#%#window.__gaq = undefined;';
        rule = ruleParser.parseRule(line);
        expect(rule).toBeDefined();
        expect(rule.ruleText).toBe(line);
        expect(rule.ruleType).toBe(RuleTypes.Script);

        line = 'test-common-rule.com$xmlhttprequest';
        rule = ruleParser.parseRule(line);
        expect(rule).toBeDefined();
        expect(rule.ruleText).toBe(line);
        expect(rule.ruleType).toBe(RuleTypes.UrlBlocking);

        line = 'example.com#$#smth';
        rule = ruleParser.parseRule(line);
        expect(rule).toBeDefined();
        expect(rule.ruleText).toBe(line);
        expect(rule.ruleType).toBe(RuleTypes.Css);
    });

    it('Test rule parser - element hiding rules', () => {
        const line = 'example.com##div[align="center"] > a > img';
        const rule = ruleParser.parseRule(line);
        expect(rule).toBeDefined();
        expect(rule.ruleText).toBe(line);
        expect(rule.ruleType).toBe(RuleTypes.ElementHiding);
        expect(rule.contentPart).toBe('div[align="center"] > a > img');
        expect(rule.domains).toHaveLength(1);
        expect(rule.domains[0]).toBe('example.com');
    });

    it('Test rule parser - cosmetic css rules', () => {
        const line = 'example.com#$#body { background-color: #333!important; }';
        const rule = ruleParser.parseRule(line);
        expect(rule).toBeDefined();
        expect(rule.ruleText).toBe(line);
        expect(rule.ruleType).toBe(RuleTypes.Css);
        expect(rule.contentPart).toBe('body { background-color: #333!important; }');
        expect(rule.domains).toHaveLength(1);
        expect(rule.domains[0]).toBe('example.com');
    });

    it('Test rule parser - element hiding rules - extended css', () => {
        let line = '~gamespot.com,~mint.com,~slidetoplay.com,~smh.com.au,~zattoo.com##.sponsored[-ext-contains=test]';
        let rule = ruleParser.parseRule(line);
        expect(rule).toBeDefined();
        expect(rule.ruleText).toBe(line);
        expect(rule.ruleType).toBe(RuleTypes.ElementHiding);
        expect(rule.contentPart).toBe('.sponsored[-ext-contains=test]');
        expect(rule.domains).toHaveLength(5);

        line = '~gamespot.com,~mint.com,~slidetoplay.com,~smh.com.au,~zattoo.com##.sponsored[-ext-has=test]';
        rule = ruleParser.parseRule(line);
        expect(rule).toBeDefined();
        expect(rule.ruleText).toBe(line);
        expect(rule.ruleType).toBe(RuleTypes.ElementHiding);
        expect(rule.contentPart).toBe('.sponsored[-ext-has=test]');
        expect(rule.domains).toHaveLength(5);

        line = '~gamespot.com,~mint.com,~slidetoplay.com,~smh.com.au,~zattoo.com##.sponsored:has(test)';
        rule = ruleParser.parseRule(line);
        expect(rule).toBeDefined();
        expect(rule.ruleText).toBe(line);
        expect(rule.ruleType).toBe(RuleTypes.ElementHiding);
        expect(rule.contentPart).toBe('.sponsored:has(test)');
        expect(rule.domains).toHaveLength(5);
    });

    it('Test rule parser - url blocking rules', () => {
        let line = 'test-common-rule.com$xmlhttprequest';
        let rule = ruleParser.parseRule(line);
        expect(rule).toBeDefined();
        expect(rule.ruleText).toBe(line);
        expect(rule.ruleType).toBe(RuleTypes.UrlBlocking);
        expect(rule.url).toBe('test-common-rule.com');
        expect(rule.modifiers);
        expect(rule.modifiers.xmlhttprequest);

        line = '||example.com^$domain=domain-one.org|domain-two.org';
        rule = ruleParser.parseRule(line);
        expect(rule).toBeDefined();
        expect(rule.ruleText).toBe(line);
        expect(rule.ruleType).toBe(RuleTypes.UrlBlocking);
        expect(rule.url).toBe('||example.com^');
        expect(rule.modifiers);
        expect(rule.modifiers.domain);
        expect(rule.modifiers.domain).toHaveLength(2);
        expect(rule.modifiers.domain[0]).toBe('domain-one.org');
        expect(rule.modifiers.domain[1]).toBe('domain-two.org');
    });

    it('Test rule parser - content rules', () => {
        const line = 'example.com$$script[data-src="banner"]';
        const rule = ruleParser.parseRule(line);
        expect(rule).toBeDefined();
        expect(rule.ruleText).toBe(line);
        expect(rule.ruleType).toBe(RuleTypes.Content);
        expect(rule.domains).toHaveLength(1);
        expect(rule.domains[0]).toBe('example.com');
    });

    it('Test rule parser - script rules', () => {
        const line = 'example.org#%#window.__gaq = undefined;';
        const rule = ruleParser.parseRule(line);
        expect(rule).toBeDefined();
        expect(rule.ruleText).toBe(line);
        expect(rule.ruleType).toBe(RuleTypes.Script);
        expect(rule.domains).toHaveLength(1);
        expect(rule.domains[0]).toBe('example.org');
    });

    it('Test rule parser - replace rules', () => {
        const line = '||api.ivi.ru/light/?$replace=/"files":[\s\S]*"mraid_file_url"/"files": []\, "mraid_file_url"/';
        const rule = ruleParser.parseRule(line);
        expect(rule).toBeDefined();
        expect(rule.ruleText).toBe(line);
        expect(rule.ruleType).toBe(RuleTypes.UrlBlocking);
        expect(rule.modifiers.replace);
        expect(rule.url).toBe('||api.ivi.ru/light/?');
    });

    it('Test rule parser - some rules', () => {
        let line = 'puls4.com##.media-actions-list > li:not(:nth-child(3)):not(:nth-child(4))';
        let rule = ruleParser.parseRule(line);
        expect(rule).toBeDefined();
        expect(rule.ruleText).toBe(line);
        expect(rule.ruleType).toBe(RuleTypes.ElementHiding);

        line = '@@||sedu.adhands.ru/view/?sid^$script,domain=tveda.ru';
        rule = ruleParser.parseRule(line);
        expect(rule).toBeDefined();
        expect(rule.ruleText).toBe(line);
        expect(rule.ruleType).toBe(RuleTypes.UrlBlocking);
        expect(rule.url).toBe('||sedu.adhands.ru/view/?sid^');
        expect(rule.whiteList).toBeTruthy();
    });

    it('Test rule parser - options parsing', () => {
        let line = '||news.yandex.*/*/*-*-*-*-$replace=/Ya[([0-9]{10\\,15})]([\\s\\S]*)\\$/,script,important,domain=news.yandex.by|news.yandex.com|news.yandex.fr|news.yandex.kz|news.yandex.ru|news.yandex.ua';
        let rule = ruleParser.parseRule(line);
        expect(rule).toBeDefined();
        expect(rule.ruleText).toBe(line);
        expect(rule.ruleType).toBe(RuleTypes.UrlBlocking);
        expect(rule.url).toBe('||news.yandex.*/*/*-*-*-*-');
        expect(rule.modifiers.replace);
        expect(rule.modifiers.replace).toStrictEqual(['/Ya[([0-9]{10\\,15})]([\\s\\S]*)\\$/']);

        line = '||kopp-verlag.de/$WS/kopp-verlag/banners/$third-party';
        rule = ruleParser.parseRule(line);
        expect(rule).toBeDefined();
        expect(rule.ruleText).toBe(line);
        expect(rule.ruleType).toBe(RuleTypes.UrlBlocking);
        expect(rule.url).toBe('||kopp-verlag.de/$WS/kopp-verlag/banners/');
        expect(rule.modifiers['third-party']);

        line = '/\\.website\\/[0-9]{2,9}\\/$/$script,stylesheet,third-party,xmlhttprequest';
        rule = ruleParser.parseRule(line);
        expect(rule).toBeDefined();
        expect(rule.ruleText).toBe(line);
        expect(rule.ruleType).toBe(RuleTypes.UrlBlocking);
        expect(rule.url).toBe('/\\.website\\/[0-9]{2,9}\\/$/');
        expect(rule.modifiers['third-party']);
        expect(rule.modifiers.script);
        expect(rule.modifiers.stylesheet);
        expect(rule.modifiers.xmlhttprequest);

        line = '/\\.party\\/[0-9]{2,9}\\/$/';
        rule = ruleParser.parseRule(line);
        expect(rule).toBeDefined();
        expect(rule.ruleText).toBe(line);
        expect(rule.ruleType).toBe(RuleTypes.UrlBlocking);
        expect(rule.url).toBe('/\\.party\\/[0-9]{2,9}\\/$/');

        line = 'http://www.tgcom24.mediaset.it/bin/418.\\$plit/C_0_strillo6x4_263_GroupPublitalia_fotobanner.gif';
        rule = ruleParser.parseRule(line);
        expect(rule).toBeDefined();
        expect(rule.ruleText).toBe(line);
        expect(rule.ruleType).toBe(RuleTypes.UrlBlocking);
        expect(rule.url).toBe('http://www.tgcom24.mediaset.it/bin/418.\\$plit/C_0_strillo6x4_263_GroupPublitalia_fotobanner.gif');
    });
});
