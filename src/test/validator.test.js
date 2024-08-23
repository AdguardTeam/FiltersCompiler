/**
 * @jest-environment jsdom
 */

const { TextEncoder, TextDecoder } = require('util');

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

/* eslint-disable max-len */
const scriptlets = require('@adguard/scriptlets');
const { setConfiguration, CompatibilityTypes } = require('@adguard/tsurlfilter');

const validator = require('../main/validator');

// Sets configuration compatibility
setConfiguration({ compatibility: CompatibilityTypes.Corelibs });

// Mock log to hide error messages
jest.mock('../main/utils/log');

describe('validator', () => {
    describe('validate standard css selectors', () => {
        const validSelectors = [
            '.div',
            '#div-id',
            '[class|=ad]',
            'div[class^="textLink"i]',
            '[style*="border-bottom: none;"]',
            '[style^="background-color: rgb(24, 28, 31);"]',
            '[data-bind="visible: showCookieWarning"]',
            '.ProgressBar-container, .bx-align, .pico-content, .pico-overlay, [style*="z-index: 100000000;"]',
            '[onclick^="window.open (\'https://example.com/share?url="]',
            '[id^="jsgg"],[style^="height: 90px;"],.ad_text,#ysdiv',
            '[style="min-height: 260px;"]:has([id^="adocean"])',
            '[style*="border-radius: 3px; margin-bottom: 20px; width: 160px;"]:-abp-has([target="_blank"])',
            // eslint-disable-next-line no-tabs
            'div[style^=" margin-right: auto; margin-left: auto;	text-align: left; padding-top: 0px;	padding-bottom: 10px;"]',
            '.todaystripe::after',
            '.fixed-header.affix .main-menu-container::after, .main-nav .menu-item:first-child',
            '.video-holder > .video-options::after',
            'div[class^="sc-"]::before',
            // native Document.querySelectorAll does not throws error on this selector so we consider it as valid
            '.video-holder > .video-options ::after',
            // should be valid but there is an issue with `nwsapi` which is used in `jsdom`
            // which is used in ExtendedCss to validate selectors
            // https://github.com/dperini/nwsapi/issues/34
            // TODO: check later is it fixed
            // 'a[href^="/watch?v="][onclick^="return test.onEvent(arguments[0]||window.event,\'"]',
            // escaped colon at start of attribute name
            'div[\\:data-service-slot][data-ac]',
            '#main-container > div[\\:class^="$test.ad.RenderedDesktop"]',
            'div[class\\"ads-article\\"]',
            "[class\\'ads-article\\']",
            // TODO: delete this comment later.
            // considered as invalid by nwsapi until the bugs are fixed
            // but they should be valid
            // https://github.com/dperini/nwsapi/issues/55:
            'div:not(div > span)',
            'div:not(h1 + p)',
            // TODO: delete this comment later.
            // https://github.com/dperini/nwsapi/issues/71:
            '.i_con + :not(.i_con):not([href="javascript:void(0);"])',
            '.share--content button:not([onclick="window.print();"])',
            '.sns > a[href^="javascript:openSendNews"]:not([href="javascript:openSendNews(\'url\');"])',
            '.social > nav > ul > li > a[href="javascript:;"][onclick^="Share"]:not([onclick="Share(\'P\');"])',
            // `*:not(<arg>)` with standard selector `arg`
            'html:not([style]) tbody > tr[align="left"]',
            '.banner:has(~ .right_bx, ~ div[class^="aside"])',
        ];
        test.each(validSelectors)('%s', (selector) => {
            const rules = [`example.com##${selector}`];
            expect(validator.validate(rules)).toHaveLength(1);
        });

        const invalidSelectors = [
            'a[href^=/], .container:has(nav) > a[href]:lt($var)',
            '%',
            '.4wNET',
            '.\].slidein.\[.box',
            'div[class"ads-article"]',
            'img[height="60"][width"468"]',
            'table[style*=border: 0px"]',
            // `*:not(<arg>)` with extended selector `arg`
            // not valid due to top DOM node limitation
            // https://github.com/AdguardTeam/ExtendedCss/#extended-css-not-limitations
            'html:not(:has(span))',
        ];
        test.each(invalidSelectors)('%s', (selector) => {
            const rules = [`example.com##${selector}`];
            expect(validator.validate(rules)).toHaveLength(0);
        });

        // valid rules - element hiding selectors without quotes
        const validNoQuotesSelectors = [
            '##div[class*=smart-banner i]:not(.smart-banner-visible)',
            '##div[class*=smartbanner i]',
            '##div[id*=smart-banner i]',
            '##div[id*=smartbanner i]',
        ];
        test.each(validNoQuotesSelectors)('%s', (selector) => {
            const rules = [`example.com##${selector}`];
            expect(validator.validate(rules)).toHaveLength(1);
        });
    });

    it('validate incorrect rules', () => {
        const rules = [
            '||example.com##.div',
            'test$domain=yandex.com,google.com',
            ',example.com,example.org##[src*="base64"]',
        ];
        expect(validator.validate(rules)).toHaveLength(0);
    });

    describe('validate extended-css', () => {
        const validExtCssSelectors = [
            '#main > table.w3-table-all.notranslate:first-child > tbody > tr:nth-child(17) > td.notranslate:nth-child(2)',
            "#body div[attr='test']:first-child  div",
            '.todaystripe:matches-css(display: block)',
            'body > *:not(div):not(script):matches-css(width:336px)',
            'div[class*=" "]:matches-css(background-image: /^url\(data:image/png;base64,iVBOR/)',
            'div[class*=" "]:matches-css(background-image: /^url\\(https:\\/\\/sport\\.wp\\.pl\\//)',
            '#welcomeMainBanner_welcomeMain div[id*="_containerWrap_"]:has(img[src$="Banner/ad.jpg"]):remove()',
            '.todaystripe:matches-css-before(display: block)',
            '.todaystripe:matches-css-after(display: block)',
            '.todaystripe:has(.banner)',
            '.todaystripe:contains(test)',
            '.l-main.js-main div.c-block:has(div.c-header:contains(Реклама))',
            '.l-main.js-main div.c-block:has(> div.c-header)',
            "[-ext-has='script:contains(var banner)']",
        ];
        test.each(validExtCssSelectors)('%s', (selector) => {
            const rules = [`example.com##${selector}`];
            expect(validator.validate(rules)).toHaveLength(1);
        });

        const invalidExtCssSelectors = [
            "[-ext-has='script:inject(var banner)']",
            '.modals.dimmer > .gdpr.visible:upward(1):watch-attr([class])',
            'div[class^="sc-"]:::before',
        ];
        test.each(invalidExtCssSelectors)('%s', (selector) => {
            const rules = [`example.com##${selector}`];
            expect(validator.validate(rules)).toHaveLength(0);
        });

        it('validate abp-contains pseudo class', () => {
            const rules = ['kostrzyn.pl#?#.aktperbox:-abp-contains(Rozmaitości) > div:-abp-has(div)'];
            expect(validator.validate(rules)).toHaveLength(1);
        });

        it('xpath selectors', () => {
            const rules = [
                'parenting.pl##:xpath(//div[count(*)=1][*[count(*)=1]/*[count(*)=1]/*[count(*)=1]/*[count(*)=0]])',
                'stooq.pl,stooq.com##:xpath(//*[@align="center"]/*[@id][contains(text(),"REKLAMA")])',
                '~www.wp.pl,wp.pl##:xpath(//div[count(*)=3][img[@class][@src]][*[count(*)=1]/*[count(*)=1]/*[count(*)=1]/*[count(*)=1]/*[count(*)=0]])',
                'airbnb.com##:xpath(.//*[@data-hypernova-key="p3sticky_navigationbundlejs"])',
                'elka.pl,miedziowe.pl##:xpath(//*[@align="center"][contains(text(), \'reklama\')])',
                'google.com##:xpath(.//*[@id=\'gbw\']/div/div/div[2]//div[3][@aria-label="promo"])',
                'quora.com##:xpath(.//*[@class="fixed_footer_gradient"])',
                'www.wp.pl##:xpath(//div[@data-st-area=\'Zakupy\'][count(*)=2][not(header)])',
                'www.dobreprogramy.pl##:xpath(//div[contains(text(), \'REKLAMA\')])',
            ];
            expect(validator.validate(rules)).toHaveLength(rules.length);
        });
    });

    describe('validate extended-css selectors - complicated cases', () => {
        describe('valid selectors', () => {
            const validSelectors = [
                '.container .col-xs-12 .col-xs-12 > .yellow:not(:nth-child(3))',
                '.media-actions-list > li:not(:nth-child(3)):not(:nth-child(4))',
                '.snlikebt > ul > li:not(:nth-child(4)):not(:nth-child(5))',
                '.detail-share-item > a:not([href*="window.print()"])',
                '.share-link-popup__menu > div.menu__group:last-child > div.menu__item:not(:last-child):not(:nth-child(3))',
                '#sidebar > .sidebarborder:not(:nth-child(3))',
                'div:has-text(/test-xpath-content/):xpath(../../..)',
                'div:xpath(//*[@class="test-xpath-class"])',
                'div.test-nth-ancestor-marker:nth-ancestor(4)',
                // rule with $
                '.feed__item:-abp-has(*:-abp-contains(/^реклама$/i))',
            ];
            test.each(validSelectors)('%s', (selector) => {
                const rules = [`example.com##${selector}`];
                expect(validator.validate(rules)).toHaveLength(1);
            });

            it('multiple rules - valid', () => {
                const rules = [
                    'example.com#$##header-floating\ navbar { position: absolute !important; }',
                    'example.com#$##site-header\ 1 > .site-header-main { height: 167.3px !important; }',
                    'example.com#$#.pmc-u-background-white.\/\/.header__bar { position: relative !important; transform: translateY(0) !important; }',
                    'example.com#$#.o-sticky_header\@tp- { position: relative !important; }',
                    'example.com#$##atomic .Mt\(headerHeight\) { margin-top: 22px !important; }',
                    'example.com#$##\#novella-header { position: relative !important; top: 0 !important; }',
                ];
                expect(validator.validate(rules)).toHaveLength(rules.length);
            });
        });

        describe('invalid selectors', () => {
            const invalidPseudoClassArgSelectors = [
                'div:xpath(../../..):has-text(/test-xpath-content/)',
                'div:nth-ancestor(999)',
                'div:xpath()',
            ];
            test.each(invalidPseudoClassArgSelectors)('%s', (selector) => {
                const rules = [`example.com##${selector}`];
                expect(validator.validate(rules)).toHaveLength(0);
            });

            const unknownPseudoClassSelectors = [
                '[-ext-has=test]:matches(.banner)',
                '[-ext-has=test]:matches(.banner), .todaystripe:contains(test)',
            ];
            test.each(unknownPseudoClassSelectors)('%s', (selector) => {
                const rules = [`example.com##${selector}`];
                expect(validator.validate(rules)).toHaveLength(0);
            });

            it('multiple rules - invalid', () => {
                const rules = [
                    "example.com#$##atomic .Mt\(headerHeight\) { margin-top: \\'22px\\' !important; }",
                    "example.com#$##header-floating\ navbar { font-family: \\'Blogger\\'; }",
                ];
                expect(validator.validate(rules)).toHaveLength(0);
            });
        });
    });

    describe('validate html filtering rules', () => {
        const validRules = [
            '~example.com,google.com$$div[id=\"ad_text\"][wildcard=\"*teasernet*tararar*\"]',
            '~example.com,google.com$$div[id=\"ad_text\"][tag-content=\"teas\"\"ernet\"][max-length=\"500\"][min-length=\"50\"][wildcard=\"*.adriver.*\"][parent-search-level=\"15\"][parent-elements=\"td,table\"]',
            '~example.com,google.com$$div[id=\"ad_text\"][max-length=\"500000\"][min-length=\"50\"]',
        ];
        test.each(validRules)('%s', (rule) => {
            expect(validator.validate([rule])).toHaveLength(1);
        });
    });

    it('validate stealth modifier - allowed only for exception rules', () => {
        let rules;

        rules = ['||example.com/code/bshow.php$stealth'];
        expect(validator.validate(rules)).toHaveLength(0);

        rules = ['@@||example.com/code/bshow.php$stealth'];
        expect(validator.validate(rules)).toHaveLength(1);
    });

    describe('Test validation - various rules', () => {
        describe('valid - check one by one', () => {
            const validRules = [
                '||onedrive.su/code/bshow.php$empty,important,~websocket',
                '||4ksport.pl^$all',
                '||onedrive.su/code/bshow.php$cookie=cookie_name',
                'samdan.com.tr,esquire.com.tr##div[data-mbzone="Textlink" i] > div#id_d_textlink',
                "example.com##div[class^='textLink' i]",
                '||delivery.tf1.fr/pub$media,rewrite=abp-resource:blank-mp3,domain=tf1.fr',
            ];
            test.each(validRules)('%s', (rule) => {
                expect(validator.validate([rule])).toHaveLength(1);
            });
        });

        it('multiple valid rules', () => {
            const rules = [
                'example.com#?#section:has(div[class^="textLink" i])',
                '##img[alt*="example.org" i]',
                '##img[alt*="QQ998" i]',
                '##[href*="35.200.169.1" i] > img',
                'aszdziennik.pl##a[href*="/aszdziennik" i] > img[src^="/static/media/"]',
            ];
            expect(validator.validate(rules)).toHaveLength(rules.length);
        });

        it('multiple valid rules', () => {
            let rules;

            rules = [
                'example.com##div[class name="textLink" i]',
                'example.com##div[class^="textLink" "textColor" i]',
            ];
            expect(validator.validate(rules)).toHaveLength(0);

            rules = [
                '||delivery.tf1.fr/pub$media,rewrite=resource:blank-mp3,domain=tf1.fr',
                '||delivery.tf1.fr/pub$media,rewrite,domain=tf1.fr',
            ];
            expect(validator.validate(rules)).toHaveLength(0);

            rules = [
                't',
                'tt',
                'ads',
                '##q',
                '||q',
            ];
            expect(validator.validate(rules)).toHaveLength(0);
        });
    });

    it('extreme cases', () => {
        // for array with one empty string the same array is returned
        expect(validator.validate([''])).toStrictEqual(['']);

        // empty array is returned if `undefined` is validated
        expect(validator.validate(undefined)).toStrictEqual([]);
    });

    it('validate redirect option', () => {
        const validRedirect1 = '||onedrive.su/code/bshow.php$redirect=nooptext';
        const validRedirect2 = '||onedrive.su/code/bshow.php$important,redirect=nooptext';
        const validImportant3 = '||onedrive.su/code/bshow.php$important';
        // error in redirect title
        const invalidRedirect4 = '||onedrive.su/code/bshow.php$redirect=nooptxt';
        // empty redirect modifier
        const invalidRedirect5 = '||onedrive.su/code/bshow.php$redirect';
        // empty redirect modifier but in exception rule
        const validRedirect6 = '@@||example.com^$redirect';

        const validRules = [
            validRedirect1,
            validRedirect2,
            validImportant3,
            validRedirect6,
        ];
        const invalidRules = [
            invalidRedirect4,
            invalidRedirect5,
        ];
        const rules = [
            ...validRules,
            ...invalidRules,
        ];

        const validateRules = validator.validate(rules);
        expect(validateRules).toContain(validRedirect1);
        expect(validateRules).toContain(validRedirect2);
        expect(validateRules).toContain(validImportant3);
        expect(validateRules).not.toContain(invalidRedirect4);
        expect(validateRules).not.toContain(invalidRedirect5);
        expect(validateRules).toContain(validRedirect6);
        expect(validator.validate(rules)).toHaveLength(validRules.length);
    });

    describe('Test validation - incorrect domain option', () => {
        const invalidRules = [
            '|http*$domain=',
            '|http*$~domain=|example.org',
            '|http*$script,domain=|example.org',
        ];
        test.each(invalidRules)('%s', (rule) => {
            expect(validator.validate([rule])).toHaveLength(0);
        });
    });

    describe('Test validation - cosmetic css rules', () => {
        describe('single rules - valid', () => {
            const validRules = [
                'example.com#$#body { background: black; }',
                'example.com#$#body[style*="background-image: url()"] { margin-top: 45px !important; }',
            ];
            test.each(validRules)('%s', (rule) => {
                expect(validator.validate([rule])).toHaveLength(1);
            });
        });

        it('multiple valid rules', () => {
            const rules = [
                'example.com#$#body.reset-scroll:before { z-index: -9999!important; display: none!important; }',
                'example.com##body.reset-scroll::before',
                'example.com##body.reset-scroll::after',
            ];
            expect(validator.validate(rules)).toHaveLength(rules.length);
        });

        describe('single rules - invalid', () => {
            const validRules = [
                'example.com#$#body { background: url("https://some.jpg"); }',
                'example.com#$#body { background: \\75 rl("https://some.jpg"); }',
                'example.com#$#body[style*="background-image: url(\'https://some.jpg\')"] { background: url() !important; }',
            ];
            test.each(validRules)('%s', (rule) => {
                expect(validator.validate([rule])).toHaveLength(0);
            });
        });
    });

    it('Test ##^script:has-text and $$script[tag-contains] rules', () => {
        let rules;

        rules = ['example.com##^script:contains(/.+banner/)'];
        expect(validator.validate(rules)).toHaveLength(0);

        rules = ['example.com##^script:has-text(/\.advert/)'];
        expect(validator.validate(rules)).toHaveLength(0);
    });

    it('Test scriptlets lib validator', () => {
        let result;

        result = scriptlets.isValidScriptletName('abort-on-property-read');
        expect(result).toBeTruthy();

        result = scriptlets.isValidScriptletName('abort-on--property-read');
        expect(result).toBeFalsy();

        result = scriptlets.isValidScriptletRule('test.com#%#//scriptlet("ubo-abort-current-inline-script.js", "Math.random", "adbDetect")');
        expect(result).toBeTruthy();

        result = scriptlets.isUboScriptletRule('example.com#@#+js(nano-setInterval-booster.js, some.example, 1000)');
        expect(result).toBeTruthy();

        result = scriptlets.isUboScriptletRule('test.com##script:inject(json-prune.js)');
        expect(result).toBeTruthy();

        result = scriptlets.isUboScriptletRule('test.com#%#//scriptlet(\'ubo-json-prune.js\')');
        expect(result).toBeFalsy();

        result = scriptlets.isAdgScriptletRule('test.com#%#//scriptlet(\'ubo-json-prune.js\')');
        expect(result).toBeTruthy();

        result = scriptlets.isAdgScriptletRule('test.com#%#//scriptlet("abort-on-property-read", "some.prop")');
        expect(result).toBeTruthy();

        result = scriptlets.isAdgScriptletRule('arctic.de#%#//scriptlet(\'set-cookie-reload\', \'cookie-preference\', \'1\')');
        expect(result).toBeTruthy();

        result = scriptlets.isAdgScriptletRule('test.com#@#script:inject(abort-on-property-read.js, some.prop)');
        expect(result).toBeFalsy();

        result = scriptlets.isAbpSnippetRule('example.com#@$#abort-on-property-write adblock.check');
        expect(result).toBeTruthy();

        result = scriptlets.isAbpSnippetRule('test.com#@#script:inject(abort-on-property-read.js, some.prop)');
        expect(result).toBeFalsy();
    });

    describe('validate scriptlet rules', () => {
        describe('valid', () => {
            const validRules = [
                'test.com#%#//scriptlet("ubo-abort-current-inline-script.js", "Math.random", "adbDetect")',
                'example.com#@%#//scriptlet("ubo-disable-newtab-links.js")',
                'example.com#%#//scriptlet("abp-abort-current-inline-script", "console.log", "Hello")',
                'example.com#@%#//scriptlet("abort-on-property-write", "adblock.check")',
                'example.com#%#//scriptlet(\'abort-on-property-read\', \'ads.prop\')',
                'example.com#%#//scriptlet("prevent-adfly")',
                'example.com#@%#//scriptlet("ubo-nano-setInterval-booster", "some.example", "1000")',
                "arctic.de#%#//scriptlet('set-cookie-reload', 'cookie-preference', '1')",
                "example.org#%#//scriptlet('trusted-prune-inbound-object', 'Object.getOwnPropertyNames', 'example')",
                "example.org#%#//scriptlet('trusted-dispatch-event', 'click')",
            ];
            test.each(validRules)('%s', (rule) => {
                expect(validator.validate([rule])).toHaveLength(1);
            });
        });

        describe('invalid', () => {
            const invalidRules = [
                'test.com#%#//scriptlet("ubo-abort-current-inline-scripts.js", "Math.random", "adbDetect")',
                'example.com#%#//scriptlet("abp-abort-current-inline-script ", "console.log", "Hello")',
                'example.com#@%#//scriptlet("abort-on--property-write", "adblock.check")',
                'test.com#%#//scriptlet(abort-current-inline-script", "Math.random", "adbDetect")',
                'example.com#@%#//scriptlet("ubo-nano-setInterval-booster.js, "some.example", "1000")',
                'example.com#%#//scriptlet("abp-abort-current-inline-script", console.log", "Hello")',
            ];
            test.each(invalidRules)('%s', (rule) => {
                expect(validator.validate([rule])).toHaveLength(0);
            });
        });
    });

    describe('validate redirect rules', () => {
        describe('valid', () => {
            const validRules = [
                '||delivery.tf1.fr/pub$media,redirect=noopmp3-0.1s,domain=tf1.fr',
                '||example.com/banner$image,redirect=32x32-transparent.png',
                '||example.com/*.mp4$media,redirect=noopmp4-1s',
                '||googletagservices.com/test.js$domain=test.com,redirect=googletagservices-gpt',
                '||podu.me/ads/audio/*.mp3$redirect=noopmp3-0.1s',
                '||podu.me/ads/audio/*.mp3$media,redirect=noopmp3-0.1s',
                '||example.com^$redirect=noopjson',
            ];
            test.each(validRules)('%s', (rule) => {
                expect(validator.validate([rule])).toHaveLength(1);
            });
        });

        describe('invalid', () => {
            const invalidRules = [
                '||example.com^$script,redirect=noopjs.js',
                '||example.com/banner$image,redirect=3x3.png',
                '||example.com/*.mp4$media,redirect=noopmp4_1s',
            ];
            test.each(invalidRules)('%s', (rule) => {
                expect(validator.validate([rule])).toHaveLength(0);
            });
        });

        it('Test redirects by the lib methods', () => {
            const { redirects } = scriptlets;

            let rule = '||example.com^$script,redirect=noopjs.js';
            expect(redirects.isValidAdgRedirectRule(rule)).toBeFalsy();

            rule = '||example.com^$script,redirect=noopjs';
            expect(redirects.isValidAdgRedirectRule(rule)).toBeTruthy();

            rule = '||example.com^$script,redirects=noopjs';
            expect(redirects.isValidAdgRedirectRule(rule)).toBeFalsy();

            rule = '||example.com&redirects=noopjs^$script';
            expect(redirects.isValidAdgRedirectRule(rule)).toBeFalsy();

            rule = '||example.com/banner$image,redirect=32x32transparent.png';
            expect(redirects.isAdgRedirectRule(rule)).toBeTruthy();

            rule = '||example.com/banner$image,redirect=32x32transparent.png';
            expect(redirects.isValidAdgRedirectRule(rule)).toBeFalsy();

            rule = '||tvn.adocean.pl/*ad.xml$xmlhttprequest,redirect=noopvast-2.0,domain=tvn24.pl';
            expect(redirects.isValidAdgRedirectRule(rule)).toBeTruthy();

            rule = '||vast.kinogo.by/code/video-steam/?id=$redirect=noopvast-2.0';
            expect(redirects.isValidAdgRedirectRule(rule)).toBeTruthy();

            rule = '||strm.yandex.com/get/$script,redirect=noopvast-2.0,domain=kinopoisk.com';
            expect(redirects.isValidAdgRedirectRule(rule)).toBeTruthy();

            rule = '||strm.yandex.com/get/$script,redirect=noopvast-2.0,domain=kinopoisk.com';
            expect(redirects.isValidAdgRedirectRule(rule)).toBeTruthy();

            rule = '||googletagmanager.com/gtm.js$script,redirect=googletagmanager-gtm,domain=morningstar.nl';
            expect(redirects.isValidAdgRedirectRule(rule)).toBeTruthy();

            rule = '||example.com^$redirect=noopjson';
            expect(redirects.isValidAdgRedirectRule(rule)).toBeTruthy();
        });
    });

    describe('validate basic blocking rules with regexp', () => {
        describe('valid ', () => {
            const validRules = [
                '/^https:\/\/([a-z]+\.)?sythe\.org\/\[=%#@$&!^].*[\w\W]{20,}/$image',
                '/^https?:\/\/.*(bitly|bit)\.(com|ly)\//$domain=1337x.to',
                '/^https?:\/\/.*(powvideo|powvldeo|povvideo).*\.*[?&$=&!]/$script,subdocument',
            ];
            test.each(validRules)('%s', (rule) => {
                expect(validator.validate([rule])).toHaveLength(1);
            });
        });

        describe('invalid', () => {
            const invalidRules = [
                '/ex[[ampl[[e\.com\///.*\/banner/$script',
                '/^htt[[[ps?:\/\/.*(bitly|bit)\.(com|ly)\//$domain=1337x.to',
                '/\.sharesix\.com/.*[a-zA-Z0-9]({4}/$script',
            ];
            test.each(invalidRules)('%s', (rule) => {
                expect(validator.validate([rule])).toHaveLength(0);
            });
        });
    });

    it('validate modifiers - known and unknown', () => {
        const validRule = '@@||test.com^$generichide,app=iexplore.exe';
        expect(validator.validate([validRule])).toHaveLength(1);

        const invalidRule = '@@||test.com^$generichide,invalid_modifier';
        expect(validator.validate([invalidRule])).toHaveLength(0);
    });

    describe('validate removeparam rules', () => {
        describe('valid', () => {
            const validRules = [
                '$removeparam=/source|campaign/',
                '||test.com^$removeparam=qwerty',
                '||test.com^$removeparam=/qwerty/i',
                '@@||example.com$removeparam',
                'example.com$removeparam',
                '||example.com$removeparam',
                '||example.org^$removeparam=p,object',
            ];
            test.each(validRules)('%s', (rule) => {
                expect(validator.validate([rule])).toHaveLength(1);
            });
        });

        describe('invalid', () => {
            const invalidRules = [
                '||example.org^$removeparam=p,popup',
                // error: multiple values are not allowed
                '$removeparam=source|campaign',
            ];
            test.each(invalidRules)('%s', (rule) => {
                expect(validator.validate([rule])).toHaveLength(0);
            });
        });
    });

    it('validates $redirect-rule modifier', () => {
        let rules;

        rules = ['/adsbygoogle.$redirect-rule=noopmp4-1s,script,domain=nekopoi.web.id'];
        expect(validator.validate(rules)).toHaveLength(1);

        rules = ['example.org/ads.js$script,redirect-rule'];
        expect(validator.validate(rules)).toHaveLength(0);
    });

    describe('validate jsonprune modifier', () => {
        const validRules = [
            '||example.org/*/*/$xmlhttprequest,jsonprune=\\$..[ac\\, ab]',
            '||example.org/*/*/$jsonprune=\\$..[ac\\, ab],xmlhttprequest',
            '||example.org/*/*/$xmlhttprequest,jsonprune=\\$.data.*.attributes',
        ];
        test.each(validRules)('%s', (rule) => {
            expect(validator.validate([rule])).toHaveLength(1);
        });
    });

    describe('validate hls modifier', () => {
        const validRules = [
            '||example.org^$hls=preroll',
            '||example.org^$hls=\\/videoplayback^?*&source=dclk_video_ads',
            '||example.org^$hls=/#UPLYNK-SEGMENT:.*\\,ad/t',
        ];
        test.each(validRules)('%s', (rule) => {
            expect(validator.validate([rule])).toHaveLength(1);
        });
    });

    describe('validate referrerpolicy modifier', () => {
        const validRules = [
            '||example.com^$referrerpolicy=origin',
        ];
        test.each(validRules)('%s', (rule) => {
            expect(validator.validate([rule])).toHaveLength(1);
        });
    });

    describe('validate permissions modifier', () => {
        const validRules = [
            '||example.org^$permissions=geolocation=()',
        ];
        test.each(validRules)('%s', (rule) => {
            expect(validator.validate([rule])).toHaveLength(1);
        });
    });

    describe('validate header modifier', () => {
        const validRules = [
            String.raw`://www.*.com/*.css|$script,third-party,header=link:/ads\.re\/>;rel=preconnect/`,
        ];
        test.each(validRules)('%s', (rule) => {
            expect(validator.validate([rule])).toHaveLength(1);
        });
    });

    it('safari_cb_affinity directive test', () => {
        let rules = [
            '||test1.com',
            '!#safari_cb_affinity(security)',
            '||test2.com',
            '||test3.com',
            '!#safari_cb_affinity',
            '||test4.com',
            '||test5.com',
            '!#safari_cb_affinity(privacy)',
            '||test6.com',
            '||test7.com',
            '||test8.com',
            '!#safari_cb_affinity',
            '||test9.com',
            '||test10.com',
            '||test11.com',
            '||test12.com',
            '!#safari_cb_affinity(social)',
            '||test13.com',
            '||test14.com',
            '||test15.com',
            '!#safari_cb_affinity',
            '||test16.com',
            '||test17.com',
        ];
        expect(validator.checkAffinityDirectives(rules)).toBeTruthy();

        rules = [
            '||test1.com',
            '!#safari_cb_affinity(security)',
            '||test2.com',
            '||test3.com',
            '!#safari_cb_affinity(privacy)',
            '||test4.com',
            '||test5.com',
            '!#safari_cb_affinity',
            '||test6.com',
            '||test7.com',
            '||test8.com',
            '!#safari_cb_affinity',
        ];
        expect(validator.checkAffinityDirectives(rules)).toBeTruthy();

        // 'advanced' value for the directive
        rules = [
            '!#safari_cb_affinity(advanced)',
            '||test1.com',
            '||test2.com',
            '!#safari_cb_affinity',
            '||test3.com',
            '!#safari_cb_affinity(general,advanced)',
            '||test4.com',
            '||test5.com',
            '!#safari_cb_affinity',
            '||test6.com',
        ];

        rules = [
            '||test1.com',
            '||test2.com',
            '!#safari_cb_affinity',
            '||test3.com',
            '||test4.com',
            '||test5.com',
            '!#safari_cb_affinity(privacy)',
        ];
        expect(validator.checkAffinityDirectives(rules)).toBeFalsy();

        rules = [
            '||test1.com',
            '!#safari_cb_affinity(security)',
            '||test2.com',
            '||test3.com',
            '!#safari_cb_affinity',
            '||test4.com',
            '||test5.com',
            '!#safari_cb_affinity(privacy)',
            '||test6.com',
            '||test7.com',
        ];
        expect(validator.checkAffinityDirectives(rules)).toBeFalsy();

        rules = [
            '||test1.com',
            '||test2.com',
            '!#safari_cb_affinity',
            '||test3.com',
            '!#safari_cb_affinity',
            '||test4.com',
            '||test5.com',
            '!#safari_cb_affinity(privacy)',
            '||test6.com',
        ];
        expect(validator.checkAffinityDirectives(rules)).toBeFalsy();

        rules = [
            '||test1.com',
            '||test2.com',
            '!#safari_cb_affinity',
            '||test3.com',
        ];
        expect(validator.checkAffinityDirectives(rules)).toBeFalsy();

        rules = [
            '!#safari_cb_affinity(social)',
            '||test1.com',
            '||test2.com',
            '||test3.com',
        ];
        expect(validator.checkAffinityDirectives(rules)).toBeFalsy();
    });
});
