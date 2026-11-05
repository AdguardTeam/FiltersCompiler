import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import { logger } from './utils/log';
import {
    buildFiltersI18nSchema,
    collectMissingFallbacks,
    getEntityIds,
    loadRegistryLocales,
} from './filters-i18n-schema';
import { ENTITY_KINDS } from './utils/locale-messages';
import { readJson } from './utils/read-json';
import { LEGACY_PLATFORM_PATHS } from './platforms-config';
import {
    FILTERS_I18N_METADATA_FILE_NAME,
    FILTERS_METADATA_FILE_JSON,
} from './utils/metadata-file-names';

const SCHEMA_EXTENSION = '.schema.json';

const AJV_OPTIONS = {
    allErrors: true,
    useDefaults: true,
    // Keep `$ref` targets as separate compiled functions. The generated schema
    // shares one definition per entity between all locales, and inlining it
    // would copy the same subschema for every locale again.
    inlineRefs: false,
    // A `required` list holds one entry per locale. For lists of at least this
    // size, a loop is faster and uses less memory than an unrolled check per
    // entry.
    loopRequired: 20,
};

/**
 * Loads all available schemas from dir
 *
 * @param {string} dir - The directory path containing the schema files.
 * @returns {Object} An object with keys - schema file names and values - parsed JSON schema objects.
 */
const loadSchemas = (dir) => {
    const schemas = {};

    const items = fs.readdirSync(dir);
    // eslint-disable-next-line no-restricted-syntax
    for (const f of items) {
        if (f.endsWith(SCHEMA_EXTENSION)) {
            const validationFileName = f.slice(0, -SCHEMA_EXTENSION.length);

            logger.info(`Loading schema for ${validationFileName}`);
            schemas[validationFileName] = JSON.parse(fs.readFileSync(path.join(dir, f)));
        }
    }

    return schemas;
};

/**
 * Logs every missing translation that Ajv will fill with an English fallback.
 *
 * @param {object} json Parsed filters_i18n.json.
 * @param {object} schema Generated filters_i18n schema.
 * @param {string} item Path to the validated file.
 */
const logAppliedDefaults = (json, schema, item) => {
    const fallbacks = collectMissingFallbacks(json, schema);

    fallbacks.forEach(({
        kind,
        id,
        locale,
        field,
        fallback,
    }) => {
        const message = `Missing ${kind} ${id} ${field} for locale '${locale}' in ${item}. `
            + `Using English fallback: "${fallback}"`;
        logger.warn(message);
    });

    if (fallbacks.length > 0) {
        logger.warn(`Applied ${fallbacks.length} English fallback(s) in ${item}`);
    }
};

/**
 * Reads the platform's filters.json metadata.
 *
 * Only the presence of the file needs a check here: `filters.json` is
 * validated separately against `filters.schema.json`, and a file that cannot
 * be parsed fails validation through `readJson()`.
 *
 * @param {string} item Path to the filters_i18n.json file.
 * @returns {object} Parsed filters.json.
 * @throws {Error} If filters.json is missing or is not valid JSON.
 */
const readFiltersMetadata = (item) => {
    const filtersMetadataPath = path.join(path.dirname(item), FILTERS_METADATA_FILE_JSON);

    if (!fs.existsSync(filtersMetadataPath)) {
        throw new Error(`${filtersMetadataPath} is missing`);
    }

    return readJson(filtersMetadataPath);
};

/**
 * Builds a cache key from the entity ids that the generated schema depends on.
 *
 * @param {object} filtersMetadata Parsed filters.json.
 * @returns {string} Cache key.
 */
const getI18nSchemaCacheKey = (filtersMetadata) => {
    return JSON.stringify(ENTITY_KINDS.map((kind) => getEntityIds(filtersMetadata, kind)));
};

/**
 * Returns the registry locale data for the current validation call.
 *
 * The data does not change during a call, so it is loaded once, lazily: a
 * tree with only legacy platforms never reads `localesPath` here.
 *
 * @param {object} context Validation context.
 * @returns {object} Loaded locale data.
 */
const getRegistryLocales = (context) => {
    if (!context.registryLocales) {
        context.registryLocales = loadRegistryLocales(
            context.options.localesPath,
            context.options.requiredLocales,
        );
    }

    return context.registryLocales;
};

/**
 * Returns the compiled validator for a filters_i18n.json file.
 *
 * @param {string} item Path to the filters_i18n.json file.
 * @param {object} context Validation context.
 * @returns {Function|null} Compiled validator, or `null` when it cannot be
 * prepared. The validator keeps the generated schema in its `schema` property.
 */
const resolveI18nValidator = (item, context) => {
    const { validator, i18nValidators } = context;

    let filtersMetadata;
    let cacheKey;

    try {
        filtersMetadata = readFiltersMetadata(item);
        cacheKey = getI18nSchemaCacheKey(filtersMetadata);
    } catch (e) {
        logger.error(`Cannot read filters metadata for ${item}: ${e.message}`);
        return null;
    }

    const cachedValidator = i18nValidators.get(cacheKey);

    if (cachedValidator) {
        return cachedValidator;
    }

    try {
        const schema = buildFiltersI18nSchema({
            filtersMetadata,
            registryLocales: getRegistryLocales(context),
        });
        const compiledValidator = validator.compile(schema);
        i18nValidators.set(cacheKey, compiledValidator);

        return compiledValidator;
    } catch (e) {
        logger.error(`Cannot generate filters_i18n schema for ${item}: ${e.message}`);
        return null;
    }
};

/**
 * Recursively validates dir content with provided schemas.
 *
 * @param {string} dir Directory to validate.
 * @param {object} context Validation context.
 * @returns {boolean} Validation result.
 */
const validateDir = (dir, context) => {
    const { validator, schemas, oldSchemas } = context;

    let items;
    try {
        items = fs.readdirSync(dir);
    } catch (e) {
        logger.error(e.message);
        return false;
    }
    // eslint-disable-next-line no-restricted-syntax
    for (const f of items) {
        const item = path.join(dir, f);
        if (fs.lstatSync(item).isDirectory()) {
            if (!validateDir(item, context)) {
                return false;
            }
        } else {
            const fileName = path.basename(item, '.json');
            const platformName = path.basename(path.dirname(item));
            const isLegacyPlatform = LEGACY_PLATFORM_PATHS.includes(platformName);
            let schema = schemas[fileName];
            let compiledValidator = null;

            // Validate legacy platforms with their frozen schemas
            if (isLegacyPlatform) {
                logger.info(`Look up old schemas for ${platformName} directory`);
                schema = oldSchemas[platformName][fileName];
            } else if (fileName === FILTERS_I18N_METADATA_FILE_NAME) {
                compiledValidator = resolveI18nValidator(item, context);

                if (!compiledValidator) {
                    return false;
                }

                schema = compiledValidator.schema;
            }

            if (schema) {
                logger.info(`Validating ${item}`);

                const json = readJson(item);

                if (compiledValidator) {
                    logAppliedDefaults(json, compiledValidator.schema, item);
                }

                const validate = compiledValidator ?? validator.compile(schema);
                const valid = validate(json);

                // json can be updated with default values
                const content = JSON.stringify(json, null, '\t');

                fs.writeFileSync(item, content);

                // duplicate to .js file as well
                const jsFileName = `${fileName}.js`;
                fs.writeFileSync(
                    path.join(path.dirname(item), jsFileName),
                    content,
                );

                if (!valid) {
                    logger.error(`Invalid json in ${item}, errors:`);
                    logger.error(validate.errors);
                    return false;
                }
            }
        }
    }

    return true;
};

/**
 * Validates json schemas for all the filters.json and filters_i18n.json found in platforms path
 *
 * @param platformsPath - Path to platforms folder
 * @param jsonSchemasConfigDir - Path to json schemas config folder
 * @param options - Validation options
 * @param options.localesPath - Path to the locales directory
 * @param {string[]} [options.requiredLocales] - Locales that must be present for every entity
 * @param {string} [options.logPath] - Path to the validation log file; the file is appended to
 * and closed when validation finishes
 * @returns {boolean} Validation result
 * @throws {Error} If options or options.localesPath is missing, options.logPath cannot be opened,
 * or a built JSON file cannot be parsed
 */
const validate = (platformsPath, jsonSchemasConfigDir, options) => {
    if (!options || !options.localesPath) {
        throw new Error('validateJSONSchema: options.localesPath is required');
    }

    const ownsLogFile = Boolean(options.logPath);

    if (ownsLogFile) {
        logger.initialize(options.logPath, true);
    } else {
        // Do not reuse a log file opened by a previous call: without
        // `logPath`, messages belong to the console only.
        logger.close();
    }

    try {
        logger.info('Validating json schemas for platforms');

        const schemas = loadSchemas(jsonSchemasConfigDir);

        const oldSchemas = Object.fromEntries(
            LEGACY_PLATFORM_PATHS.map((platformPath) => [
                platformPath,
                loadSchemas(path.join(jsonSchemasConfigDir, platformPath)),
            ]),
        );

        const context = {
            validator: new Ajv(AJV_OPTIONS),
            schemas,
            oldSchemas,
            options,
            i18nValidators: new Map(),
            registryLocales: null,
        };

        const result = validateDir(platformsPath, context);

        logger.info('Validating json schemas for platforms - done');
        logger.info(`Validation result: ${result}`);

        return result;
    } finally {
        if (ownsLogFile) {
            logger.close();
        }
    }
};

export const schemaValidator = { validate };
