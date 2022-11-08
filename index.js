const fs = require('fs');
const path = require('path');
const { setLogger, setConfiguration, CompatibilityTypes } = require('@adguard/tsurlfilter');

const builder = require('./src/main/builder');
const schemaValidator = require('./src/main/json-validator');
const localesValidator = require('./src/main/locales-validator');
const logger = require('./src/main/utils/log');

// Sets RuleConverter to use logger of current library
setLogger(logger);

// Sets configuration compatibility
setConfiguration({ compatibility: CompatibilityTypes.corelibs });

const platformsConfigPath = path.join(__dirname, './platforms.json');
const jsonSchemasConfigDir = path.join(__dirname, './schemas/');

// Reading the default platforms config
const platformsConfig = JSON.parse(fs.readFileSync(platformsConfigPath, { encoding: 'utf-8' }));

process.on('unhandledRejection', (error) => {
    throw error;
});

const compile = function (path, logPath, reportFile, platformsPath, whitelist, blacklist, customPlatformsConfig) {
    if (customPlatformsConfig) {
        logger.log('Using custom platforms configuration');
        // eslint-disable-next-line no-restricted-syntax, guard-for-in
        for (const platform in customPlatformsConfig) {
            logger.log(`Redefining platform ${platform}`);
            platformsConfig[platform] = customPlatformsConfig[platform];
        }
    }

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
