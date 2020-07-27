const path = require('path');
const schemaValidator = require('../main/json-validator.js');

// Mock log to hide error messages
jest.mock('../main/utils/log');

describe('json validator', () => {
    it('Test json validator', () => {
        expect(schemaValidator).toBeDefined();

        const platformsPath = path.join(__dirname, './resources/platforms');
        const jsonSchemasConfigDir = path.join(__dirname, './resources/schemas');

        expect(schemaValidator.validate(platformsPath, jsonSchemasConfigDir, 2)).toBeTruthy();
    });
});
