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

QUnit.test('Test ##^script:has-text to $$script[tag-containts] replacement', (assert) => {
    const converter = require('../main/converter');
    let actual = converter.convert(['example.com##^script:has-text(12313)']);
    let expected = 'example.com$$script[tag-content="12313"]';
    assert.equal(actual, expected);

    actual = converter.convert(['example.com##^script:has-text(/\.advert/)']);
    expected = 'example.com##^script:has-text(/\.advert/)';
    assert.equal(actual, expected);

    actual = converter.convert(['example.com##^script:contains(banner)']);
    expected = 'example.com$$script[tag-content="banner"]';
    assert.equal(actual, expected);

    actual = converter.convert(['example.com##^script:contains(/.+banner/)']);
    expected = 'example.com##^script:contains(/.+banner/)';
    assert.equal(actual, expected);
});

