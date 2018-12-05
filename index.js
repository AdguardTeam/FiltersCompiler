/* globals require, __dirname, process */

module.exports = (function () {

    'use strict';

    /**
     * Minimum required filters length in filters.json
     * @type {number}
     */
    const FILTERS_REQUIRED_IN_JSON = 80;

    const path = require('path');
    const builder = require("./src/main/builder.js");
    const schemaValidator = require('./src/json-validator.js');
    const platformsConfig = path.join(__dirname, './platforms.json');
    const jsonSchemasConfigDir = path.join(__dirname, './schemas/');

    process.on('unhandledRejection', error => {
        throw error;
    });

    const compile = function (path, logPath, domainBlacklistFile, platformsPath, whitelist, blacklist) {
        return builder.build(path, logPath, domainBlacklistFile, platformsPath, platformsConfig, whitelist, blacklist);
    };

    const validateJSONSchema = function (platformsPath) {
        return schemaValidator.validate(platformsPath, jsonSchemasConfigDir, FILTERS_REQUIRED_IN_JSON);
    };

    return {
        compile: compile,
        validateJSONSchema: validateJSONSchema
    };
})();