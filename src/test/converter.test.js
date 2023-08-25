/* eslint-disable max-len */
const scriptlets = require('@adguard/scriptlets');

const converter = require('../main/converter');

// Mock log to hide error messages
jest.mock('../main/utils/log');

describe('converter', () => {
    it('converts rules', () => {
        let c = converter.convertRulesToAdgSyntax(['example.com']);
        expect(c[0]).toBe('example.com');

        c = converter.convertRulesToAdgSyntax(['example.com##h1:style(background-color: blue !important)']);
        expect(c[0]).toBe('example.com#$#h1 { background-color: blue !important }');

        c = converter.convertRulesToAdgSyntax(['example.com#@#h1:style(background-color: blue !important)']);
        expect(c[0]).toBe('example.com#@$#h1 { background-color: blue !important }');

        c = converter.convertRulesToAdgSyntax(['yourconroenews.com#@##siteNav:style(transform: none !important;)']);
        expect(c[0]).toBe('yourconroenews.com#@$##siteNav { transform: none !important; }');

        c = converter.convertRulesToAdgSyntax(['apkmirror.com##body .google-ad-leaderboard-smaller:style(position: absolute!important; left: -4000px!important; display:block!important;)']);
        expect(c[0]).toBe('apkmirror.com#$#body .google-ad-leaderboard-smaller { position: absolute!important; left: -4000px!important; display:block!important; }');

        c = converter.convertRulesToAdgSyntax(['apkmirror.com##body .google-ad-square-sidebar:style(position: absolute!important; left: -4000px!important; display:block!important;)']);
        expect(c[0]).toBe('apkmirror.com#$#body .google-ad-square-sidebar { position: absolute!important; left: -4000px!important; display:block!important; }');

        c = converter.convertRulesToAdgSyntax(['benchmark.pl###bannerDBB:style(height: 10px !important;)']);
        expect(c[0]).toBe('benchmark.pl#$##bannerDBB { height: 10px !important; }');

        // https://github.com/AdguardTeam/FiltersCompiler/issues/24
        c = converter.convertRulesToAdgSyntax(['720hd.club#?##all:style(margin-top: 0 !important)']);
        expect(c[0]).toBe('720hd.club#$?##all { margin-top: 0 !important }');

        c = converter.convertRulesToAdgSyntax(['720hd.club#@?##all:style(margin-top: 0 !important)']);
        expect(c[0]).toBe('720hd.club#@$?##all { margin-top: 0 !important }');

        // https://github.com/AdguardTeam/FiltersCompiler/issues/54
        c = converter.convertRulesToAdgSyntax(['#####']);
        expect(c[0]).toBe('! #####');

        c = converter.convertRulesToAdgSyntax(['# ubo syntax comment']);
        expect(c[0]).toBe('! # ubo syntax comment');

        c = converter.convertRulesToAdgSyntax(['##selector']);
        expect(c[0]).toBe('##selector');

        c = converter.convertRulesToAdgSyntax(['']);
        expect(c[0]).toEqual('');
    });

    it('converts network rule modifiers', () => {
        // escaped comma in regexp modifier value should remain escaped after the conversion
        let c = converter.convertRulesToAdgSyntax([String.raw`||example.org^$hls=/^__s=[A-Za-z0-9]{6\,}/`]);
        expect(c[0]).toBe(String.raw`||example.org^$hls=/^__s=[A-Za-z0-9]{6\,}/`);

        c = converter.convertRulesToAdgSyntax([String.raw`||example.org/*/*/$jsonprune=\\$..[ac\\, ab]`]);
        expect(c[0]).toBe(String.raw`||example.org/*/*/$jsonprune=\\$..[ac\\, ab]`);

        c = converter.convertRulesToAdgSyntax([String.raw`||example.org/*/*/$removeparam=/^__s=[A-Za-z0-9]{6\,}/`]);
        expect(c[0]).toBe(String.raw`||example.org/*/*/$removeparam=/^__s=[A-Za-z0-9]{6\,}/`);

        c = converter.convertRulesToAdgSyntax([String.raw`||example.org/*/*/$replace=/<item type=\"banner\">.{280\,400}.*<\/background><\/item>//`]);
        expect(c[0]).toBe(String.raw`||example.org/*/*/$replace=/<item type=\"banner\">.{280\,400}.*<\/background><\/item>//`);
    });

    it('keeps cosmetic rule as is', () => {
        const source = 'ferra.ru##div[data-render-state] + div[class^="jsx-"][class$=" undefined"]';
        const expected = source;

        const c = converter.convertRulesToAdgSyntax([source]);
        expect(c).toEqual([expected]);
    });

    it('keeps cosmetic JS rule as is', () => {
        const source = 'example.org#%#var str = /[class$=" undefined"]/; console.log(str);';
        const expected = source;

        const c = converter.convertRulesToAdgSyntax([source]);
        expect(c).toEqual([expected]);
    });

    it('collects logs for converted rules', () => {
        const rule = 'example.com##h1:style(background-color: blue !important)';
        const excluded = [];
        const c = converter.convertRulesToAdgSyntax([rule], excluded);
        const expectedConvertedRule = 'example.com#$#h1 { background-color: blue !important }';
        expect(c[0]).toBe(expectedConvertedRule);
        expect(excluded[0]).toBe(`! Rule "${rule}" converted to: "${[...[expectedConvertedRule]]}"`);
    });

    it('converts first-party replaced by ~third-party', () => {
        let actual = converter.convertRulesToAdgSyntax(['||www.ynet.co.il^$important,websocket,first-party']);
        let expected = '||www.ynet.co.il^$important,websocket,~third-party';
        expect(actual[0]).toBe(expected);

        actual = converter.convertRulesToAdgSyntax(['||zive.cz^*+$script,first-party']);
        expected = '||zive.cz^*+$script,~third-party';
        expect(actual[0]).toBe(expected);

        actual = converter.convertRulesToAdgSyntax(['||zive.cz^*+$script,first-party']);
        expected = '||zive.cz^*+$script,~third-party';
        expect(actual[0]).toBe(expected);

        actual = converter.convertRulesToAdgSyntax(['||zive.cz^*+$first-party,script']);
        expected = '||zive.cz^*+$~third-party,script';
        expect(actual[0]).toBe(expected);

        actual = converter.convertRulesToAdgSyntax(['||zive.cz^*+$first-party']);
        expected = '||zive.cz^*+$~third-party';
        expect(actual[0]).toBe(expected);

        actual = converter.convertRulesToAdgSyntax(['||www.ynet.co.il^$important,websocket,first-party', '||zive.cz^*+$script,first-party']);
        expected = ['||www.ynet.co.il^$important,websocket,~third-party', '||zive.cz^*+$script,~third-party'];
        expect(actual[0]).toBe(expected[0]);
        expect(actual[1]).toBe(expected[1]);
    });

    it('converts options replacement', () => {
        let actual = converter.convertRulesToAdgSyntax(['||www.ynet.co.il^$xhr,websocket']);
        let expected = '||www.ynet.co.il^$xmlhttprequest,websocket';
        expect(actual[0]).toBe(expected);

        actual = converter.convertRulesToAdgSyntax(['||zive.cz^*+$script,xhr']);
        expected = '||zive.cz^*+$script,xmlhttprequest';
        expect(actual[0]).toBe(expected);

        actual = converter.convertRulesToAdgSyntax(['||zive.cz^*+$script,css']);
        expected = '||zive.cz^*+$script,stylesheet';
        expect(actual[0]).toBe(expected);

        actual = converter.convertRulesToAdgSyntax(['||zive.cz^*+$css,script']);
        expected = '||zive.cz^*+$stylesheet,script';
        expect(actual[0]).toBe(expected);

        // does not converts "css" substrings outside of options
        const rule = 'csoonline.com,csswizardry.com##.ad';
        actual = converter.convertRulesToAdgSyntax([rule]);
        expect(actual[0]).toBe(rule);

        actual = converter.convertRulesToAdgSyntax(['||zive.cz^*+$frame']);
        expected = '||zive.cz^*+$subdocument';
        expect(actual[0]).toBe(expected);

        actual = converter.convertRulesToAdgSyntax(['||zive.cz^*+$xhr,frame']);
        expected = '||zive.cz^*+$xmlhttprequest,subdocument';
        expect(actual[0]).toBe(expected);
    });

    it('converts scriptlets to UBlock syntax', () => {
        // scriptlet with one argument
        let actual = converter.convertAdgScriptletsToUbo(['example.org#%#//scriptlet("abort-on-property-read", "alert")']);
        let expected = 'example.org##+js(abort-on-property-read, alert)';
        expect(actual[0]).toBe(expected);

        // scriptlet with ubo-compatible name
        actual = converter.convertAdgScriptletsToUbo(['example.org#%#//scriptlet("ubo-abort-on-property-read.js", "alert")']);
        expected = 'example.org##+js(abort-on-property-read, alert)';
        expect(actual[0]).toBe(expected);

        // scriptlet with two arguments
        actual = converter.convertAdgScriptletsToUbo(["example.org#%#//scriptlet('set-constant', 'firstConst', 'false')"]);
        expected = 'example.org##+js(set-constant, firstConst, false)';
        expect(actual[0]).toBe(expected);

        // scriptlet without arguments and few domains
        actual = converter.convertAdgScriptletsToUbo(["example1.org,example2.com,some-domain.dom#%#//scriptlet('prevent-adfly')"]);
        expected = 'example1.org,example2.com,some-domain.dom##+js(adfly-defuser)';
        expect(actual[0]).toBe(expected);

        // scriptlet argument includes quotes
        actual = converter.convertAdgScriptletsToUbo(["example.org#%#//scriptlet('set-constant', 'constName', 'value\"12345\"')"]);
        expected = 'example.org##+js(set-constant, constName, value"12345")';
        expect(actual[0]).toBe(expected);

        // set-constant with empty string arg
        actual = converter.convertAdgScriptletsToUbo(["example.org#%#//scriptlet('set-constant', 'arg.name', '')"]);
        expected = 'example.org##+js(set-constant, arg.name, \'\')';
        expect(actual[0]).toBe(expected);

        // multiple selectors for remove-attr/class
        actual = converter.convertAdgScriptletsToUbo(['example.org#%#//scriptlet(\'remove-class\', \'promo\', \'a.class, div#id, div > #ad > .test\')']);
        expected = 'example.org##+js(remove-class, promo, a.class\\, div#id\\, div > #ad > .test)';
        expect(actual[0]).toBe(expected);

        actual = converter.convertAdgScriptletsToUbo(['']);
        expected = '';
        expect(actual[0]).toBe(expected);

        actual = converter.convertAdgScriptletsToUbo(undefined);
        expected = [];
        expect(actual).toEqual(expected);

        actual = converter.convertAdgScriptletsToUbo([String.raw`example.com#%#//scriptlet('adjust-setInterval', ',dataType:_', '1000', '0.02')`]);
        expected = [String.raw`example.com##+js(nano-setInterval-booster, \,dataType:_, 1000, 0.02)`];
        expect(actual).toEqual(expected);

        actual = converter.convertAdgScriptletsToUbo(["example.org#%#//scriptlet('set-session-storage-item', 'acceptCookies', 'false')"]);
        expected = 'example.org##+js(set-session-storage-item, acceptCookies, false)';
        expect(actual[0]).toBe(expected);
    });

    it('converts ##^script:has-text to $$script[tag-contains]', () => {
        let actual = converter.convertRulesToAdgSyntax(['example.com##^script:has-text(12313)']);
        let expected = 'example.com$$script[tag-content="12313"][max-length="262144"]';
        expect(actual[0]).toBe(expected);

        actual = converter.convertRulesToAdgSyntax(['example.com##^script:contains(banner)']);
        expected = 'example.com$$script[tag-content="banner"][max-length="262144"]';
        expect(actual[0]).toBe(expected);

        /**
         * regexp as tag-content arg is not supported by AdGuard HTML filtering rules
         * https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#tag-content
         *
         * so such rules should be discarded
         * https://github.com/AdguardTeam/tsurlfilter/issues/55
         */
        actual = converter.convertRulesToAdgSyntax(['example.com##^script:contains(/.+banner/)']);
        expect(actual[0]).toBe(undefined);

        actual = converter.convertRulesToAdgSyntax(['example.com##^script:has-text(/\.advert/)']);
        expect(actual[0]).toBe(undefined);
    });

    it('converts $1p to $~third-party and $3p to $third-party', () => {
        let actual = converter.convertRulesToAdgSyntax(['||www.ynet.co.il^$important,websocket,1p,domain=www.ynet.co.il']);
        let expected = '||www.ynet.co.il^$important,websocket,~third-party,domain=www.ynet.co.il';
        expect(actual[0]).toBe(expected);

        actual = converter.convertRulesToAdgSyntax(['*$image,redirect-rule=1x1.gif,domain=seznamzpravy.cz']);
        expected = '*$image,redirect-rule=1x1-transparent.gif,domain=seznamzpravy.cz';
        expect(actual[0]).toBe(expected);

        actual = converter.convertRulesToAdgSyntax(['||20il.co.il^$important,websocket,1p']);
        expected = '||20il.co.il^$important,websocket,~third-party';
        expect(actual[0]).toBe(expected);

        actual = converter.convertRulesToAdgSyntax(['||vidads.gr^$3p']);
        expected = '||vidads.gr^$third-party';
        expect(actual[0]).toBe(expected);

        actual = converter.convertRulesToAdgSyntax(['@@.com/ads.js|$3p,domain=~3ppt.com']);
        expected = '@@.com/ads.js|$third-party,domain=~3ppt.com';
        expect(actual[0]).toBe(expected);

        actual = converter.convertRulesToAdgSyntax(['@@.com/ads.js|$~third-party,domain=~3ppt.com']);
        expected = '@@.com/ads.js|$~third-party,domain=~third-partypt.com';
        expect(actual[0]).not.toBe(expected);

        actual = converter.convertRulesToAdgSyntax(['spiele-umsonst.de##.left > div.right[style$="1px;"]']);
        expected = 'spiele-umsonst.de##.left > div.right[style$="~third-partyx;"]';
        expect(actual[0]).not.toBe(expected);

        actual = converter.convertRulesToAdgSyntax(['realadmin.ru#$#.adsbygoogle { height: 1px!important; }']);
        expected = 'realadmin.ru#$#.adsbygoogle { height: third-partyx!important; }';
        expect(actual[0]).not.toBe(expected);
    });

    it('scriptlets converter is working', () => {
        let actual = scriptlets.convertUboToAdg('example.com#@#+js(nano-setInterval-booster.js, some.example, 1000)');
        let expected = "example.com#@%#//scriptlet('ubo-nano-setInterval-booster.js', 'some.example', '1000')";
        expect(actual[0]).toBe(expected);

        actual = scriptlets.convertAdgToUbo('example.org#%#//scriptlet("ubo-abort-on-property-read.js", "alert")');
        expected = 'example.org##+js(abort-on-property-read, alert)';
        expect(actual).toBe(expected);

        actual = scriptlets.convertAdgToUbo('example.org#%#//scriptlet("abort-on-property-write", "adblock.check")');
        expected = 'example.org##+js(abort-on-property-write, adblock.check)';
        expect(actual).toBe(expected);

        actual = scriptlets.convertAdgToUbo("example.org#%#//scriptlet('set-constant', 'dataLayer', 'emptyArr')");
        expected = 'example.org##+js(set-constant, dataLayer, [])';
        expect(actual).toBe(expected);

        actual = scriptlets.convertAdgToUbo("example.org#%#//scriptlet('set-constant', 'dataLayer', 'emptyObj')");
        expected = 'example.org##+js(set-constant, dataLayer, {})';
        expect(actual).toBe(expected);

        actual = scriptlets.convertAbpToAdg('test.com#$#abort-on-property-read adsShown');
        expected = "test.com#%#//scriptlet('abp-abort-on-property-read', 'adsShown')";
        expect(actual[0]).toBe(expected);

        actual = scriptlets.convertScriptletToAdg('example.com#@#+js(nano-setInterval-booster.js, some.example, 1000)');
        expected = "example.com#@%#//scriptlet('ubo-nano-setInterval-booster.js', 'some.example', '1000')";
        expect(actual[0]).toBe(expected);

        actual = scriptlets.convertScriptletToAdg('test.com#$#abort-on-property-read adsShown');
        expected = "test.com#%#//scriptlet('abp-abort-on-property-read', 'adsShown')";
        expect(actual[0]).toBe(expected);

        actual = scriptlets.convertScriptletToAdg('test.com##+js(abort-current-inline-script, $, popup)');
        expected = "test.com#%#//scriptlet('ubo-abort-current-inline-script.js', '$', 'popup')";
        expect(actual[0]).toBe(expected);

        // multiple selectors for remove-attr/class
        actual = scriptlets.convertScriptletToAdg('ubisoft.com##+js(ra, href, area[href*="discordapp.com/"]\\, area[href*="facebook.com/"]\\, area[href*="instagram.com/"])');
        expected = "ubisoft.com#%#//scriptlet('ubo-ra.js', 'href', 'area[href*=\"discordapp.com/\"], area[href*=\"facebook.com/\"], area[href*=\"instagram.com/\"]')";
        expect(actual[0]).toBe(expected);

        // https://github.com/AdguardTeam/Scriptlets/issues/194
        actual = scriptlets.convertScriptletToAdg('example.org##+js(rc, cookie--not-set, , stay)');
        expected = "example.org#%#//scriptlet('ubo-rc.js', 'cookie--not-set', '', 'stay')";
        expect(actual[0]).toBe(expected);

        actual = scriptlets.convertScriptletToAdg('memo-book.pl##+js(rc, .locked, body\\, html, stay)');
        expected = "memo-book.pl#%#//scriptlet('ubo-rc.js', '.locked', 'body, html', 'stay')";
        expect(actual[0]).toBe(expected);

        actual = scriptlets.convertScriptletToAdg('example.org#$#hide-if-has-and-matches-style \'d[id^="_"]\' \'div > s\' \'display: none\'; hide-if-contains /.*/ .p \'a[href^="/ad__c?"]\'');
        expected = [
            'example.org#%#//scriptlet(\'abp-hide-if-has-and-matches-style\', \'d[id^="_"]\', \'div > s\', \'display: none\')',
            'example.org#%#//scriptlet(\'abp-hide-if-contains\', \'/.*/\', \'.p\', \'a[href^="/ad__c?"]\')',
        ];
        expect(actual).toEqual(expected);
    });

    it('converts UBO scriptlet to Adguard scriptlet', () => {
        let actual = converter.convertRulesToAdgSyntax(['test.com##+js(abort-current-inline-script.js, Math.random, adbDetect)']);
        let expected = "test.com#%#//scriptlet('ubo-abort-current-inline-script.js', 'Math.random', 'adbDetect')";
        expect(actual[0]).toBe(expected);

        actual = converter.convertRulesToAdgSyntax(['example.com##+js(disable-newtab-links.js)']);
        expected = "example.com#%#//scriptlet('ubo-disable-newtab-links.js')";
        expect(actual[0]).toBe(expected);

        actual = converter.convertRulesToAdgSyntax(['example.com##+js(addEventListener-defuser, load, onload)']);
        expected = "example.com#%#//scriptlet('ubo-addEventListener-defuser.js', 'load', 'onload')";
        expect(actual[0]).toBe(expected);

        actual = converter.convertRulesToAdgSyntax(['example.com#@#+js(nano-setInterval-booster.js, some.example, 1000)']);
        expected = "example.com#@%#//scriptlet('ubo-nano-setInterval-booster.js', 'some.example', '1000')";
        expect(actual[0]).toBe(expected);

        actual = converter.convertRulesToAdgSyntax(['test.com##script:inject(json-prune.js)']);
        expected = "test.com#%#//scriptlet('ubo-json-prune.js')";
        expect(actual[0]).toBe(expected);

        actual = converter.convertRulesToAdgSyntax(['test.com#@#script:inject(abort-on-property-read.js, some.prop)']);
        expected = "test.com#@%#//scriptlet('ubo-abort-on-property-read.js', 'some.prop')";
        expect(actual[0]).toBe(expected);

        actual = converter.convertRulesToAdgSyntax(['example.org##+js(set-cookie, notice_preferences, 1)']);
        expected = "example.org#%#//scriptlet('ubo-set-cookie.js', 'notice_preferences', '1')";
        expect(actual[0]).toBe(expected);
    });

    it('converts ABP scriptlets to Adguard scriptlet', () => {
        let actual = converter.convertRulesToAdgSyntax(['test.com#$#abort-on-property-read adsShown']);
        let expected = "test.com#%#//scriptlet('abp-abort-on-property-read', 'adsShown')";
        expect(actual[0]).toBe(expected);

        actual = converter.convertRulesToAdgSyntax(['example.com#$#abort-current-inline-script console.log Hello']);
        expected = "example.com#%#//scriptlet('abp-abort-current-inline-script', 'console.log', 'Hello')";
        expect(actual[0]).toBe(expected);

        actual = converter.convertRulesToAdgSyntax(['example.com#@$#abort-on-property-write adblock.check']);
        expected = "example.com#@%#//scriptlet('abp-abort-on-property-write', 'adblock.check')";
        expect(actual[0]).toBe(expected);
    });

    it('works if multiple abp scriptlets are converted properly', () => {
        const actual = converter.convertRulesToAdgSyntax(["example.org#$#json-prune ad 'vinfo'; abort-on-property-write aoipwb"]);

        expect(actual).toHaveLength(2);
        expect(actual).toContain("example.org#%#//scriptlet('abp-json-prune', 'ad', 'vinfo')");
        expect(actual).toContain("example.org#%#//scriptlet('abp-abort-on-property-write', 'aoipwb')");
    });

    it('converts ghide to generichide and ehide to elemhide conversion', () => {
        let actual = converter.convertRulesToAdgSyntax(['||example.com^$ghide']);
        let expected = '||example.com^$generichide';
        expect(actual[0]).toBe(expected);

        actual = converter.convertRulesToAdgSyntax(['@@||ghider.com^$ghide']);
        expected = '@@||ghider.com^$generichide';
        expect(actual[0]).toBe(expected);

        actual = converter.convertRulesToAdgSyntax(['||test.com^$ehide']);
        expected = '||test.com^$elemhide';
        expect(actual[0]).toBe(expected);

        actual = converter.convertRulesToAdgSyntax(['@@||ghide.ehide.ru^$ehide']);
        expected = '@@||ghide.ehide.ru^$elemhide';
        expect(actual[0]).toBe(expected);

        actual = converter.convertRulesToAdgSyntax(['||ghide.com/ghide^$elemhide']);
        expected = '||ghide.com/ghide^$elemhide';
        expect(actual[0]).toBe(expected);

        actual = converter.convertRulesToAdgSyntax(['||ehide.com/ehide^$generichide']);
        expected = '||ehide.com/ehide^$generichide';
        expect(actual[0]).toBe(expected);

        actual = converter.convertRulesToAdgSyntax(['||ehide.com/ehide^$domain=ehide.com,ehide']);
        expected = '||ehide.com/ehide^$domain=ehide.com,elemhide';
        expect(actual[0]).toBe(expected);

        actual = converter.convertRulesToAdgSyntax(['||ghide.com/ehide^$domain=ghide.com,ghide']);
        expected = '||ghide.com/ehide^$domain=ghide.com,generichide';
        expect(actual[0]).toBe(expected);
    });

    describe('converts redirects', () => {
        it('converts redirects', () => {
            let actual = converter.convertRulesToAdgSyntax(['||example.com/banner$image,redirect=1x1.gif']);
            let expected = '||example.com/banner$image,redirect=1x1-transparent.gif';
            expect(actual[0]).toBe(expected);

            actual = converter.convertRulesToAdgSyntax(['||example.com^$script,rewrite=abp-resource:blank-js']);
            expected = '||example.com^$script,redirect=noopjs';
            expect(actual[0]).toBe(expected);

            actual = converter.convertRulesToAdgSyntax(['||googletagservices.com/test.js$domain=test.com,redirect=googletagservices_gpt.js']);
            expected = '||googletagservices.com/test.js$domain=test.com,redirect=googletagservices-gpt';
            expect(actual[0]).toBe(expected);

            actual = converter.convertRulesToAdgSyntax(['||delivery.tf1.fr/pub$media,rewrite=abp-resource:blank-mp3,domain=tf1.fr']);
            expected = '||delivery.tf1.fr/pub$media,redirect=noopmp3-0.1s,domain=tf1.fr';
            expect(actual[0]).toBe(expected);

            actual = converter.convertRulesToAdgSyntax(['/blockadblock.$script,redirect=nobab.js']);
            expected = '/blockadblock.$script,redirect=prevent-bab';
            expect(actual[0]).toBe(expected);

            // https://github.com/AdguardTeam/FiltersCompiler/issues/167
            actual = converter.convertRulesToAdgSyntax(['||imasdk.googleapis.com/js/sdkloader/ima3.js$script,important,redirect=google-ima.js,domain=example.com']);
            expected = '||imasdk.googleapis.com/js/sdkloader/ima3.js$script,important,redirect=google-ima3,domain=example.com';
            expect(actual[0]).toBe(expected);

            actual = converter.convertAdgRedirectsToUbo(['/blockadblock.$script,redirect=prevent-bab']);
            expected = '/blockadblock.$script,redirect=nobab.js';
            expect(actual[0]).toBe(expected);

            // https://github.com/AdguardTeam/Scriptlets/issues/127
            actual = converter.convertAdgRedirectsToUbo(['||googletagmanager.com/gtm.js$script,redirect=googletagmanager-gtm,domain=morningstar.nl']);
            expected = '||googletagmanager.com/gtm.js$script,redirect=googletagmanager_gtm.js,domain=morningstar.nl';
            expect(actual[0]).toBe(expected);

            // media type for 'empty' redirect
            actual = converter.convertAdgRedirectsToUbo(['||example.org^$media,redirect=empty']);
            expected = '||example.org^$media,redirect=empty';
            expect(actual[0]).toBe(expected);

            // no source type is allowed for 'empty' redirect
            actual = converter.convertAdgRedirectsToUbo(['||example.org^$redirect=empty']);
            expected = '||example.org^$redirect=empty';
            expect(actual[0]).toBe(expected);

            actual = converter.convertAdgRedirectsToUbo(['||example.com/banner$image,redirect=32x32-transparent.png']);
            expected = '||example.com/banner$image,redirect=32x32.png';
            expect(actual[0]).toBe(expected);

            actual = converter.convertAdgRedirectsToUbo(['||example.com^$script,redirect=noopjs']);
            expected = '||example.com^$script,redirect=noop.js';
            expect(actual[0]).toBe(expected);

            actual = converter.convertAdgRedirectsToUbo(['||example.com/banner$image,redirect=1x1-transparent.gif']);
            expected = '||example.com/banner$image,redirect=1x1.gif';
            expect(actual[0]).toBe(expected);

            // add missed source types
            // noopmp3-0.1s:
            actual = converter.convertAdgRedirectsToUbo(['||*/ad/$redirect=noopmp3-0.1s,domain=huaren.tv']);
            expected = '||*/ad/$redirect=noop-0.1s.mp3,domain=huaren.tv,media';
            expect(actual[0]).toBe(expected);
            // noopjs:
            actual = converter.convertAdgRedirectsToUbo(['||example.com^$redirect=noopjs']);
            expected = '||example.com^$redirect=noop.js,script';
            expect(actual[0]).toBe(expected);
            // nooptext:
            actual = converter.convertAdgRedirectsToUbo(['||ad.example.com^$redirect=nooptext,important']);
            expected = '||ad.example.com^$redirect=noop.txt,important,image,media,subdocument,stylesheet,script,xmlhttprequest,other';
            expect(actual[0]).toBe(expected);

            actual = converter.convertAdgRedirectsToUbo(['||example.com/ad/vmap/*$xmlhttprequest,redirect=noopvast-2.0']);
            expected = [];
            expect(actual).toEqual(expected);

            actual = converter.convertAdgRedirectsToUbo(['']);
            expected = '';
            expect(actual[0]).toBe(expected);

            actual = converter.convertAdgRedirectsToUbo(['', undefined]);
            expect(actual).toHaveLength(2);

            // AdGuard does not support UBO's $redirect priority and skips it during the conversion
            // https://github.com/AdguardTeam/tsurlfilter/issues/59
            // ADG -> UBO:
            actual = converter.convertAdgRedirectsToUbo(['||example.com^$script,redirect=noopjs:99']);
            expected = '||example.com^$script,redirect=noop.js';
            expect(actual[0]).toBe(expected);

            // UBO -> ADG:
            actual = converter.convertRulesToAdgSyntax(['||example.com^$redirect=noop.js:99']);
            expected = '||example.com^$redirect=noopjs';
            expect(actual[0]).toBe(expected);
        });

        it('does not add unnecessary symbols while converting redirects', () => {
            const actual = converter.convertRulesToAdgSyntax(['intermarche.pl#%#document.cookie = "interapp_redirect=false; path=/;";']);
            expect(actual[0]).toBe('intermarche.pl#%#document.cookie = "interapp_redirect=false; path=/;";');
        });
    });

    it('converts :remove() rules', () => {
        let actual = converter.convertRulesToAdgSyntax(['ekoteka.pl###popUpModal:remove()']);
        let expected = 'ekoteka.pl#$?##popUpModal { remove: true; }';
        expect(actual[0]).toBe(expected);

        actual = converter.convertRulesToAdgSyntax(['aftonbladet.se##.jwplayer:has(.svp-sponsor-label):remove()']);
        expected = 'aftonbladet.se#$?#.jwplayer:has(.svp-sponsor-label) { remove: true; }';
        expect(actual[0]).toBe(expected);

        actual = converter.convertRulesToAdgSyntax(['bmw-motorrad.pl##.cookielayer:remove()']);
        expected = 'bmw-motorrad.pl#$?#.cookielayer { remove: true; }';
        expect(actual[0]).toBe(expected);

        actual = converter.convertRulesToAdgSyntax(['besplatka.ua,forumodua.com##body > div:not([id]):not([class]):not([style]):empty:remove()']);
        expected = 'besplatka.ua,forumodua.com#$?#body > div:not([id]):not([class]):not([style]):empty { remove: true; }';
        expect(actual[0]).toBe(expected);
    });

    it('does not convert rules with $all modifier', () => {
        const rule = '||example.org^$all';
        const actual = converter.convertRulesToAdgSyntax([rule]);
        expect(actual).toHaveLength(1);
        expect(actual[0]).toBe(rule);
    });

    describe('Pseudo elements with one colon', () => {
        it('converts hiding :before', () => {
            const rule = 'hotline.ua##.reset-scroll:before';
            const result = converter.convertRulesToAdgSyntax([rule]);
            expect(result).toHaveLength(1);
            expect(result[0]).toBe('hotline.ua##.reset-scroll::before');
        });

        it('does not add redundant colons', () => {
            const rule = 'hotline.ua##.reset-scroll::before';
            expect(converter.convertRulesToAdgSyntax([rule])[0]).toBe(rule);
        });

        it('converts cosmetic :after', () => {
            const rule = 'militaria.pl#$##layout-wrapper:after { height:0!important }';
            const result = converter.convertRulesToAdgSyntax([rule]);
            expect(result).toHaveLength(1);
            expect(result[0]).toBe('militaria.pl#$##layout-wrapper::after { height:0!important }');
        });

        it('does not convert mess pseudos with scriptlets', () => {
            let rule = 'example.org#$#selector:style()';
            let result = converter.convertRulesToAdgSyntax([rule]);
            expect(result).toHaveLength(1);
            expect(result).toContain(rule);

            rule = 'yamareco.com#$#body.header_bg_ad.modal-open:style(padding-right: auto !important;overflow: auto!important)';
            result = converter.convertRulesToAdgSyntax([rule]);
            expect(result).toHaveLength(1);
            expect(result).toContain(rule);
        });
    });

    it('converts cosmetic rule modifiers to UBlock syntax', () => {
        const rules = [
            {
                source: '[$path=/page]ya.ru##p',
                expected: 'ya.ru##:matches-path(/page)p',
            },
            {
                source: '[$path=/page]ya.ru#@#p',
                expected: 'ya.ru#@#:matches-path(/page)p',
            },
            {
                source: String.raw`[$path=/\\/(sub1|sub2)\\/page\\.html/]ya.ru##p`,
                expected: String.raw`ya.ru##:matches-path(/\/(sub1|sub2)\/page\.html/)p`,
            },
            {
                source: '[$path=/sexykpopidol]blog.livedoor.jp###containerWrap > #container > .blog-title-outer + #content.hfeed',
                expected: 'blog.livedoor.jp##:matches-path(/sexykpopidol)#containerWrap > #container > .blog-title-outer + #content.hfeed',
            },
            {
                source: String.raw`[$path=/\\/\[a|b|\,\]\\/page\\.html/]exapmle.com## #test`,
                expected: String.raw`exapmle.com##:matches-path(/\/[a|b|,]\/page\.html/)#test`,
            },
        ];

        rules.forEach((rule) => {
            const res = converter.convertAdgPathModifierToUbo([rule.source]);

            expect({ source: rule.source, expected: res[0] }).toEqual(rule);
        });
    });

    it('converts scriplet rule  with modifiers to UBlock syntax', () => {
        const source = String.raw`[$path=/page,domain=example.com|~example.org]#%#//scriptlet('ubo-setTimeout-defuser.js', '[native code]', '8000')`;

        let rulesList = converter.convertAdgPathModifierToUbo([source]);
        rulesList = converter.convertAdgScriptletsToUbo(rulesList);

        expect(rulesList).toHaveLength(0);
    });
});
