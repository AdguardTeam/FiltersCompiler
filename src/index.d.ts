/**
 * Type declarations for the public API of @adguard/filters-compiler.
 *
 * These declarations provide TypeScript consumers with typed signatures for
 * the exported functions. They are hand-written because the entry point
 * (src/index.js) is JavaScript and is not processed by the TypeScript compiler.
 *
 * When src/index.js is eventually migrated to TypeScript, this file should be
 * removed — the compiler will generate declarations automatically.
 */

/**
 * Platform configuration for a single platform.
 */
export interface PlatformConfig {
    [key: string]: unknown;
}

/**
 * Custom platform configurations keyed by platform name.
 */
export type CustomPlatformsConfig = Record<string, PlatformConfig>;

/**
 * Compiles filter lists for all platforms.
 *
 * @param path Path to the filter lists directory.
 * @param logPath Path for the compilation log file (logging disabled if omitted).
 * @param reportFile Path for the compilation report file.
 * @param platformsPath Path for platform-specific output.
 * @param whitelist Whitelisted filter IDs.
 * @param blacklist Blacklisted filter IDs.
 * @param customPlatformsConfig Optional custom platform configurations.
 */
export function compile(
    path: string,
    logPath: string | undefined,
    reportFile: string | undefined,
    platformsPath: string,
    whitelist?: number[] | null,
    blacklist?: number[] | null,
    customPlatformsConfig?: CustomPlatformsConfig,
): Promise<void>;

/**
 * Validates built filter files against JSON schemas.
 *
 * @param platformsPath Path to the built platform output.
 * @param requiredFiltersAmount Minimum number of filters expected.
 */
export function validateJSONSchema(
    platformsPath: string,
    requiredFiltersAmount: number,
): void;

/**
 * Validates locale translation files.
 *
 * @param localesDirPath Path to the locales directory.
 * @param requiredLocales List of required locale codes.
 */
export function validateLocales(
    localesDirPath: string,
    requiredLocales: string[],
): void;

/**
 * Manages a local on-disk cache of optimization configuration files.
 */
export const localOptimizationConfig: {
    /**
     * Downloads `percent.json` from the remote server and saves it to `configPath`.
     * Creates `configPath` if it does not exist.
     *
     * @param configPath - Directory where `percent.json` will be written.
     */
    downloadPercentJson(configPath: string): Promise<void>;
    /**
     * Reads the local `percent.json`, downloads any missing `stats.json` files
     * for each listed filter, and saves them to disk.
     * Existing `stats.json` files are not overwritten (preserves user edits).
     *
     * When `filterIds` is a non-empty array only those filters are processed;
     * pass an empty array to process all filters listed in `percent.json`.
     *
     * @param {string} configPath - Directory containing `percent.json`.
     * @param {number[]} filterIds - Filter IDs to process; empty array processes all.
     */
    downloadStatsFromPercentJson(configPath: string, filterIds: number[]): Promise<void>;
    /**
     * Configures `getFilterOptimizationConfig` to read stats from local files under
     * `configPath` instead of fetching from the remote server.
     * Stats are loaded lazily on demand during compilation.
     *
     * @param {string} configPath - Directory containing `percent.json` and
     *   `filters/<filterId>/stats.json`.
     */
    useLocalConfig(configPath: string): void;
    /**
     * Removes the cache directory and clears in-memory state.
     *
     * @param configPath - Directory to remove.
     */
    reset(configPath: string): Promise<void>;
};
