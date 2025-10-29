/* eslint-disable max-len */
import {
    describe,
    it,
    expect,
    vi,
} from 'vitest';

import {
    convertAdgToUbo,
    convertAbpToAdg,
    convertScriptletToAdg,
} from '@adguard/scriptlets/converters';

import {
    convertRulesToAdgSyntax,
    convertToUbo,
} from '../src/main/converter';

// Mock log to hide error messages
vi.mock('../src/main/utils/log');

describe('converter', () => {
    it('converts rules', () => {
        let c = convertRulesToAdgSyntax(['example.com']);
        expect(c[0]).toBe('example.com');

        c = convertRulesToAdgSyntax(['example.com##h1:style(background-color: blue !important)']);
        expect(c[0]).toBe('example.com#$#h1 { background-color: blue !important }');

        c = convertRulesToAdgSyntax(['example.com#@#h1:style(background-color: blue !important)']);
        expect(c[0]).toBe('example.com#@$#h1 { background-color: blue !important }');

        c = convertRulesToAdgSyntax(['yourconroenews.com#@##siteNav:style(transform: none !important;)']);
        expect(c[0]).toBe('yourconroenews.com#@$##siteNav { transform: none !important; }');

        c = convertRulesToAdgSyntax(['apkmirror.com##body .google-ad-leaderboard-smaller:style(position: absolute!important; left: -4000px!important; display:block!important;)']);
        expect(c[0]).toBe('apkmirror.com#$#body .google-ad-leaderboard-smaller { position: absolute!important; left: -4000px!important; display:block!important; }');

        c = convertRulesToAdgSyntax(['apkmirror.com##body .google-ad-square-sidebar:style(position: absolute!important; left: -4000px!important; display:block!important;)']);
        expect(c[0]).toBe('apkmirror.com#$#body .google-ad-square-sidebar { position: absolute!important; left: -4000px!important; display:block!important; }');

        c = convertRulesToAdgSyntax(['benchmark.pl###bannerDBB:style(height: 10px !important;)']);
        expect(c[0]).toBe('benchmark.pl#$##bannerDBB { height: 10px !important; }');

        c = convertRulesToAdgSyntax(['example.org##body[style^="position: fixed"]:style(position: static !important;)']);
        expect(c[0]).toBe('example.org#$#body[style^="position: fixed"] { position: static !important; }');

        // https://github.com/AdguardTeam/FiltersCompiler/issues/24
        c = convertRulesToAdgSyntax(['720hd.club#?##all:style(margin-top: 0 !important)']);
        expect(c[0]).toBe('720hd.club#$##all { margin-top: 0 !important }');

        c = convertRulesToAdgSyntax(['720hd.club#@?##all:style(margin-top: 0 !important)']);
        expect(c[0]).toBe('720hd.club#@$##all { margin-top: 0 !important }');

        // https://github.com/AdguardTeam/FiltersCompiler/issues/54
        c = convertRulesToAdgSyntax(['#####']);
        expect(c[0]).toBe('! #####');

        c = convertRulesToAdgSyntax(['# ubo syntax comment']);
        expect(c[0]).toBe('! # ubo syntax comment');

        c = convertRulesToAdgSyntax(['##selector']);
        expect(c[0]).toBe('##selector');

        // https://github.com/AdguardTeam/FiltersCompiler/issues/242
        c = convertRulesToAdgSyntax([String.raw`new.lewd.ninja##div[class^="box ~!@$%^&*()_+-=,./';:?><[]"]`]);
        expect(c[0]).toBe(String.raw`new.lewd.ninja##div[class^="box ~!@$%^&*()_+-=,./';:?><[]"]`);

        c = convertRulesToAdgSyntax(['']);
        expect(c[0]).toEqual('');
    });

    it('converts network rule modifiers', () => {
        // escaped comma in regexp modifier value should remain escaped after the conversion
        let c = convertRulesToAdgSyntax([String.raw`||example.org^$hls=/^__s=[A-Za-z0-9]{6\,}/`]);
        expect(c[0]).toBe(String.raw`||example.org^$hls=/^__s=[A-Za-z0-9]{6\,}/`);

        c = convertRulesToAdgSyntax([String.raw`||example.org/*/*/$jsonprune=\\$..[ac\\, ab]`]);
        expect(c[0]).toBe(String.raw`||example.org/*/*/$jsonprune=\\$..[ac\\, ab]`);

        c = convertRulesToAdgSyntax([String.raw`||example.com^$referrerpolicy=origin`]);
        expect(c[0]).toBe(String.raw`||example.com^$referrerpolicy=origin`);

        c = convertRulesToAdgSyntax([String.raw`||example.org/*/*/$removeparam=/^__s=[A-Za-z0-9]{6\,}/`]);
        expect(c[0]).toBe(String.raw`||example.org/*/*/$removeparam=/^__s=[A-Za-z0-9]{6\,}/`);

        c = convertRulesToAdgSyntax([String.raw`||example.org/*/*/$replace=/<item type=\"banner\">.{280\,400}.*<\/background><\/item>//`]);
        expect(c[0]).toBe(String.raw`||example.org/*/*/$replace=/<item type=\"banner\">.{280\,400}.*<\/background><\/item>//`);

        c = convertRulesToAdgSyntax(['||example.org^$permissions=geolocation=()']);
        expect(c[0]).toBe('||example.org^$permissions=geolocation=()');

        c = convertRulesToAdgSyntax([String.raw`://www.*.com/*.css|$script,third-party,header=link:/ads\.re\/>;rel=preconnect/`]);
        expect(c[0]).toBe(String.raw`://www.*.com/*.css|$script,third-party,header=link:/ads\.re\/>;rel=preconnect/`);
    });

    it('keeps cosmetic rule as is', () => {
        const source = 'example.com##div[data-render-state] + div[class^="jsx-"][class$=" undefined"]';
        const expected = source;

        const c = convertRulesToAdgSyntax([source]);
        expect(c).toEqual([expected]);
    });

    it('keeps cosmetic JS rule as is', () => {
        const source = 'example.org#%#var str = /[class$=" undefined"]/; console.log(str);';
        const expected = source;

        const c = convertRulesToAdgSyntax([source]);
        expect(c).toEqual([expected]);
    });

    describe('collects logs for converted rules', () => {
        it('formats conversion message for single converted rule', () => {
            const rule = 'example.com##h1:style(background-color: blue !important)';
            const excluded = [];
            const result = convertRulesToAdgSyntax([rule], excluded);
            expect(result[0]).toBe('example.com#$#h1 { background-color: blue !important }');
            expect(excluded).toHaveLength(2);
            expect(excluded[0]).toContain('converted to:');
            expect(excluded[0]).not.toContain('to multiple rules:');
        });

        it('formats conversion message for multiple converted rules', () => {
            const rule = 'test.com#$#abort-on-property-read adsShown; json-prune ad vinfo';
            const excluded = [];
            convertRulesToAdgSyntax([rule], excluded);
            const logMessages = excluded.filter((msg) => msg.startsWith('!'));
            expect(logMessages.some((msg) => msg.includes('to multiple rules:'))).toBeTruthy();
        });
    });

    it('converts first-party replaced by ~third-party', () => {
        let actual = convertRulesToAdgSyntax(['||www.ynet.co.il^$important,websocket,first-party']);
        let expected = '||www.ynet.co.il^$important,websocket,~third-party';
        expect(actual[0]).toBe(expected);

        actual = convertRulesToAdgSyntax(['||zive.cz^*+$script,first-party']);
        expected = '||zive.cz^*+$script,~third-party';
        expect(actual[0]).toBe(expected);

        actual = convertRulesToAdgSyntax(['||zive.cz^*+$script,first-party']);
        expected = '||zive.cz^*+$script,~third-party';
        expect(actual[0]).toBe(expected);

        actual = convertRulesToAdgSyntax(['||zive.cz^*+$first-party,script']);
        expected = '||zive.cz^*+$~third-party,script';
        expect(actual[0]).toBe(expected);

        actual = convertRulesToAdgSyntax(['||zive.cz^*+$first-party']);
        expected = '||zive.cz^*+$~third-party';
        expect(actual[0]).toBe(expected);

        actual = convertRulesToAdgSyntax(['||www.ynet.co.il^$important,websocket,first-party', '||zive.cz^*+$script,first-party']);
        expected = ['||www.ynet.co.il^$important,websocket,~third-party', '||zive.cz^*+$script,~third-party'];
        expect(actual[0]).toBe(expected[0]);
        expect(actual[1]).toBe(expected[1]);
    });

    it('converts options replacement', () => {
        let actual = convertRulesToAdgSyntax(['||www.ynet.co.il^$xhr,websocket']);
        let expected = '||www.ynet.co.il^$xmlhttprequest,websocket';
        expect(actual[0]).toBe(expected);

        actual = convertRulesToAdgSyntax(['||zive.cz^*+$script,xhr']);
        expected = '||zive.cz^*+$script,xmlhttprequest';
        expect(actual[0]).toBe(expected);

        actual = convertRulesToAdgSyntax(['||zive.cz^*+$script,css']);
        expected = '||zive.cz^*+$script,stylesheet';
        expect(actual[0]).toBe(expected);

        actual = convertRulesToAdgSyntax(['||zive.cz^*+$css,script']);
        expected = '||zive.cz^*+$stylesheet,script';
        expect(actual[0]).toBe(expected);

        // does not converts "css" substrings outside of options
        const rule = 'csoonline.com,csswizardry.com##.ad';
        actual = convertRulesToAdgSyntax([rule]);
        expect(actual[0]).toBe(rule);

        actual = convertRulesToAdgSyntax(['||zive.cz^*+$frame']);
        expected = '||zive.cz^*+$subdocument';
        expect(actual[0]).toBe(expected);

        actual = convertRulesToAdgSyntax(['||zive.cz^*+$xhr,frame']);
        expected = '||zive.cz^*+$xmlhttprequest,subdocument';
        expect(actual[0]).toBe(expected);
    });

    it('convertRulesToAdgSyntax scriptlets', () => {
        const input = "example.com#%#//scriptlet('trusted-replace-argument', 'Math.round', '0', '121', '/^(\d\d?|1[0-2]\d)\.\d+$/')";
        const converted = convertRulesToAdgSyntax([input]);
        expect(converted[0]).toEqual(input);
    });

    it('converts scriptlets to UBlock syntax', () => {
        // scriptlet with one argument
        let actual = convertToUbo(['example.org#%#//scriptlet("abort-on-property-read", "alert")']);
        let expected = 'example.org##+js(abort-on-property-read, alert)';
        expect(actual[0]).toBe(expected);

        // scriptlet with ubo-compatible name
        actual = convertToUbo(['example.org#%#//scriptlet("ubo-abort-on-property-read.js", "alert")']);
        expected = 'example.org##+js(abort-on-property-read, alert)';
        expect(actual[0]).toBe(expected);

        // trusted scriptlets should not be converted to uBlock syntax
        actual = convertToUbo(['example.com#%#//scriptlet("trusted-set-cookie", "cName", "cValue")']);
        expected = '';
        expect(actual[0]).toBe(expected);

        actual = convertToUbo(["example.com#%#//scriptlet('trusted-replace-argument', 'Math.round', '0', '121', '/^(\d\d?|1[0-2]\d)\.\d+$/')"]);
        expected = '';
        expect(actual[0]).toBe(expected);

        // scriptlet with two arguments
        actual = convertToUbo(["example.org#%#//scriptlet('set-constant', 'firstConst', 'false')"]);
        expected = 'example.org##+js(set-constant, firstConst, false)';
        expect(actual[0]).toBe(expected);

        // scriptlet without arguments and few domains
        // 'prevent-adfly' : does not have uBlock equivalent
        actual = convertToUbo(["example1.org,example2.com,some-domain.dom#%#//scriptlet('prevent-refresh')"]);
        expected = 'example1.org,example2.com,some-domain.dom##+js(prevent-refresh)';
        expect(actual[0]).toBe(expected);

        // scriptlet argument includes quotes
        actual = convertToUbo(["example.org#%#//scriptlet('set-constant', 'constName', 'value\"12345\"')"]);
        expected = 'example.org##+js(set-constant, constName, value"12345")';
        expect(actual[0]).toBe(expected);

        // set-constant with empty string arg
        actual = convertToUbo(["example.org#%#//scriptlet('set-constant', 'arg.name', '')"]);
        expected = 'example.org##+js(set-constant, arg.name, \'\')';
        expect(actual[0]).toBe(expected);

        // multiple selectors for remove-attr/class
        actual = convertToUbo(['example.org#%#//scriptlet(\'remove-class\', \'promo\', \'a.class, div#id, div > #ad > .test\')']);
        expected = 'example.org##+js(remove-class, promo, a.class\\, div#id\\, div > #ad > .test)';
        expect(actual[0]).toBe(expected);

        actual = convertToUbo(['']);
        expected = '';
        expect(actual[0]).toBe(expected);

        actual = convertToUbo(undefined);
        expected = [];
        expect(actual).toEqual(expected);

        actual = convertToUbo([String.raw`example.com#%#//scriptlet('adjust-setInterval', ',dataType:_', '1000', '0.02')`]);
        expected = [String.raw`example.com##+js(adjust-setInterval, \,dataType:_, 1000, 0.02)`];
        expect(actual).toEqual(expected);

        actual = convertToUbo(["example.org#%#//scriptlet('set-session-storage-item', 'acceptCookies', 'false')"]);
        expected = 'example.org##+js(set-session-storage-item, acceptCookies, false)';
        expect(actual[0]).toBe(expected);
    });

    it('converts ##^script:has-text to $$script[tag-contains]', () => {
        let actual = convertRulesToAdgSyntax(['example.com##^script:has-text(12313)']);
        let expected = 'example.com$$script[tag-content="12313"][max-length="262144"]';
        expect(actual[0]).toBe(expected);

        actual = convertRulesToAdgSyntax(['example.com##^script:contains(banner)']);
        expected = 'example.com$$script[tag-content="banner"][max-length="262144"]';
        expect(actual[0]).toBe(expected);

        /**
         * regexp as tag-content arg is not supported by AdGuard HTML filtering rules
         * https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#tag-content
         *
         * so such rules should be discarded
         * https://github.com/AdguardTeam/tsurlfilter/issues/55
         */
        actual = convertRulesToAdgSyntax(['example.com##^script:contains(/.+banner/)']);
        expect(actual[0]).toBe(undefined);

        actual = convertRulesToAdgSyntax(['example.com##^script:has-text(/\.advert/)']);
        expect(actual[0]).toBe(undefined);
    });

    describe('converts html rules with pseudo-classes', () => {
        it.each([
            'example.com$$script:contains(eval(function(p,a,c,k,e,d))',
            'example.com$$script:contains((function(_0x)',
            'example.com$$script:contains(Array.from(document.querySelectorAll)',
            "example.com$$script:contains(document.addEventListener('click')",
        ])('$input', (input) => {
            const actual = convertRulesToAdgSyntax([input]);
            // keep the rule as is. TODO: check while AG-24662 resolving
            expect(actual[0]).toBe(input);
        });
    });

    it('converts $1p to $~third-party and $3p to $third-party', () => {
        let actual = convertRulesToAdgSyntax(['||www.ynet.co.il^$important,websocket,1p,domain=www.ynet.co.il']);
        let expected = '||www.ynet.co.il^$important,websocket,~third-party,domain=www.ynet.co.il';
        expect(actual[0]).toBe(expected);

        actual = convertRulesToAdgSyntax(['*$image,redirect-rule=1x1.gif,domain=seznamzpravy.cz']);
        expected = '*$image,redirect-rule=1x1-transparent.gif,domain=seznamzpravy.cz';
        expect(actual[0]).toBe(expected);

        actual = convertRulesToAdgSyntax(['||20il.co.il^$important,websocket,1p']);
        expected = '||20il.co.il^$important,websocket,~third-party';
        expect(actual[0]).toBe(expected);

        actual = convertRulesToAdgSyntax(['||vidads.gr^$3p']);
        expected = '||vidads.gr^$third-party';
        expect(actual[0]).toBe(expected);

        actual = convertRulesToAdgSyntax(['@@.com/ads.js|$3p,domain=~3ppt.com']);
        expected = '@@.com/ads.js|$third-party,domain=~3ppt.com';
        expect(actual[0]).toBe(expected);

        actual = convertRulesToAdgSyntax(['@@.com/ads.js|$~third-party,domain=~3ppt.com']);
        expected = '@@.com/ads.js|$~third-party,domain=~third-partypt.com';
        expect(actual[0]).not.toBe(expected);

        actual = convertRulesToAdgSyntax(['spiele-umsonst.de##.left > div.right[style$="1px;"]']);
        expected = 'spiele-umsonst.de##.left > div.right[style$="~third-partyx;"]';
        expect(actual[0]).not.toBe(expected);

        actual = convertRulesToAdgSyntax(['example.com#$#.adsbygoogle { height: 1px!important; }']);
        expected = 'example.com#$#.adsbygoogle { height: third-partyx!important; }';
        expect(actual[0]).not.toBe(expected);
    });

    it('scriptlets converter is working', () => {
        let actual = convertScriptletToAdg('example.com#@#+js(nano-setInterval-booster.js, some.example, 1000)');
        let expected = "example.com#@%#//scriptlet('ubo-nano-setInterval-booster.js', 'some.example', '1000')";
        expect(actual[0]).toBe(expected);

        actual = convertAdgToUbo('example.org#%#//scriptlet("ubo-abort-on-property-read.js", "alert")');
        expected = 'example.org##+js(abort-on-property-read, alert)';
        expect(actual).toBe(expected);

        actual = convertAdgToUbo('example.org#%#//scriptlet("abort-on-property-write", "adblock.check")');
        expected = 'example.org##+js(abort-on-property-write, adblock.check)';
        expect(actual).toBe(expected);

        actual = convertAdgToUbo("example.org#%#//scriptlet('set-constant', 'dataLayer', 'emptyArr')");
        expected = 'example.org##+js(set-constant, dataLayer, [])';
        expect(actual).toBe(expected);

        actual = convertAdgToUbo("example.org#%#//scriptlet('set-constant', 'dataLayer', 'emptyObj')");
        expected = 'example.org##+js(set-constant, dataLayer, {})';
        expect(actual).toBe(expected);

        actual = convertAbpToAdg('test.com#$#abort-on-property-read adsShown');
        expected = "test.com#%#//scriptlet('abp-abort-on-property-read', 'adsShown')";
        expect(actual[0]).toBe(expected);

        actual = convertScriptletToAdg('example.com#@#+js(nano-setInterval-booster.js, some.example, 1000)');
        expected = "example.com#@%#//scriptlet('ubo-nano-setInterval-booster.js', 'some.example', '1000')";
        expect(actual[0]).toBe(expected);

        actual = convertScriptletToAdg('test.com#$#abort-on-property-read adsShown');
        expected = "test.com#%#//scriptlet('abp-abort-on-property-read', 'adsShown')";
        expect(actual[0]).toBe(expected);

        actual = convertScriptletToAdg('test.com##+js(abort-current-inline-script, $, popup)');
        expected = "test.com#%#//scriptlet('ubo-abort-current-inline-script', '$', 'popup')";
        expect(actual[0]).toBe(expected);

        // multiple selectors for remove-attr/class
        actual = convertScriptletToAdg('example.com##+js(ra, href, area[href*="example1.org/"]\\, area[href*="example2.org/"]\\, area[href*="example3.org/"])');
        expected = "example.com#%#//scriptlet('ubo-ra', 'href', 'area[href*=\"example1.org/\"], area[href*=\"example2.org/\"], area[href*=\"example3.org/\"]')";
        expect(actual[0]).toBe(expected);

        // https://github.com/AdguardTeam/Scriptlets/issues/194
        actual = convertScriptletToAdg('example.org##+js(rc, cookie--not-set, , stay)');
        expected = "example.org#%#//scriptlet('ubo-rc', 'cookie--not-set', '', 'stay')";
        expect(actual[0]).toBe(expected);

        actual = convertScriptletToAdg('example.org##+js(rc, .locked, body\\, html, stay)');
        expected = "example.org#%#//scriptlet('ubo-rc', '.locked', 'body, html', 'stay')";
        expect(actual[0]).toBe(expected);

        actual = convertScriptletToAdg('example.org##+js(nobab)');
        expected = "example.org#%#//scriptlet('ubo-nobab')";
        expect(actual[0]).toBe(expected);

        actual = convertScriptletToAdg('example.org#$#hide-if-has-and-matches-style \'d[id^="_"]\' \'div > s\' \'display: none\'; hide-if-contains /.*/ .p \'a[href^="/ad__c?"]\'');
        expected = [
            'example.org#%#//scriptlet(\'abp-hide-if-has-and-matches-style\', \'d[id^="_"]\', \'div > s\', \'display: none\')',
            'example.org#%#//scriptlet(\'abp-hide-if-contains\', \'/.*/\', \'.p\', \'a[href^="/ad__c?"]\')',
        ];
        expect(actual).toEqual(expected);
    });

    it('converts UBO scriptlet to Adguard scriptlet', () => {
        let actual = convertRulesToAdgSyntax(['test.com##+js(abort-current-inline-script.js, Math.random, adbDetect)']);
        let expected = "test.com#%#//scriptlet('ubo-abort-current-inline-script.js', 'Math.random', 'adbDetect')";
        expect(actual[0]).toBe(expected);

        actual = convertRulesToAdgSyntax(['example.com##+js(disable-newtab-links.js)']);
        expected = "example.com#%#//scriptlet('ubo-disable-newtab-links.js')";
        expect(actual[0]).toBe(expected);

        actual = convertRulesToAdgSyntax(['example.com##+js(addEventListener-defuser, load, onload)']);
        expected = "example.com#%#//scriptlet('ubo-addEventListener-defuser', 'load', 'onload')";
        expect(actual[0]).toBe(expected);

        actual = convertRulesToAdgSyntax(['example.com#@#+js(nano-setInterval-booster.js, some.example, 1000)']);
        expected = "example.com#@%#//scriptlet('ubo-nano-setInterval-booster.js', 'some.example', '1000')";
        expect(actual[0]).toBe(expected);

        actual = convertRulesToAdgSyntax(['test.com##script:inject(json-prune.js)']);
        expected = "test.com#%#//scriptlet('ubo-json-prune.js')";
        expect(actual[0]).toBe(expected);

        actual = convertRulesToAdgSyntax(['test.com#@#script:inject(abort-on-property-read.js, some.prop)']);
        expected = "test.com#@%#//scriptlet('ubo-abort-on-property-read.js', 'some.prop')";
        expect(actual[0]).toBe(expected);

        actual = convertRulesToAdgSyntax(['example.org##+js(set-cookie, notice_preferences, 1)']);
        expected = "example.org#%#//scriptlet('ubo-set-cookie', 'notice_preferences', '1')";
        expect(actual[0]).toBe(expected);

        // https://github.com/AdguardTeam/FiltersCompiler/issues/205
        actual = convertRulesToAdgSyntax(['example.org##+js(set-local-storage-item, counter, $remove$)']);
        expected = "example.org#%#//scriptlet('ubo-set-local-storage-item', 'counter', '$remove$')";
        expect(actual[0]).toBe(expected);
    });

    it('converts ABP scriptlets to Adguard scriptlet', () => {
        let actual = convertRulesToAdgSyntax(['test.com#$#abort-on-property-read adsShown']);
        let expected = "test.com#%#//scriptlet('abp-abort-on-property-read', 'adsShown')";
        expect(actual[0]).toBe(expected);

        actual = convertRulesToAdgSyntax(['example.com#$#abort-current-inline-script console.log Hello']);
        expected = "example.com#%#//scriptlet('abp-abort-current-inline-script', 'console.log', 'Hello')";
        expect(actual[0]).toBe(expected);

        actual = convertRulesToAdgSyntax(['example.com#@$#abort-on-property-write adblock.check']);
        expected = "example.com#@%#//scriptlet('abp-abort-on-property-write', 'adblock.check')";
        expect(actual[0]).toBe(expected);
    });

    it('works if multiple abp scriptlets are converted properly', () => {
        const actual = convertRulesToAdgSyntax(["example.org#$#json-prune ad 'vinfo'; abort-on-property-write aoipwb"]);

        expect(actual).toHaveLength(2);
        expect(actual).toContain("example.org#%#//scriptlet('abp-json-prune', 'ad', 'vinfo')");
        expect(actual).toContain("example.org#%#//scriptlet('abp-abort-on-property-write', 'aoipwb')");
    });

    it('converts ghide to generichide and ehide to elemhide conversion', () => {
        let actual = convertRulesToAdgSyntax(['||example.com^$ghide']);
        let expected = '||example.com^$generichide';
        expect(actual[0]).toBe(expected);

        actual = convertRulesToAdgSyntax(['@@||ghider.com^$ghide']);
        expected = '@@||ghider.com^$generichide';
        expect(actual[0]).toBe(expected);

        actual = convertRulesToAdgSyntax(['||test.com^$ehide']);
        expected = '||test.com^$elemhide';
        expect(actual[0]).toBe(expected);

        actual = convertRulesToAdgSyntax(['@@||ghide.ehide.com^$ehide']);
        expected = '@@||ghide.ehide.com^$elemhide';
        expect(actual[0]).toBe(expected);

        actual = convertRulesToAdgSyntax(['||ghide.com/ghide^$elemhide']);
        expected = '||ghide.com/ghide^$elemhide';
        expect(actual[0]).toBe(expected);

        actual = convertRulesToAdgSyntax(['||ehide.com/ehide^$generichide']);
        expected = '||ehide.com/ehide^$generichide';
        expect(actual[0]).toBe(expected);

        actual = convertRulesToAdgSyntax(['||ehide.com/ehide^$domain=ehide.com,ehide']);
        expected = '||ehide.com/ehide^$domain=ehide.com,elemhide';
        expect(actual[0]).toBe(expected);

        actual = convertRulesToAdgSyntax(['||ghide.com/ehide^$domain=ghide.com,ghide']);
        expected = '||ghide.com/ehide^$domain=ghide.com,generichide';
        expect(actual[0]).toBe(expected);
    });

    describe('converts redirects', () => {
        it('converts redirects', () => {
            let actual = convertRulesToAdgSyntax(['||example.com/banner$image,redirect=1x1.gif']);
            let expected = '||example.com/banner$image,redirect=1x1-transparent.gif';
            expect(actual[0]).toBe(expected);

            actual = convertRulesToAdgSyntax(['||example.com^$script,rewrite=abp-resource:blank-js']);
            expected = '||example.com^$script,redirect=noopjs';
            expect(actual[0]).toBe(expected);

            actual = convertRulesToAdgSyntax(['||googletagservices.com/test.js$domain=test.com,redirect=googletagservices_gpt.js']);
            expected = '||googletagservices.com/test.js$domain=test.com,redirect=googletagservices-gpt';
            expect(actual[0]).toBe(expected);

            actual = convertRulesToAdgSyntax(['||delivery.tf1.fr/pub$media,rewrite=abp-resource:blank-mp3,domain=tf1.fr']);
            expected = '||delivery.tf1.fr/pub$media,redirect=noopmp3-0.1s,domain=tf1.fr';
            expect(actual[0]).toBe(expected);

            actual = convertRulesToAdgSyntax(['/blockadblock.$script,redirect=nobab.js']);
            expected = '/blockadblock.$script,redirect=prevent-bab';
            expect(actual[0]).toBe(expected);

            // https://github.com/AdguardTeam/FiltersCompiler/issues/167
            actual = convertRulesToAdgSyntax(['||imasdk.googleapis.com/js/sdkloader/ima3.js$script,important,redirect=google-ima.js,domain=example.com']);
            expected = '||imasdk.googleapis.com/js/sdkloader/ima3.js$script,important,redirect=google-ima3,domain=example.com';
            expect(actual[0]).toBe(expected);

            actual = convertToUbo(['/blockadblock.$script,redirect=prevent-bab']);
            expected = '/blockadblock.$script,redirect=nobab.js';
            expect(actual[0]).toBe(expected);

            // https://github.com/AdguardTeam/Scriptlets/issues/127
            actual = convertToUbo(['||googletagmanager.com/gtm.js$script,redirect=googletagmanager-gtm,domain=example.com']);
            expected = '||googletagmanager.com/gtm.js$script,redirect=google-analytics_analytics.js,domain=example.com';
            expect(actual[0]).toBe(expected);

            // media type for 'empty' redirect
            actual = convertToUbo(['||example.org^$media,redirect=empty']);
            expected = '||example.org^$media,redirect=empty';
            expect(actual[0]).toBe(expected);

            // https://github.com/AdguardTeam/FiltersCompiler/issues/255#issuecomment-3007994870
            actual = convertToUbo(['||wcs.naver.com^$~script,redirect=nooptext,domain=smartstore.naver.com']);
            expected = '||wcs.naver.com^$~script,redirect=noop.txt,domain=smartstore.naver.com';
            expect(actual[0]).toBe(expected);

            // no source type is allowed for 'empty' redirect
            actual = convertToUbo(['||example.org^$redirect=empty']);
            expected = '||example.org^$redirect=empty';
            expect(actual[0]).toBe(expected);

            actual = convertToUbo(['||example.com/banner$image,redirect=32x32-transparent.png']);
            expected = '||example.com/banner$image,redirect=32x32.png';
            expect(actual[0]).toBe(expected);

            actual = convertToUbo(['||example.com^$script,redirect=noopjs']);
            expected = '||example.com^$script,redirect=noop.js';
            expect(actual[0]).toBe(expected);

            actual = convertToUbo(['||example.com/banner$image,redirect=1x1-transparent.gif']);
            expected = '||example.com/banner$image,redirect=1x1.gif';
            expect(actual[0]).toBe(expected);

            // add missed source types
            // noopmp3-0.1s:
            actual = convertToUbo(['||*/ad/$redirect=noopmp3-0.1s,domain=huaren.tv']);
            expected = '||*/ad/$redirect=noop-0.1s.mp3,domain=huaren.tv,media';
            expect(actual[0]).toBe(expected);
            // noopjs:
            actual = convertToUbo(['||example.com^$redirect=noopjs']);
            expected = '||example.com^$redirect=noop.js,script';
            expect(actual[0]).toBe(expected);
            // noopjson
            actual = convertToUbo(['||example.com^$xmlhttprequest,redirect=noopjson']);
            expected = '||example.com^$xhr,redirect=noop.json';
            expect(actual[0]).toBe(expected);
            // nooptext:
            actual = convertToUbo(['||ad.example.com^$redirect=nooptext,important']);
            expected = '||ad.example.com^$redirect=noop.txt,important,image,media,subdocument,stylesheet,script,xhr,other';
            expect(actual[0]).toBe(expected);

            actual = convertToUbo(['||example.com/ad/vmap/*$xmlhttprequest,redirect=noopvast-2.0']);
            expected = '||example.com/ad/vmap/*$xhr,redirect=noopvast-2.0';
            expect(actual[0]).toBe(expected);

            actual = convertToUbo(['']);
            expected = '';
            expect(actual[0]).toBe(expected);

            actual = convertToUbo(['', undefined]);
            expect(actual).toHaveLength(2);

            // AdGuard does not support UBO's $redirect priority and skips it during the conversion
            // https://github.com/AdguardTeam/tsurlfilter/issues/59
            // ADG -> UBO:
            actual = convertToUbo(['||example.com^$script,redirect=noopjs:99']);
            expected = '||example.com^$script,redirect=noop.js';
            expect(actual[0]).toBe(expected);

            // UBO -> ADG:
            actual = convertRulesToAdgSyntax(['||example.com^$redirect=noop.js:99']);
            expected = '||example.com^$redirect=noopjs';
            expect(actual[0]).toBe(expected);
        });

        it('does not add unnecessary symbols while converting redirects', () => {
            const actual = convertRulesToAdgSyntax(['intermarche.pl#%#document.cookie = "interapp_redirect=false; path=/;";']);
            expect(actual[0]).toBe('intermarche.pl#%#document.cookie = "interapp_redirect=false; path=/;";');
        });
    });

    it('converts :remove() rules', () => {
        let actual = convertRulesToAdgSyntax(['ekoteka.pl###popUpModal:remove()']);
        let expected = 'ekoteka.pl#$?##popUpModal { remove: true; }';
        expect(actual[0]).toBe(expected);

        actual = convertRulesToAdgSyntax(['aftonbladet.se##.jwplayer:has(.svp-sponsor-label):remove()']);
        expected = 'aftonbladet.se#$?#.jwplayer:has(.svp-sponsor-label) { remove: true; }';
        expect(actual[0]).toBe(expected);

        actual = convertRulesToAdgSyntax(['bmw-motorrad.pl##.cookielayer:remove()']);
        expected = 'bmw-motorrad.pl#$?#.cookielayer { remove: true; }';
        expect(actual[0]).toBe(expected);

        actual = convertRulesToAdgSyntax(['besplatka.ua,forumodua.com##body > div:not([id]):not([class]):not([style]):empty:remove()']);
        expected = 'besplatka.ua,forumodua.com#$?#body > div:not([id]):not([class]):not([style]):empty { remove: true; }';
        expect(actual[0]).toBe(expected);
    });

    it('does not convert rules with $all modifier', () => {
        const rule = '||example.org^$all';
        const actual = convertRulesToAdgSyntax([rule]);
        expect(actual).toHaveLength(1);
        expect(actual[0]).toBe(rule);
    });

    describe('Pseudo elements with one colon', () => {
        it('converts hiding :before', () => {
            const rule = 'hotline.ua##.reset-scroll:before';
            const result = convertRulesToAdgSyntax([rule]);
            expect(result).toHaveLength(1);
            expect(result[0]).toBe('hotline.ua##.reset-scroll::before');
        });

        it('does not add redundant colons', () => {
            const rule = 'hotline.ua##.reset-scroll::before';
            expect(convertRulesToAdgSyntax([rule])[0]).toBe(rule);
        });

        it('converts cosmetic :after', () => {
            const rule = 'militaria.pl#$##layout-wrapper:after { height:0!important }';
            const result = convertRulesToAdgSyntax([rule]);
            expect(result).toHaveLength(1);
            expect(result[0]).toBe('militaria.pl#$##layout-wrapper::after { height:0!important }');
        });

        it('does not convert mess pseudos with scriptlets', () => {
            let rule;
            let result;
            const excluded = [];

            rule = 'example.org#$#selector:style()';
            result = convertRulesToAdgSyntax([rule], excluded);
            expect(result).toHaveLength(0);
            expect(excluded).toHaveLength(2);
            expect(excluded).toEqual(
                [
                    "! Error: Unable to convert rule to AdGuard syntax: \"example.org#$#selector:style()\" due to error: 'AdblockPlus' syntax cannot be mixed with 'UblockOrigin' syntax",
                    'example.org#$#selector:style()',
                ],
            );

            rule = 'yamareco.com#$#body.header_bg_ad.modal-open:style(padding-right: auto !important;overflow: auto!important)';
            excluded.length = 0;
            result = convertRulesToAdgSyntax([rule], excluded);
            expect(result).toHaveLength(0);
            expect(excluded).toHaveLength(2);
            expect(excluded).toEqual(
                [
                    "! Error: Unable to convert rule to AdGuard syntax: \"yamareco.com#$#body.header_bg_ad.modal-open:style(padding-right: auto !important;overflow: auto!important)\" due to error: 'AdblockPlus' syntax cannot be mixed with 'UblockOrigin' syntax",
                    'yamareco.com#$#body.header_bg_ad.modal-open:style(padding-right: auto !important;overflow: auto!important)',
                ],
            );
        });
    });

    describe('converts cosmetic rule modifiers to UBlock syntax', () => {
        const rules = [
            {
                source: 'example.org##body[style^="position: fixed"] { position: static !important; }',
                expected: 'example.org##body[style^="position: fixed"]:style(position: static !important;)',
            },
            {
                source: '[$path=/page]example.com##p',
                expected: 'example.com##:matches-path(/page) p',
            },
            {
                source: '[$path=/page]example.com#@#p',
                expected: 'example.com#@#:matches-path(/page) p',
            },
            {
                source: String.raw`[$path=/\\/(sub1|sub2)\\/page\\.html/]example.com##p`,
                expected: String.raw`example.com##:matches-path(/\\\\/(sub1|sub2)\\\\/page\\\\.html/) p`,
            },
            {
                source: '[$path=/sexykpopidol]blog.livedoor.jp###containerWrap > #container > .blog-title-outer + #content.hfeed',
                expected: 'blog.livedoor.jp##:matches-path(/sexykpopidol) #containerWrap > #container > .blog-title-outer + #content.hfeed',
            },
            {
                source: String.raw`[$path=/\/\[a|b|\,\]\/page\.html/]example.com## #test`,
                expected: String.raw`example.com##:matches-path(/\\/\\\[a|b|\\\,\\\]\\/page\\.html/) #test`,
            },
            // https://github.com/AdguardTeam/FiltersCompiler/issues/255#issuecomment-3007994870
            {
                source: String.raw`[$path]fontanka.ru##.gridContainer > div[class^="grid"]:has(> div[class] > div.flickity-enabled)`,
                expected: String.raw`fontanka.ru##:matches-path(/^/$/) .gridContainer > div[class^="grid"]:has(> div[class] > div.flickity-enabled)`,
            },
            {
                source: String.raw`[$path=/\/[0-9A-Z_a-z]+\/status\/\d+/]x.com,twitter.com###layers[style="z-index: 1;"]:has(div[role="dialog"] a[href="/i/premium_sign_up"][style])`,
                expected: String.raw`x.com,twitter.com##:matches-path(/\\/\[0-9A-Z_a-z\]+\\/status\\/\\d+/) #layers[style="z-index: 1;"]:has(div[role="dialog"] a[href="/i/premium_sign_up"][style])`,
            },
            {
                source: '[$domain=/example.(com\\|org)/]##.banner',
                expected: '/example.(com\\|org)/##.banner',
            },
            {
                source: '[$domain=/example.(com\\|org)/]##.banner',
                expected: '/example.(com\\|org)/##.banner',
            },
            {
                source: '[$domain=/example.(com\\|org)/|foo.com]##.banner',
                expected: '/example.(com\\|org)/,foo.com##.banner',
            },
            {
                source: '[$domain=/example.(com\\|org)/|foo.com]#@#.banner',
                expected: '/example.(com\\|org)/,foo.com#@#.banner',
            },
            // [$url=....] modifier
            {
                source: '[$url=||example.com/content/*]##div.textad',
                expected: '/^(http|https|ws|wss)://([a-z0-9-_.]+\\.)?example\\.com\\/content\\/.*/##div.textad',
            },
            {
                source: '[$url=|example.org]#@#h1',
                expected: '/^example\\.org/#@#h1',
            },
            {
                source: '[$url=|example.org]#@#h1',
                expected: '/^example\\.org/#@#h1',
            },
            {
                source: '[$url=|example.org|]#@#h1',
                expected: '/^example\\.org$/#@#h1',
            },
        ];

        it.each(rules)('converts path modifier to UBlock syntax', (rule) => {
            const res = convertToUbo([rule.source]);
            expect(res[0]).toBe(rule.expected);
        });
    });

    it('converts scriptlet rule with modifiers to UBlock syntax', () => {
        const source = String.raw`[$path=/page,domain=example.com|~example.org]#%#//scriptlet('ubo-setTimeout-defuser.js', '[native code]', '8000')`;
        const rulesList = convertToUbo([source]);
        // because uBO scriptlet injection rules do not support cosmetic rule modifiers
        expect(rulesList).toHaveLength(0);
    });
});
