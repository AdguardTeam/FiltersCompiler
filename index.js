/* eslint-disable global-require */
module.exports = (function () {
    const path = require('path');
    const builder = require('./src/main/builder.js');
    const schemaValidator = require('./src/main/json-validator.js');
    const platformsConfig = path.join(__dirname, './platforms.json');
    const jsonSchemasConfigDir = path.join(__dirname, './schemas/');

    process.on('unhandledRejection', (error) => {
        throw error;
    });

    const compile = function (path, logPath, reportFile, platformsPath, whitelist, blacklist) {
        return builder.build(
            path,
            logPath,
            reportFile,
            platformsPath,
            platformsConfig,
            whitelist,
            blacklist
        );
    };

    const validateJSONSchema = function (platformsPath, requiredFiltersAmount) {
        return schemaValidator.validate(platformsPath, jsonSchemasConfigDir, requiredFiltersAmount);
    };

    return {
        compile,
        validateJSONSchema,
    };
})();
