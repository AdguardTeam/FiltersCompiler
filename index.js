import path from 'path';
import { setLogger, setConfiguration, CompatibilityTypes } from '@adguard/tsurlfilter';

import { build } from './src/main/builder';
import { schemaValidator } from './src/main/json-validator';
import { localesValidator } from './src/main/locales-validator';
import { logger } from './src/main/utils/log';

// default platforms config
import { platformsConfig } from './src/main/platforms-config';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

// Sets RuleConverter to use logger of current library
setLogger(logger);

// Sets configuration compatibility
setConfiguration({ compatibility: CompatibilityTypes.Corelibs });

const jsonSchemasConfigDir = path.join(__dirname, './schemas/');

process.on('unhandledRejection', (error) => {
    throw error;
});

export const compile = (path, logPath, reportFile, platformsPath, whitelist, blacklist, customPlatformsConfig) => {
    if (customPlatformsConfig) {
        logger.log('Using custom platforms configuration');
        // eslint-disable-next-line no-restricted-syntax, guard-for-in
        for (const platform in customPlatformsConfig) {
            logger.log(`Redefining platform ${platform}`);
            platformsConfig[platform] = customPlatformsConfig[platform];
        }
    }

    return build(
        path,
        logPath,
        reportFile,
        platformsPath,
        platformsConfig,
        whitelist,
        blacklist,
    );
};

export const validateJSONSchema = (platformsPath, requiredFiltersAmount) => {
    return schemaValidator.validate(platformsPath, jsonSchemasConfigDir, requiredFiltersAmount);
};

export const validateLocales = (localesDirPath, requiredLocales) => {
    return localesValidator.validate(localesDirPath, requiredLocales);
};
