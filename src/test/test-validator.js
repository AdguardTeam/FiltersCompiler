/* eslint-disable max-len */
const scriptlets = require('scriptlets');
const validator = require('../main/validator.js');

/**
 * @typedef {Object} assert
 * @property {function} equal
 * @property {function} ok
 * @property {function} notOk
 */

/**
 * @typedef {Object} path
 * @property {function} join
 */

QUnit.test('Test css validation', (assert) => {
    let rules = ['example.com##.div'];
    assert.ok(validator.validate(rules).length > 0);
    rules = ['example.com###div-id'];
    assert.ok(validator.validate(rules).length > 0);
    rules = ['example.com##a[href^=/], .container:has(nav) > a[href]:lt($var)'];
    assert.notOk(validator.validate(rules).length > 0);
    rules = ['example.com##%'];
    assert.notOk(validator.validate(rules).length > 0);
});

QUnit.test('Test incorrect rules', (assert) => {
    const rules = ['||example.com##.div',
        'test$domain=yandex.ru,google.com'];
    assert.ok(validator.validate(rules).length === 0);
});

QUnit.test('Test ext-css validation', (assert) => {
    let selector = '#main > table.w3-table-all.notranslate:first-child > tbody > tr:nth-child(17) > td.notranslate:nth-child(2)';
    let ruleText = `w3schools.com##${selector}`;
    let rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    selector = "#body div[attr='test']:first-child  div";
    ruleText = `w3schools.com##${selector}`;
    rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    selector = '.todaystripe:matches-css(display: block)';
    ruleText = `w3schools.com##${selector}`;
    rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    selector = '.todaystripe:matches-css-before(display: block)';
    ruleText = `w3schools.com##${selector}`;
    rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    selector = '.todaystripe:matches-css-after(display: block)';
    ruleText = `w3schools.com##${selector}`;
    rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    selector = '.todaystripe:has(.banner)';
    ruleText = `w3schools.com##${selector}`;
    rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    selector = '.todaystripe:contains(test)';
    ruleText = `w3schools.com##${selector}`;
    rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    // TODO: Failed with ExtendedCss validation
    // ruleText = "drive2.ru##.l-main.js-main div.c-block:has(div.c-header:contains(Реклама))";
    // rules = [ruleText];
    // assert.ok(validator.validate(rules).length > 0);

    ruleText = 'drive2.ru##.l-main.js-main div.c-block:has(> div.c-header)';
    rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    selector = "[-ext-has='script:contains(var banner)']";
    ruleText = `w3schools.com##${selector}`;
    rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    selector = "[-ext-has='script:inject(var banner)']";
    ruleText = `w3schools.com##${selector}`;
    rules = [ruleText];
    assert.ok(validator.validate(rules).length === 0);
});

QUnit.test('Test ext-css validation - complicated cases', (assert) => {
    let ruleText;
    let rules;

    ruleText = 'doodhwali.com##.container .col-xs-12 .col-xs-12 > .yellow:not(:nth-child(3))';
    rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    ruleText = 'w3schools.com##.todaystripe:after';
    rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    ruleText = 'puls4.com##.media-actions-list > li:not(:nth-child(3)):not(:nth-child(4))';
    rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    ruleText = 'salamnews.org##.snlikebt > ul > li:not(:nth-child(4)):not(:nth-child(5))';
    rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    ruleText = 'posta.com.tr##.detail-share-item > a:not([href*="window.print()"])';
    rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    ruleText = 'disk.yandex.az,disk.yandex.by,disk.yandex.co.il,disk.yandex.com,disk.yandex.com.am,disk.yandex.com.ge,disk.yandex.com.tr,disk.yandex.ee,disk.yandex.fr,disk.yandex.kg,disk.yandex.kz,disk.yandex.lt,disk.yandex.lv,disk.yandex.md,disk.yandex.ru,disk.yandex.tj,disk.yandex.tm,disk.yandex.ua,disk.yandex.uz,yadi.sk##.share-link-popup__menu > div.menu__group:last-child > div.menu__item:not(:last-child):not(:nth-child(3))';
    rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    ruleText = 'fullfilmihdizlesene.com###sidebar > .sidebarborder:not(:nth-child(3))';
    rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    ruleText = 'pan.baidu.com,music.baidu.com,yun.baidu.com##[class|=ad]';
    rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    rules = ['better.com#$##header-floating\ navbar { position: absolute !important; }',
        'bongino.com#$##site-header\ 1 > .site-header-main { height: 167.3px !important; }',
        'deadline.com#$#.pmc-u-background-white.\/\/.header__bar { position: relative !important; transform: translateY(0) !important; }',
        'engadget.com#$#.o-sticky_header\@tp- { position: relative !important; }',
        'sports.yahoo.com#$##atomic .Mt\(headerHeight\) { margin-top: 22px !important; }',
        'texasmonthly.com#$##\#novella-header { position: relative !important; top: 0 !important; }'];
    assert.ok(validator.validate(rules).length === 6);

    rules = ["sports.yahoo.com#$##atomic .Mt\(headerHeight\) { margin-top: \\'22px\\' !important; }",
        "better.com#$##header-floating\ navbar { font-family: \\'Blogger\\'; }"];
    assert.ok(validator.validate(rules).length === 0);
});

QUnit.test('Test ext-css validation - complicated cases', (assert) => {
    let ruleText;
    let rules;

    ruleText = 'example.com##div:has-text(/test-xpath-content/):xpath(../../..)';
    rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    ruleText = 'example.com##div:xpath(//*[@class="test-xpath-class"])';
    rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    ruleText = 'example.com##div.test-nth-ancestor-marker:nth-ancestor(4)';
    rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    ruleText = 'example.com##div:xpath(../../..):has-text(/test-xpath-content/)';
    rules = [ruleText];
    assert.ok(validator.validate(rules).length === 0);

    ruleText = 'example.com##div:nth-ancestor(999)';
    rules = [ruleText];
    assert.ok(validator.validate(rules).length === 0);

    ruleText = 'example.com##div:xpath()';
    rules = [ruleText];
    assert.ok(validator.validate(rules).length === 0);
});

QUnit.test('Test ext-css validation - invalid pseudo classes', (assert) => {
    let ruleText;
    let rules;

    ruleText = 'yandex.ru##[-ext-has=test]:matches(.whatisthis)';
    rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    // Invalid pseudo class
    ruleText = 'yandex.ru##[-ext-has=test]:matches(.whatisthis), .todaystripe:contains(test)';
    rules = [ruleText];
    assert.notOk(validator.validate(rules).length > 0);
});

QUnit.test('Test content rules validation', (assert) => {
    let rules = ['~nigma.ru,google.com$$div[id=\"ad_text\"][wildcard=\"*teasernet*tararar*\"]'];
    assert.ok(validator.validate(rules).length > 0);
    rules = ['~nigma.ru,google.com$$div[id=\"ad_text\"][tag-content=\"teas\"\"ernet\"][max-length=\"500\"][min-length=\"50\"][wildcard=\"*.adriver.*\"][parent-search-level=\"15\"][parent-elements=\"td,table\"]'];
    assert.ok(validator.validate(rules).length > 0);
    rules = ['~nigma.ru,google.com$$div[id=\"ad_text\"][max-length=\"500000\"][min-length=\"50\"]'];
    assert.ok(validator.validate(rules).length > 0);
});

QUnit.test('Test validation - various rules', (assert) => {
    let rules = ['||onedrive.su/code/bshow.php$empty,important,~websocket'];
    assert.ok(validator.validate(rules).length > 0);

    rules = ['||4ksport.pl^$all'];
    assert.ok(validator.validate(rules).length > 0);

    rules = ['||onedrive.su/code/bshow.php$cookie=cookie_name'];
    assert.ok(validator.validate(rules).length > 0);

    rules = ['||onedrive.su/code/bshow.php$empty,important,stealth'];
    assert.ok(validator.validate(rules).length > 0);

    rules = ['samdan.com.tr,esquire.com.tr##div[data-mbzone="Textlink" i] > div#id_d_textlink'];
    assert.ok(validator.validate(rules).length > 0);

    rules = ["example.com##div[class^='textLink' i]"];
    assert.ok(validator.validate(rules).length > 0);

    rules = ['example.com#?#section:has(div[class^="textLink" i])',
        '##img[alt*="example.org" i]',
        '##img[alt*="QQ998" i]',
        '##[href*="35.200.169.1" i] > img',
        'aszdziennik.pl##a[href*="/aszdziennik" i] > img[src^="/static/media/"]'];
    assert.ok(validator.validate(rules).length === 5);

    rules = ['example.com##div[class^="textLink"i]',
        'example.com##div[class^=textLink i]',
        'example.com##div[class name="textLink" i]',
        'example.com##div[class^="textLink" "textColor" i]'];
    assert.ok(validator.validate(rules).length === 0);

    rules = ['||delivery.tf1.fr/pub$media,rewrite=abp-resource:blank-mp3,domain=tf1.fr'];
    assert.ok(validator.validate(rules).length > 0);

    rules = ['||delivery.tf1.fr/pub$media,rewrite=resource:blank-mp3,domain=tf1.fr',
        '||delivery.tf1.fr/pub$media,rewrite,domain=tf1.fr'];
    assert.ok(validator.validate(rules).length === 0);

    rules = [
        't',
        'tt',
        'ads',
        '##q',
        '||q',
    ];
    assert.ok(validator.validate(rules).length === 0);

    let actual = validator.validate(['']);
    let expected = '';
    assert.equal(actual, expected);

    actual = validator.validate(undefined);
    expected = '';
    assert.equal(actual, expected);
});

QUnit.test('Test validation - validate redirect option', (assert) => {
    const validRedirectRule1 = 'onedrive.su/code/bshow.php$redirect';
    const validRedirectRule2 = 'onedrive.su/code/bshow.php$important,redirect';
    const validImportantRule3 = 'onedrive.su/code/bshow.php$important';
    const nonValidRule = 'onedrive.su/code/bshow.php$nonvalid';

    const rules = [
        validRedirectRule1,
        validRedirectRule2,
        validImportantRule3,
        nonValidRule,
    ];

    const validateRules = validator.validate(rules);

    assert.ok(validateRules.indexOf(validRedirectRule1) >= 0);
    assert.ok(validateRules.indexOf(validRedirectRule2) >= 0);
    assert.ok(validateRules.indexOf(validImportantRule3) >= 0);
    assert.ok(validateRules.indexOf(nonValidRule) === -1);
    assert.ok(validator.validate(rules).length === 3);
});

QUnit.test('Test validation - validate rules with $', (assert) => {
    const validRedirectRule1 = 'zen.yandex.by,zen.yandex.com,zen.yandex.com.tr,zen.yandex.fr,zen.yandex.kz,zen.yandex.ru,zen.yandex.ua#?#.feed__item:-abp-has(*:-abp-contains(/^реклама$/i))';

    const rules = [
        validRedirectRule1,
    ];

    const validateRules = validator.validate(rules);

    assert.ok(validateRules.indexOf(validRedirectRule1) !== -1);
    assert.ok(validateRules.length > 0);
});

QUnit.test('Test validation - incorrect domain option', (assert) => {
    let rules = ['|http*$domain='];
    assert.ok(validator.validate(rules).length === 0);

    rules = ['|http*$~domain=|example.org'];
    assert.ok(validator.validate(rules).length === 0);

    rules = ['|http*$script,domain=|example.org'];
    assert.ok(validator.validate(rules).length === 0);
});

QUnit.test('Test validation - cosmetic css rules', (assert) => {
    let rules = ['example.com#$#body { background: black; }'];
    assert.ok(validator.validate(rules).length === 1);

    rules = ['example.com#$#body { background: url("https://some.jpg"); }'];
    assert.ok(validator.validate(rules).length === 0);

    rules = ['example.com#$#body { background: \\75 rl("https://some.jpg"); }'];
    assert.ok(validator.validate(rules).length === 0);

    rules = ['example.com#$#body[style*="background-image: url()"] { margin-top: 45px !important; }'];
    assert.ok(validator.validate(rules).length === 1);

    rules = ['example.com#$#body[style*="background-image: url(\'https://some.jpg\')"] { background: url() !important; }'];
    assert.ok(validator.validate(rules).length === 0);

    rules = ['hotline.ua#$#body.reset-scroll:before { z-index: -9999!important; display: none!important; }',
        'hotline.ua##body.reset-scroll::before',
        'hotline.ua##body.reset-scroll::after'];
    assert.ok(validator.validate(rules).length === 3);

    rules = ['sleazyneasy.com##.video-holder > .video-options::after',
        'northumberlandgazette.co.uk##div[class^="sc-"]::before'];
    assert.ok(validator.validate(rules).length === 2);

    rules = ['sleazyneasy.com##.video-holder > .video-options ::after',
        'northumberlandgazette.co.uk##div[class^="sc-"]:::before'];
    assert.ok(validator.validate(rules).length === 0);
});

QUnit.test('Test ##^script:has-text and $$script[tag-containts] rules', (assert) => {
    let rules = ['example.com##^script:contains(/.+banner/)'];
    assert.ok(validator.validate(rules).length === 0);

    rules = ['example.com##^script:has-text(/\.advert/)'];
    assert.ok(validator.validate(rules).length === 0);
});

QUnit.test('Test scriptlets lib validator', (assert) => {
    let result = scriptlets.isValidScriptletName('abort-on-property-read');
    assert.equal(result, true);

    result = scriptlets.isValidScriptletName('abort-on--property-read');
    assert.equal(result, false);

    result = scriptlets.isValidScriptletRule('test.com#%#//scriptlet("ubo-abort-current-inline-script.js", "Math.random", "adbDetect")');
    assert.equal(result, true);

    result = scriptlets.isUboScriptletRule('example.com#@#+js(nano-setInterval-booster.js, some.example, 1000)');
    assert.equal(result, true);

    result = scriptlets.isUboScriptletRule('test.com##script:inject(json-prune.js)');
    assert.equal(result, true);

    result = scriptlets.isUboScriptletRule('test.com#%#//scriptlet(\'ubo-json-prune.js\')');
    assert.equal(result, false);

    result = scriptlets.isAdgScriptletRule('test.com#%#//scriptlet(\'ubo-json-prune.js\')');
    assert.equal(result, true);

    result = scriptlets.isAdgScriptletRule('test.com#%#//scriptlet("abort-on-property-read", "some.prop")');
    assert.equal(result, true);

    result = scriptlets.isAdgScriptletRule('test.com#@#script:inject(abort-on-property-read.js, some.prop)');
    assert.equal(result, false);

    result = scriptlets.isAbpSnippetRule('example.com#@$#abort-on-property-write adblock.check');
    assert.equal(result, true);

    result = scriptlets.isAbpSnippetRule('test.com#@#script:inject(abort-on-property-read.js, some.prop)');
    assert.equal(result, false);
});

QUnit.test('Test scriptlets validator', (assert) => {
    let rules = [
        'test.com#%#//scriptlet("ubo-abort-current-inline-script.js", "Math.random", "adbDetect")',
        'example.com#@%#//scriptlet("ubo-disable-newtab-links.js")',
        'example.com#%#//scriptlet("abp-abort-current-inline-script", "console.log", "Hello")',
        'example.com#@%#//scriptlet("abort-on-property-write", "adblock.check")',
        'example.com#%#//scriptlet(\'abort-on-property-read\', \'ads.prop\')',
        'example.com#%#//scriptlet("prevent-adfly")',
        'example.com#@%#//scriptlet("ubo-nano-setInterval-booster", "some.example", "1000")',
    ];
    assert.ok(validator.validate(rules).length === 7);

    rules = [
        'test.com#%#//scriptlet("ubo-abort-current-inline-scripts.js", "Math.random", "adbDetect")',
        'example.com#%#//scriptlet("abp-abort-current-inline-script ", "console.log", "Hello")',
        'example.com#@%#//scriptlet("abort-on--property-write", "adblock.check")',
    ];
    assert.ok(validator.validate(rules).length === 0);

    rules = [
        'test.com#%#//scriptlet(abort-current-inline-script", "Math.random", "adbDetect")',
        'example.com#@%#//scriptlet("ubo-nano-setInterval-booster.js, "some.example", "1000")',
        'example.com#%#//scriptlet("abp-abort-current-inline-script", console.log", "Hello")',
    ];
    assert.ok(validator.validate(rules).length === 0);
});

QUnit.test('Test redirects validator', (assert) => {
    let rules = ['||delivery.tf1.fr/pub$media,redirect=noopmp3-0.1s,domain=tf1.fr',
        '||example.com/banner$image,redirect=32x32-transparent.png',
        '||example.com/*.mp4$media,redirect=noopmp4-1s',
        '||googletagservices.com/test.js$domain=test.com,redirect=googletagservices-gpt'];
    assert.equal(validator.validate(rules).length, 4);

    rules = ['||podu.me/ads/audio/*.mp3$redirect=noopmp3-0.1s',
        '||podu.me/ads/audio/*.mp3$media,redirect=noopmp3-0.1s'];
    assert.equal(validator.validate(rules).length, 2);

    rules = ['||example.com^$script,redirect=noopjs.js',
        '||example.com/banner$image,redirect=3x3.png',
        '||googletagservices.com/test.js$domain=test.com,redirect=googletagservices_gpt.js',
        '||example.com/banner$image,redirect=1x1.gif',
        '||example.com/*.mp4$media,redirect=noopmp4_1s'];
    assert.equal(validator.validate(rules).length, 0);

    // TODO we really should test scriptlets in this library?
    const { redirects } = scriptlets;

    let rule = '||example.com^$script,redirect=noopjs.js';
    assert.equal(redirects.isValidAdgRedirectRule(rule), false);

    rule = '||example.com^$script,redirect=noopjs';
    assert.equal(redirects.isValidAdgRedirectRule(rule), true);

    rule = '||example.com^$script,redirects=noopjs';
    assert.equal(redirects.isValidAdgRedirectRule(rule), false);

    rule = '||example.com&redirects=noopjs^$script';
    assert.equal(redirects.isValidAdgRedirectRule(rule), false);

    rule = '||example.com/banner$image,redirect=32x32transparent.png';
    assert.equal(redirects.isAdgRedirectRule(rule), true);

    rule = '||example.com/banner$image,redirect=32x32transparent.png';
    assert.equal(redirects.isValidAdgRedirectRule(rule), false);

    rule = '||tvn.adocean.pl/*ad.xml$xmlhttprequest,redirect=noopvast-2.0,domain=tvn24.pl';
    assert.equal(redirects.isValidAdgRedirectRule(rule), true);

    rule = '||vast.kinogo.by/code/video-steam/?id=$redirect=noopvast-2.0';
    assert.equal(redirects.isValidAdgRedirectRule(rule), true);

    rule = '||strm.yandex.ru/get/$script,redirect=noopvast-2.0,domain=kinopoisk.ru';
    assert.equal(redirects.isValidAdgRedirectRule(rule), true);

    rule = '||strm.yandex.ru/get/$script,redirect=noopvast-2.0,domain=kinopoisk.ru';
    assert.equal(redirects.isValidAdgRedirectRule(rule), true);
});

QUnit.test('Test blocking rules with regexp', (assert) => {
    let rules = [
        '/ex[[ampl[[e\.com\///.*\/banner/$script',
        '/^htt[[[ps?:\/\/.*(bitly|bit)\.(com|ly)\//$domain=1337x.to',
        '/\.sharesix\.com/.*[a-zA-Z0-9]({4}/$script',
    ];
    assert.ok(validator.validate(rules).length === 0);

    rules = [
        '/^https:\/\/([a-z]+\.)?sythe\.org\/\[=%#@$&!^].*[\w\W]{20,}/$image',
        '/^https?:\/\/.*(bitly|bit)\.(com|ly)\//$domain=1337x.to',
        '/^https?:\/\/.*(powvideo|powvldeo|povvideo).*\.*[?&$=&!]/$script,subdocument',
    ];
    assert.ok(validator.validate(rules).length === 3);
});
