import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import { logger } from './utils/log';
import {
    ENTITY_KINDS,
    generateFiltersI18nSchema,
    getEntityIds,
    LOCALE_FIELDS,
} from './filters-i18n-schema';

const SCHEMA_EXTENSION = '.schema.json';
const OLD_MAC_V1_PLATFORM = 'mac';
const OLD_MAC_V2_PLATFORM = 'mac_v2';
const LEGACY_PLATFORMS = [OLD_MAC_V1_PLATFORM, OLD_MAC_V2_PLATFORM];

const FILTERS_METADATA_FILE_NAME = 'filters';
const FILTERS_I18N_FILE_NAME = 'filters_i18n';

const AJV_OPTIONS = {
    allErrors: true,
    useDefaults: true,
    // Keep `$ref` targets as separate compiled functions. The generated schema
    // shares one definition per entity between all locales, and inlining it
    // would copy the same subschema for every locale again.
    inlineRefs: false,
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
            const validationFileName = f.substr(0, f.indexOf(SCHEMA_EXTENSION));

            logger.info(`Loading schema for ${validationFileName}`);
            schemas[validationFileName] = JSON.parse(fs.readFileSync(path.join(dir, f)));
        }
    }

    return schemas;
};

/**
 * Resolves a local `$ref` in the generated filters_i18n schema.
 *
 * @param {object} schema Generated filters_i18n schema.
 * @param {object} node Schema node that may be a reference.
 * @returns {object} Resolved schema node.
 */
const resolveSchemaRef = (schema, node) => {
    if (!node || typeof node.$ref !== 'string') {
        return node;
    }

    const definitionName = node.$ref.replace('#/definitions/', '');
    return schema.definitions[definitionName];
};

/**
 * Logs every missing translation that Ajv will fill with an English fallback.
 *
 * @param {object} json Parsed filters_i18n.json.
 * @param {object} schema Generated filters_i18n schema.
 * @param {string} item Path to the validated file.
 */
const logAppliedDefaults = (json, schema, item) => {
    let count = 0;

    ENTITY_KINDS.forEach((kind) => {
        const kindSchema = schema.properties[kind];
        if (!kindSchema) {
            return;
        }

        Object.entries(kindSchema.properties).forEach(([id, idSchema]) => {
            const idData = json[kind] && json[kind][id];
            if (!idData) {
                return;
            }

            Object.entries(idSchema.properties).forEach(([locale, localeRef]) => {
                const localeData = idData[locale];
                if (!localeData) {
                    return;
                }

                const localeSchema = resolveSchemaRef(schema, localeRef);

                LOCALE_FIELDS.forEach((field) => {
                    if (localeData[field] !== undefined) {
                        return;
                    }

                    const fallback = localeSchema.properties[field].default;
                    const message = `Missing ${kind} ${id} ${field} for locale '${locale}' in ${item}. `
                        + `Using English fallback: "${fallback}"`;
                    logger.warn(message);
                    count += 1;
                });
            });
        });
    });

    if (count > 0) {
        logger.warn(`Applied ${count} English fallback(s) in ${item}`);
    }
};

/**
 * Reads the platform's filters.json metadata.
 *
 * @param {string} item Path to the filters_i18n.json file.
 * @returns {object} Parsed filters.json.
 * @throws {Error} If filters.json is missing, is not valid JSON, or has no
 * groups, tags, or filters array.
 */
const readFiltersMetadata = (item) => {
    const filtersMetadataPath = path.join(path.dirname(item), `${FILTERS_METADATA_FILE_NAME}.json`);

    if (!fs.existsSync(filtersMetadataPath)) {
        throw new Error(`${filtersMetadataPath} is missing`);
    }

    let filtersMetadata;

    try {
        filtersMetadata = JSON.parse(fs.readFileSync(filtersMetadataPath, 'utf8'));
    } catch (e) {
        throw new Error(`${filtersMetadataPath} is not valid JSON: ${e.message}`);
    }

    if (!filtersMetadata || ENTITY_KINDS.some((kind) => !Array.isArray(filtersMetadata[kind]))) {
        throw new Error(`${filtersMetadataPath} must contain groups, tags, and filters arrays`);
    }

    return filtersMetadata;
};

/**
 * Builds a cache key from the entity ids that the generated schema depends on.
 *
 * @param {object} filtersMetadata Parsed filters.json.
 * @returns {string} Cache key.
 */
const getI18nSchemaCacheKey = (filtersMetadata) => JSON.stringify(
    ENTITY_KINDS.map((kind) => getEntityIds(filtersMetadata, kind)),
);

/**
 * Returns the generated schema and its compiled validator for a
 * filters_i18n.json file.
 *
 * @param {string} item Path to the filters_i18n.json file.
 * @param {object} context Validation context.
 * @returns {{schema: object, validate: Function}|null} Schema and compiled
 * validator, or `null` when they cannot be prepared.
 */
const resolveI18nSchema = (item, context) => {
    const { validator, options, i18nValidators } = context;

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
        return {
            schema: cachedValidator.schema,
            validate: cachedValidator,
        };
    }

    try {
        const schema = generateFiltersI18nSchema({
            localesPath: options.localesPath,
            filtersMetadata,
            requiredLocales: options.requiredLocales,
        });
        const validate = validator.compile(schema);
        i18nValidators.set(cacheKey, validate);

        return { schema, validate };
    } catch (e) {
        logger.error(`Cannot generate filters_i18n schema for ${item}: ${e.message}`);
        return null;
    }
};

/**
 * Recursively validates dir content with provided schemas.
 *
 * `filtersRequiredAmount` is intentionally applied only to files directly
 * under the top-level directory. Platform metadata always lives in
 * subdirectories, so the threshold does not run per platform. This preserves
 * the historical behavior: a single global threshold would reject platforms
 * that legitimately build fewer filters (for example MV3 builds).
 *
 * @param {string} dir Directory to validate.
 * @param {object} context Validation context.
 * @param {number} [filtersRequiredAmount] Minimum number of filters for files
 * directly in `dir`.
 * @returns {boolean} Validation result.
 */
const validateDir = (dir, context, filtersRequiredAmount) => {
    const { validator, schemas, oldSchemas } = context;

    let items;
    try {
        items = fs.readdirSync(dir);
    } catch (e) {
        logger.info(e.message);
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
            const isLegacyPlatform = LEGACY_PLATFORMS.includes(platformName);
            let schema = schemas[fileName];
            let compiledValidator = null;

            // Validate legacy platforms with their frozen schemas
            if (isLegacyPlatform) {
                logger.info(`Look up old schemas for ${platformName} directory`);
                schema = oldSchemas[platformName][fileName];
            } else if (fileName === FILTERS_I18N_FILE_NAME) {
                const resolved = resolveI18nSchema(item, context);

                if (!resolved) {
                    return false;
                }

                schema = resolved.schema;
                compiledValidator = resolved.validate;
            }

            if (schema) {
                logger.info(`Validating ${item}`);

                const json = JSON.parse(fs.readFileSync(item));

                // Validate filters amount
                if (fileName === FILTERS_METADATA_FILE_NAME) {
                    if (json.filters.length < filtersRequiredAmount) {
                        logger.error(`Invalid filters amount in ${item}`);
                        return false;
                    }
                }

                if (!isLegacyPlatform && fileName === FILTERS_I18N_FILE_NAME) {
                    logAppliedDefaults(json, schema, item);
                }

                const validate = compiledValidator ?? validator.compile(schema);
                const valid = validate(json);

                // json can be updated with default values
                fs.writeFileSync(item, JSON.stringify(json, null, '\t'));

                // duplicate to .js file as well
                const jsFileName = `${fileName}.js`;
                fs.writeFileSync(
                    path.join(path.dirname(item), jsFileName),
                    JSON.stringify(json, null, '\t'),
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
 * @param filtersRequiredAmount - Minimum required amount of filters for files directly under platformsPath
 * @param options - Validation options
 * @param options.localesPath - Path to the locales directory
 * @param {string[]} [options.requiredLocales] - Locales that must be present for every entity
 * @param {string} [options.logPath] - Path to the validation log file; the file is appended to
 * and closed when validation finishes
 * @returns {boolean} Validation result
 * @throws {Error} If options or options.localesPath is missing, or if options.logPath cannot be opened
 */
const validate = (platformsPath, jsonSchemasConfigDir, filtersRequiredAmount, options) => {
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

        const oldSchemasMacV1 = loadSchemas(path.join(jsonSchemasConfigDir, OLD_MAC_V1_PLATFORM));
        const oldSchemasMacV2 = loadSchemas(path.join(jsonSchemasConfigDir, OLD_MAC_V2_PLATFORM));
        const oldSchemas = {
            [OLD_MAC_V1_PLATFORM]: oldSchemasMacV1,
            [OLD_MAC_V2_PLATFORM]: oldSchemasMacV2,
        };

        const context = {
            validator: new Ajv({ ...AJV_OPTIONS }),
            schemas,
            oldSchemas,
            options,
            i18nValidators: new Map(),
        };

        const result = validateDir(platformsPath, context, filtersRequiredAmount);

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
