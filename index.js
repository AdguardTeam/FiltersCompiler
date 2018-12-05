/* globals require, __dirname, process */

module.exports = (function () {

    'use strict';

    const path = require('path');
    const builder = require("./src/main/builder.js");
    const schemaValidator = require('./src/main/json-validator.js');
    const platformsConfig = path.join(__dirname, './platforms.json');
    const jsonSchemasConfigDir = path.join(__dirname, './schemas/');

    process.on('unhandledRejection', error => {
        throw error;
    });

    const compile = function (path, logPath, domainBlacklistFile, platformsPath, whitelist, blacklist) {
        return builder.build(path, logPath, domainBlacklistFile, platformsPath, platformsConfig, whitelist, blacklist);
    };

    const validateJSONSchema = function (platformsPath, requiredFiltersAmount) {
        return schemaValidator.validate(platformsPath, jsonSchemasConfigDir, requiredFiltersAmount);
    };

    return {
        compile: compile,
        validateJSONSchema: validateJSONSchema
    };
})();