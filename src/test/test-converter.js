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
    const { convertScriptletToUblockSyntax } = require('../main/converter');

    // scriptlet with one argument
    let actual = convertScriptletToUblockSyntax('example.org#%#//scriptlet("abort-on-property-read", "alert")');
    let expected = 'example.org##script:inject(abort-on-property-read.js, alert)';
    assert.equal(actual, expected);

    // scriptlet with two arguments
    actual = convertScriptletToUblockSyntax("example.org#%#//scriptlet('set-constant', 'firstConst', 'false')");
    expected = 'example.org##script:inject(set-constant.js, firstConst, false)';
    assert.equal(actual, expected);

    // scriptlet without arguments and few domains
    actual = convertScriptletToUblockSyntax("example1.org,example2.com,some-domain.dom#%#//scriptlet('prevent-adfly')");
    expected = 'example1.org,example2.com,some-domain.dom##script:inject(adfly-defuser.js)';
    assert.equal(actual, expected);

    // scriptlet name error
    actual = convertScriptletToUblockSyntax("example.org#%#//scriptlet('Zet-constant', 'firstConst', 'false')");
    expected = '';
    assert.equal(actual, expected);

    // scriptlet argument includes quotes
    actual = convertScriptletToUblockSyntax("example.org#%#//scriptlet('set-constant', 'constName', 'value'12345'')");
    expected = 'example.org##script:inject(set-constant.js, constName, value\'12345\')';
    assert.equal(actual, expected);
});

