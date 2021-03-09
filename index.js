const path = require('path');
const { setLogger, setConfiguration, CompatibilityTypes } = require('@adguard/tsurlfilter');
const builder = require('./src/main/builder.js');
const schemaValidator = require('./src/main/json-validator.js');
const localesValidator = require('./src/main/locales-validator.js');
const logger = require('./src/main/utils/log');

// Sets RuleConverter to use logger of current library
setLogger(logger);

// Sets configuration compatibility
setConfiguration({ compatibility: CompatibilityTypes.corelibs });

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

const validateLocales = function (localesDirPath, requiredLocales) {
    return localesValidator.validate(localesDirPath, requiredLocales);
};

module.exports = {
    compile,
    validateJSONSchema,
    validateLocales,
};
