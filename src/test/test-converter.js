/* globals require, QUnit */

QUnit.test("Test converter", (assert) => {
    'use strict';

    const converter = require('../main/converter.js');

    let c = converter.convert(['example.com']);
    assert.equal(c[0], 'example.com');

    c = converter.convert(['example.com##h1:style(background-color: blue !important)']);
    assert.equal(c[0], 'example.com#$#h1 { background-color: blue !important }');

    c = converter.convert(['example.com#@#h1:style(background-color: blue !important)']);
    assert.equal(c[0], 'example.com#@$#h1 { background-color: blue !important }');

    c = converter.convert(['apkmirror.com##body .google-ad-leaderboard-smaller:style(position: absolute!important; left: -4000px!important; display:block!important;)']);
    assert.equal(c[0], 'apkmirror.com#$#body .google-ad-leaderboard-smaller { position: absolute!important; left: -4000px!important; display:block!important; }');

    c = converter.convert(['apkmirror.com##body .google-ad-square-sidebar:style(position: absolute!important; left: -4000px!important; display:block!important;)']);
    assert.equal(c[0], 'apkmirror.com#$#body .google-ad-square-sidebar { position: absolute!important; left: -4000px!important; display:block!important; }');

    c = converter.convert(['benchmark.pl###bannerDBB:style(height: 10px !important;)']);
    assert.equal(c[0], 'benchmark.pl#$##bannerDBB { height: 10px !important; }');

    // https://github.com/AdguardTeam/FiltersCompiler/issues/24
    c = converter.convert(['720hd.club#?##all:style(margin-top: 0 !important)']);
    assert.equal(c[0], '720hd.club#$?##all { margin-top: 0 !important }');

    c = converter.convert(['720hd.club#@?##all:style(margin-top: 0 !important)']);
    assert.equal(c[0], '720hd.club#@$?##all { margin-top: 0 !important }');
});

QUnit.test('Test first-party replaced by ~third-party', (assert) => {
    const converter = require('../main/converter');
    let actual = converter.convert(['||www.ynet.co.il^$important,websocket,first-party']);
    let expected = '||www.ynet.co.il^$important,websocket,~third-party';
    assert.equal(actual, expected);

    actual = converter.convert(['||zive.cz^*+$script,first-party']);
    expected = '||zive.cz^*+$script,~third-party';
    assert.equal(actual, expected);

    actual = converter.convert(['||zive.cz^*+$script,first-party']);
    expected = '||zive.cz^*+$script,~third-party';
    assert.equal(actual, expected);

    actual = converter.convert(['||zive.cz^*+$first-party,script']);
    expected = '||zive.cz^*+$~third-party,script';
    assert.equal(actual, expected);

    actual = converter.convert(['||zive.cz^*+$first-party']);
    expected = '||zive.cz^*+$~third-party';
    assert.equal(actual, expected);

    actual = converter.convert(['||www.ynet.co.il^$important,websocket,first-party', '||zive.cz^*+$script,first-party']);
    expected = ['||www.ynet.co.il^$important,websocket,~third-party', '||zive.cz^*+$script,~third-party'];
    assert.equal(actual[0], expected[0]);
    assert.equal(actual[1], expected[1]);
});

QUnit.test('Test options replacement', (assert) => {
    const converter = require('../main/converter');
    let actual = converter.convert(['||www.ynet.co.il^$xhr,websocket']);
    let expected = '||www.ynet.co.il^$xmlhttprequest,websocket';
    assert.equal(actual, expected);

    actual = converter.convert(['||zive.cz^*+$script,xhr']);
    expected = '||zive.cz^*+$script,xmlhttprequest';
    assert.equal(actual, expected);

    actual = converter.convert(['||zive.cz^*+$script,css']);
    expected = '||zive.cz^*+$script,stylesheet';
    assert.equal(actual, expected);

    actual = converter.convert(['||zive.cz^*+$css,script']);
    expected = '||zive.cz^*+$stylesheet,script';
    assert.equal(actual, expected);

    actual = converter.convert(['||zive.cz^*+$frame']);
    expected = '||zive.cz^*+$subdocument';
    assert.equal(actual, expected);

    actual = converter.convert(['||zive.cz^*+$xhr,frame']);
    expected = '||zive.cz^*+$xmlhttprequest,subdocument';
    assert.equal(actual, expected);
});

QUnit.test('Test convert scriptlets to UBlock syntax', (assert) => {
    const { convertAdgScriptletsToUbo } = require('../main/converter');

    // scriptlet with one argument
    let actual = convertAdgScriptletsToUbo(['example.org#%#//scriptlet("abort-on-property-read", "alert")']);
    let expected = 'example.org##+js(abort-on-property-read.js, alert)';
    assert.equal(actual, expected);

    // scriptlet with ubo-compatible name
    actual = convertAdgScriptletsToUbo(['example.org#%#//scriptlet("ubo-abort-on-property-read.js", "alert")']);
    expected = 'example.org##+js(abort-on-property-read.js, alert)';
    assert.equal(actual, expected);

    // scriptlet with two arguments
    actual = convertAdgScriptletsToUbo(["example.org#%#//scriptlet('set-constant', 'firstConst', 'false')"]);
    expected = 'example.org##+js(set-constant.js, firstConst, false)';
    assert.equal(actual, expected);

    // scriptlet without arguments and few domains
    actual = convertAdgScriptletsToUbo(["example1.org,example2.com,some-domain.dom#%#//scriptlet('prevent-adfly')"]);
    expected = 'example1.org,example2.com,some-domain.dom##+js(adfly-defuser.js)';
    assert.equal(actual, expected);

    // scriptlet argument includes quotes
    actual = convertAdgScriptletsToUbo(["example.org#%#//scriptlet('set-constant', 'constName', 'value\"12345\"')"]);
    expected = 'example.org##+js(set-constant.js, constName, value"12345")';
    assert.equal(actual, expected);

});

QUnit.test('Test ##^script:has-text to $$script[tag-containts] replacement', (assert) => {
    const converter = require('../main/converter');
    let actual = converter.convert(['example.com##^script:has-text(12313)']);
    let expected = 'example.com$$script[tag-content="12313"][max-length="262144"]';
    assert.equal(actual, expected);

    actual = converter.convert(['example.com##^script:has-text(/\.advert/)']);
    expected = 'example.com##^script:has-text(/\.advert/)';
    assert.equal(actual, expected);

    actual = converter.convert(['example.com##^script:contains(banner)']);
    expected = 'example.com$$script[tag-content="banner"][max-length="262144"]';
    assert.equal(actual, expected);

    actual = converter.convert(['example.com##^script:contains(/.+banner/)']);
    expected = 'example.com##^script:contains(/.+banner/)';
    assert.equal(actual, expected);
});

QUnit.test('Test $1p to $~third-party and $3p to $third-party replacement', (assert) => {
    const converter = require('../main/converter');
    let actual = converter.convert(['||www.ynet.co.il^$important,websocket,1p,domain=www.ynet.co.il']);
    let expected = '||www.ynet.co.il^$important,websocket,~third-party,domain=www.ynet.co.il';
    assert.equal(actual, expected);

    actual = converter.convert(['||20il.co.il^$important,websocket,1p']);
    expected = '||20il.co.il^$important,websocket,~third-party';
    assert.equal(actual, expected);

    actual = converter.convert(['||vidads.gr^$3p']);
    expected = '||vidads.gr^$third-party';
    assert.equal(actual, expected);

    actual = converter.convert(['@@.com/ads.js|$3p,domain=~3ppt.com']);
    expected = '@@.com/ads.js|$third-party,domain=~3ppt.com';
    assert.equal(actual, expected);

    actual = converter.convert(['@@.com/ads.js|$~third-party,domain=~3ppt.com']);
    expected = '@@.com/ads.js|$~third-party,domain=~third-partypt.com';
    assert.notEqual(actual, expected);

    actual = converter.convert(['spiele-umsonst.de##.left > div.right[style$="1px;"]']);
    expected = 'spiele-umsonst.de##.left > div.right[style$="~third-partyx;"]';
    assert.notEqual(actual, expected);

    actual = converter.convert(['realadmin.ru#$#.adsbygoogle { height: 1px!important; }']);
    expected = 'realadmin.ru#$#.adsbygoogle { height: third-partyx!important; }';
    assert.notEqual(actual, expected);
});

QUnit.test('Test scriptlets lib converter', (assert) => {
    const scriptlets = require('scriptlets').default;
    let actual = scriptlets.convertUboToAdg('example.com#@#+js(nano-setInterval-booster.js, some.example, 1000)');
    let expected = 'example.com#@%#//scriptlet("ubo-nano-setInterval-booster.js", "some.example", "1000")';
    assert.equal(actual, expected);

    actual = scriptlets.convertAdgToUbo('example.org#%#//scriptlet("ubo-abort-on-property-read.js", "alert")');
    expected = 'example.org##+js(abort-on-property-read.js, alert)';
    assert.equal(actual, expected);

    actual = scriptlets.convertAdgToUbo('example.org#%#//scriptlet("abort-on-property-write", "adblock.check")');
    expected = 'example.org##+js(abort-on-property-write.js, adblock.check)';
    assert.equal(actual, expected);

    actual = scriptlets.convertAbpToAdg('test.com#$#abort-on-property-read adsShown');
    expected = 'test.com#%#//scriptlet("abp-abort-on-property-read", "adsShown")';
    assert.equal(actual, expected);

    actual = scriptlets.convertScriptletToAdg('example.com#@#+js(nano-setInterval-booster.js, some.example, 1000)');
    expected = 'example.com#@%#//scriptlet("ubo-nano-setInterval-booster.js", "some.example", "1000")';
    assert.equal(actual, expected);

    actual = scriptlets.convertScriptletToAdg('test.com#$#abort-on-property-read adsShown');
    expected = 'test.com#%#//scriptlet("abp-abort-on-property-read", "adsShown")';
    assert.equal(actual, expected);

    actual = scriptlets.convertScriptletToAdg('example.org#$#hide-if-has-and-matches-style \'d[id^="_"]\' \'div > s\' \'display: none\'; hide-if-contains /.*/ .p \'a[href^="/ad__c?"]\'');
    expected = [
        'example.org#%#//scriptlet("abp-hide-if-has-and-matches-style", "d[id^=\\"_\\"]", "div > s", "display: none")',
        'example.org#%#//scriptlet("abp-hide-if-contains", "/.*/", ".p", "a[href^=\\"/ad__c?\\"]")',
    ];
    assert.deepEqual(actual, expected);
});

QUnit.test('Test UBO to Adguard scriptlet converter', (assert) => {
    const converter = require('../main/converter');
    let actual = converter.convert(['test.com##+js(abort-current-inline-script.js, Math.random, adbDetect)']);
    let expected = 'test.com#%#//scriptlet("ubo-abort-current-inline-script.js", "Math.random", "adbDetect")';
    assert.equal(actual, expected);

    actual = converter.convert(['example.com##+js(disable-newtab-links.js)']);
    expected = 'example.com#%#//scriptlet("ubo-disable-newtab-links.js")';
    assert.equal(actual, expected);

    actual = converter.convert(['example.com##+js(addEventListener-defuser, load, onload)']);
    expected = 'example.com#%#//scriptlet("ubo-addEventListener-defuser.js", "load", "onload")';
    assert.equal(actual, expected);

    actual = converter.convert(['example.com#@#+js(nano-setInterval-booster.js, some.example, 1000)']);
    expected = 'example.com#@%#//scriptlet("ubo-nano-setInterval-booster.js", "some.example", "1000")';
    assert.equal(actual, expected);

    actual = converter.convert(['test.com##script:inject(json-prune.js)']);
    expected = 'test.com#%#//scriptlet("ubo-json-prune.js")';
    assert.equal(actual, expected);

    actual = converter.convert(['test.com#@#script:inject(abort-on-property-read.js, some.prop)']);
    expected = 'test.com#@%#//scriptlet("ubo-abort-on-property-read.js", "some.prop")';
    assert.equal(actual, expected);
});

QUnit.test('Test ABP to Adguard scriptlet converter', (assert) => {
    const converter = require('../main/converter');
    let actual = converter.convert(['test.com#$#abort-on-property-read adsShown']);
    let expected = 'test.com#%#//scriptlet("abp-abort-on-property-read", "adsShown")';
    assert.equal(actual, expected);

    actual = converter.convert(['example.com#$#abort-current-inline-script console.log Hello']);
    expected = 'example.com#%#//scriptlet("abp-abort-current-inline-script", "console.log", "Hello")';
    assert.equal(actual, expected);

    actual = converter.convert(['example.com#@$#abort-on-property-write adblock.check']);
    expected = 'example.com#@%#//scriptlet("abp-abort-on-property-write", "adblock.check")';
    assert.equal(actual, expected);
});
