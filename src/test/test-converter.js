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
});

