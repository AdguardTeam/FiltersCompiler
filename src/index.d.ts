/**
 * Type declarations for the public API of @adguard/filters-compiler.
 *
 * These declarations provide TypeScript consumers with typed signatures for
 * the three exported functions. They are hand-written because the entry point
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
    whitelist: number[],
    blacklist: number[],
    customPlatformsConfig?: CustomPlatformsConfig,
): Promise<void>;

/**
 * Validates built filter files against JSON schemas.
 *
 * Validation failures are logged, not thrown — check the return value.
 *
 * @param platformsPath Path to the built platform output.
 * @param requiredFiltersAmount Minimum number of filters expected.
 * @returns `true` when all files are valid, `false` on validation failure.
 */
export function validateJSONSchema(
    platformsPath: string,
    requiredFiltersAmount: number,
): boolean;

/**
 * Result of locale validation.
 */
export interface ValidateLocalesResult {
    /** `false` when at least one critical warning was found. */
    ok: boolean;
    /** Per-locale warning details. Present when warnings exist. */
    data?: unknown[];
    /** Formatted warnings log. Present when warnings exist. */
    log?: string;
}

/**
 * Validates locale translation files.
 *
 * @param localesDirPath Path to the locales directory.
 * @param requiredLocales List of required locale codes.
 * @returns `{ ok: true }` when no problems are found; when warnings exist,
 * the result includes `data` and `log`, and `ok` is `false` only for
 * critical warnings.
 * @throws Error when the locales directory is missing or empty.
 */
export function validateLocales(
    localesDirPath: string,
    requiredLocales: string[],
): ValidateLocalesResult;
