/* globals require, QUnit */

QUnit.test("Test converter", function (assert) {
    'use strict';

    var converter = require('../src/compiler/converter.js');

    var c = converter.convert(['example.com']);
    assert.equal(c[0], 'example.com');

    c = converter.convert(['example.com##h1:style(background-color: blue !important)']);
    assert.equal(c[0], 'example.com#$#h1 { background-color: blue !important }');

    c = converter.convert(['example.com#@#h1:style(background-color: blue !important)']);
    assert.equal(c[0], 'example.com#@$#h1 { background-color: blue !important }');
});

