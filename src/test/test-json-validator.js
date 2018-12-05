/* globals require, QUnit, __dirname */

QUnit.test("Test json validator", (assert) => {
    'use strict';

    const path = require('path');
    const schemaValidator = require('../main/json-validator.js');

    assert.ok(schemaValidator);

    const platformsPath = path.join(__dirname, './resources/platforms');
    const jsonSchemasConfigDir = path.join(__dirname, './resources/schemas');

    assert.ok(schemaValidator.validate(platformsPath, jsonSchemasConfigDir, 3));
});

