import path from 'path';
import { fileURLToPath } from 'url';
import { setConfiguration, CompatibilityTypes } from '@adguard/tsurlfilter';

import { build } from './main/builder';
import { schemaValidator } from './main/json-validator';
import { localesValidator } from './main/locales-validator';

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

/**
 * Builds the log lines that describe an applied platform configuration patch.
 *
 * The lines are logged by `build()` after it initializes the logger, so they
 * reach the log file of the current compilation.
 *
 * @param platformsConfigPatch Platform configuration patch.
 * @returns Log lines, empty when there is no patch.
 */
const getPlatformsConfigPatchLog = (platformsConfigPatch) => {
    if (!platformsConfigPatch) {
        return [];
    }

    const log = ['Using platforms configuration patch'];
    Object.keys(platformsConfigPatch).forEach((platform) => {
        // The merge ignores an undefined entry; the log must do the same.
        const patchEntry = platformsConfigPatch[platform];
        if (patchEntry === undefined) {
            return;
        }
        if (Object.hasOwn(platformsConfig, platform)) {
            log.push(`Patching platform ${platform}`);
        } else {
            log.push(`Adding platform ${platform} (${patchEntry.platform})`);
        }
    });

    return log;
};

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

    return build(
        path,
        logPath,
        reportFile,
        platformsPath,
        effectivePlatformsConfig,
        includedFilterIds,
        excludedFilterIds,
        getPlatformsConfigPatchLog(platformsConfigPatch),
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
