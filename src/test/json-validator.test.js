const fs = require('fs');
const path = require('path');
const schemaValidator = require('../main/json-validator.js');
const builder = require('../main/builder');
const optimization = require('../main/optimization');

// Mock log to hide error messages
jest.mock('../main/utils/log');

describe('json validator', () => {
    it('Test json validator', async () => {
        // Builds directory, otherwise validation would fail
        optimization.disableOptimization();
        const filtersDir = path.join(__dirname, './resources/filters');
        const logFile = path.join(__dirname, './resources/log.txt');
        const reportFile = path.join(__dirname, './resources/report.txt');
        const platformsPath = path.join(__dirname, './resources/platforms');
        const platformsConfigFile = path.join(__dirname, './resources/platforms.json');
        const platformsConfig = JSON.parse(fs.readFileSync(platformsConfigFile, { encoding: 'utf-8' }));
        await builder.build(filtersDir, logFile, reportFile, platformsPath, platformsConfig);

        // Test validation
        const jsonSchemasConfigDir = path.join(__dirname, './resources/schemas');
        expect(schemaValidator.validate(platformsPath, jsonSchemasConfigDir, 2)).toBeTruthy();
    });
});
