export function compile(
    filtersPath: string,
    logPath: string,
    reportPath: string,
    platformsPath: string,
    whitelist: number[],
    blacklist: number[],
    customPlatformsConfig?: Record<string, unknown>,
): Promise<void>;

export function validateJSONSchema(
    platformsPath: string,
    requiredFiltersAmount: number,
): Promise<void>;

export function validateLocales(
    localesDirPath: string,
    requiredLocales: string[],
): Promise<void>;

/**
 * Manages a local on-disk cache of optimization configuration files.
 *
 * Directory layout:
 *   <configPath>/percent.json
 *   <configPath>/filters/<filterId>/stats.json
 */
export const localOptimizationConfig: {
    downloadPercentJson(configPath: string): Promise<void>;
    downloadStatsFromPercentJson(configPath: string): Promise<void>;
    reset(configPath: string): Promise<void>;
};
