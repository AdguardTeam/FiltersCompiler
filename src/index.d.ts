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
 * @param includedFilterIds Filter IDs to include; empty (default) processes all.
 * @param excludedFilterIds Filter IDs to exclude; empty (default) excludes none.
 * @param customPlatformsConfig Optional custom platform configurations.
 * @returns Promise that resolves when compilation is complete.
 */
export function compile(
    path: string,
    logPath: string | undefined,
    reportFile: string | undefined,
    platformsPath: string | null,
    includedFilterIds?: number[] | null,
    excludedFilterIds?: number[] | null,
    customPlatformsConfig?: CustomPlatformsConfig,
): Promise<void>;

/**
 * Options for `validateJSONSchema`.
 */
export interface ValidateJSONSchemaOptions {
    /**
     * Path to the FiltersRegistry locales directory.
     *
     * The directory supplies the list of locales and the base (`en`) strings
     * that the generated `filters_i18n` schema uses as fallback defaults.
     */
    localesPath: string;

    /**
     * Locales that must be present for every group, tag, and filter.
     * Defaults to all locale subdirectories of `localesPath`.
     *
     * The schema validates every locale directory in `localesPath`, even when
     * this list contains a subset.
     */
    requiredLocales?: string[];

    /**
     * Path to the validation log file. The file is appended to and closed
     * when validation finishes. When omitted, messages go to the console
     * only; a log file opened by an earlier call is not reused.
     */
    logPath?: string;
}

/**
 * Validates built filter files against JSON schemas.
 *
 * The `filters_i18n` schema is generated at runtime for every non-legacy
 * platform from the platform's `filters.json` and the FiltersRegistry locale
 * data. Missing fields in an existing locale object are filled with the base
 * (`en`) value and logged as warnings. These behaviors apply only to the
 * generated schema: the legacy `mac` and `mac_v2` platforms use their frozen
 * schemas, ignore `requiredLocales`, and log no fallbacks.
 *
 * Validation failures are logged, not thrown — check the return value.
 *
 * @param platformsPath Path to the built platform output.
 * @param requiredFiltersAmount Minimum number of filters for `filters.json`
 * files directly under `platformsPath` (not enforced per platform).
 * @param options Validation options.
 * @returns `true` when all files are valid, `false` on validation failure.
 * @throws {Error} When `options` or `options.localesPath` is missing, or when
 * `options.logPath` cannot be opened.
 */
export function validateJSONSchema(
    platformsPath: string,
    requiredFiltersAmount: number,
    options: ValidateJSONSchemaOptions,
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
 * Log format for the warnings log returned by `validateLocales`.
 */
export type LocalesLogFormat = 'text' | 'markdown';

/**
 * Validates locale translation files.
 *
 * @param localesDirPath Path to the locales directory.
 * @param requiredLocales List of required locale codes.
 * @param logFormat Format of the returned `log` field: `'text'` (default)
 * or `'markdown'`.
 * @returns `{ ok: true }` when no problems are found; when warnings exist,
 * the result includes `data` and `log`, and `ok` is `false` only for
 * critical warnings.
 * @throws Error when the locales directory is missing or empty.
 */
export function validateLocales(
    localesDirPath: string,
    requiredLocales: string[],
    logFormat?: LocalesLogFormat,
): ValidateLocalesResult;

/**
 * TS2834: Unable to resolve './main/optimization' on the consumer side.
 * An explicit file extension is required to prevent this error.
 * The mapping from `.js` to `.d.ts` is part of the specification;
 * however, resolving a `.ts` file to a `.d.ts` file is not guaranteed.
 * @see https://www.typescriptlang.org/docs/handbook/modules/reference.html#file-extension-substitution
 */
export { localOptimizationStatistics, OptimizationStatsError } from './main/optimization.js';
