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
});

