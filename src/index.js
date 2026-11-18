import path from 'path';
import { fileURLToPath } from 'url';
import { setConfiguration, CompatibilityTypes } from '@adguard/tsurlfilter';

import { build } from './main/builder';
import { schemaValidator } from './main/json-validator';
import { localesValidator } from './main/locales-validator';
import { logger } from './main/utils/log';

// default platforms config
import {
    PlatformsConfigError,
    mergePlatformsConfig,
    platformConfigPatterns,
    platformsConfig,
} from './main/platforms-config';

export {
    PlatformsConfigError,
    mergePlatformsConfig,
    platformConfigPatterns,
    platformsConfig,
};

export { localOptimizationStatistics, OptimizationStatsError } from './main/optimization';

// Sets configuration compatibility
setConfiguration({ compatibility: CompatibilityTypes.Corelibs });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const jsonSchemasConfigDir = path.join(__dirname, './schemas/');

export const compile = (
    path,
    logPath,
    reportFile,
    platformsPath,
    includedFilterIds,
    excludedFilterIds,
    platformsConfigPatch,
) => {
    const effectivePlatformsConfig = mergePlatformsConfig(platformsConfig, platformsConfigPatch ?? {});

    if (platformsConfigPatch) {
        logger.info('Using platforms configuration patch');
        Object.keys(platformsConfigPatch).forEach((platform) => {
            // The merge ignores an undefined entry; the log must do the same.
            const patchEntry = platformsConfigPatch[platform];
            if (patchEntry === undefined) {
                return;
            }
            if (Object.hasOwn(platformsConfig, platform)) {
                logger.info(`Patching platform ${platform}`);
            } else {
                logger.info(`Adding platform ${platform} (${patchEntry.platform})`);
            }
        });
    }

    return build(
        path,
        logPath,
        reportFile,
        platformsPath,
        effectivePlatformsConfig,
        includedFilterIds,
        excludedFilterIds,
    );
};

export const validateJSONSchema = (
    platformsPath,
    options,
) => {
    return schemaValidator.validate(
        platformsPath,
        jsonSchemasConfigDir,
        options,
    );
};

export const validateLocales = (localesPath, requiredLocales, logFormat) => {
    return localesValidator.validate(localesPath, requiredLocales, logFormat);
};
