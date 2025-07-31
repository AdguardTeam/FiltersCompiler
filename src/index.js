import path from 'path';
import { setConfiguration, CompatibilityTypes } from '@adguard/tsurlfilter';

import { build } from './main/builder';
import { schemaValidator } from './main/json-validator';
import { localesValidator } from './main/locales-validator';
import { logger } from './main/utils/log';

// default platforms config
import { platformsConfig } from './main/platforms-config';

// Sets configuration compatibility
setConfiguration({ compatibility: CompatibilityTypes.Corelibs });

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const jsonSchemasConfigDir = path.join(__dirname, './schemas/');

process.on('unhandledRejection', (error) => {
    throw error;
});

export const compile = (path, logPath, reportFile, platformsPath, whitelist, blacklist, customPlatformsConfig) => {
    if (customPlatformsConfig) {
        logger.info('Using custom platforms configuration');
        // eslint-disable-next-line no-restricted-syntax, guard-for-in
        for (const platform in customPlatformsConfig) {
            logger.info(`Redefining platform ${platform}`);
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
