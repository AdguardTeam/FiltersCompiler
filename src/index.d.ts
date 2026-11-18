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
 * Platform configuration types and the patch API.
 */
import type {
    PlatformConfigPatterns,
    PlatformsConfigPatch,
    ReadonlyPlatformsConfig,
} from './main/platforms-config.js';

export type {
    PlatformConfiguration,
    PlatformConfigurationPatch,
    PlatformConfigPatterns,
    PlatformDefines,
    PlatformEntry,
    PlatformPatch,
    PlatformReplacement,
    PlatformsConfig,
    PlatformsConfigPatch,
    ReadonlyPlatformsConfig,
} from './main/platforms-config.js';

/**
 * Custom platform configurations keyed by platform name.
 *
 * @deprecated Use {@link PlatformsConfigPatch}.
 */
export type CustomPlatformsConfig = PlatformsConfigPatch;

/**
 * Frozen default platform configurations.
 *
 * The type is deeply readonly.
 */
export declare const platformsConfig: ReadonlyPlatformsConfig;

/**
 * Regex pattern groups used by the default platform configurations.
 *
 * Every value is a frozen array of strings.
 */
export declare const platformConfigPatterns: PlatformConfigPatterns;

/**
 * Merges a platform configuration patch into a base configuration.
 *
 * An object merges key by key. An array replaces the base array. An absent or
 * `undefined` field inherits the base value. A `null` field is removed from
 * the result. `false` is a value for `ignoreRuleHints`; for
 * `removeRulePatterns`, `false` removes the field. A `removeRulePatterns`
 * entry is a string or a `RegExp`, and a string must compile as one.
 *
 * A patch key that is not in `base` adds a platform. The entry must then be
 * complete, and its `platform` must be a family that `base` already uses. A
 * platform `path` must be unique among platforms; the comparison is
 * case-insensitive. Every field of a legacy mac platform is patchable except
 * its path, which cannot change. An added legacy platform must use its `mac`
 * or `mac_v2` directory. Those directory names are reserved for legacy
 * platforms.
 *
 * @param base Base configuration.
 * @param patch Platform patches.
 * @returns The merged and frozen configuration.
 * @throws {PlatformsConfigError} When a patch value is invalid.
 */
export declare function mergePlatformsConfig(
    base: ReadonlyPlatformsConfig,
    patch: PlatformsConfigPatch,
): ReadonlyPlatformsConfig;

/**
 * Error thrown when a platform configuration patch is invalid.
 */
export declare class PlatformsConfigError extends Error {
    /**
     * Dotted path to the invalid value, for example
     * `patch.EXTENSION_UBLOCK.configuration.removeRulePatterns[1]`.
     */
    readonly path: string;

    /**
     * @param path Dotted path to the invalid value.
     * @param detail What is wrong.
     */
    constructor(path: string, detail: string);
}

/**
 * Compiles filter lists for all platforms.
 *
 * @param path Path to the filter lists directory.
 * @param logPath Path for the compilation log file (logging disabled if omitted).
 * @param reportFile Path for the compilation report file.
 * @param platformsPath Path for platform-specific output.
 * @param includedFilterIds Filter IDs to include; empty (default) processes all.
 * @param excludedFilterIds Filter IDs to exclude; empty (default) excludes none.
 * @param platformsConfigPatch Optional platform configuration patches.
 * @returns Promise that resolves when compilation is complete.
 * @throws {PlatformsConfigError} When `platformsConfigPatch` is invalid.
 * Thrown synchronously, before any file is read or written.
 */
export function compile(
    path: string,
    logPath: string | undefined,
    reportFile: string | undefined,
    platformsPath: string | null,
    includedFilterIds?: number[] | null,
    excludedFilterIds?: number[] | null,
    platformsConfigPatch?: PlatformsConfigPatch,
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
 * The validator writes the filled `filters_i18n.json` back to disk, plus a
 * `.js` copy, even when validation fails.
 *
 * Validation failures are logged, not thrown — check the return value.
 *
 * @param platformsPath Path to the built platform output.
 * @param options Validation options.
 * @returns `true` when all files are valid, `false` on validation failure.
 * @throws {Error} When `options` or `options.localesPath` is missing, when
 * `options.logPath` cannot be opened, or when a built JSON file cannot be
 * parsed.
 */
export function validateJSONSchema(
    platformsPath: string,
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
 * @param localesPath Path to the locales directory.
 * @param requiredLocales List of required locale codes.
 * @param logFormat Format of the returned `log` field: `'text'` (default)
 * or `'markdown'`.
 * @returns `{ ok: true }` when no problems are found; when warnings exist,
 * the result includes `data` and `log`, and `ok` is `false` only for
 * critical warnings.
 * @throws {Error} When the locales directory is missing or empty.
 */
export function validateLocales(
    localesPath: string,
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
