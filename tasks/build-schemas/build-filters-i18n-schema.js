/**
 * @file
 * Generates the JSON schema for AdGuard filters_i18n.json.
 */

const fs = require('fs');
const path = require('path');

const {
    FILTER_IDS,
    GROUP_IDS,
    SCHEMA_DRAFT,
    FILTERS_I18N_SCHEMA_ID,
    SUPPORTED_LOCALES,
    TAG_IDS,
    ROOT_DIR_RELATIVE_PATH,
    OUTPUT_SCHEMAS_DIR,
    REQUIRED_FIELDS_PER_LOCALE,
    GROUPS_KEY,
    TAGS_KEY,
    FILTERS_KEY,
    SCHEMA_TYPES,
} = require('./constants');

const { createSchemaTitle, createStringPropertySchema } = require('./helpers');

/**
 * File name of the generated schema.
 */
const OUTPUT_FILE_NAME = 'filters_i18n.schema.json';

const outputFilePath = path.join(__dirname, ROOT_DIR_RELATIVE_PATH, OUTPUT_SCHEMAS_DIR, OUTPUT_FILE_NAME);

/**
 * Creates the schema definition for a specific language within a group/tag/filter item.
 *
 * @param {string} baseId The base $id path (e.g., "#/properties/groups/properties/1")
 * @param {string} localeCode The language code (e.g., "ar")
 * @param {string[]} requiredFields Array of required field names (e.g., ["name"] or ["name", "description"])
 *
 * @returns {object} JSON schema definition for the language object.
 */
const createLocaleObject = (baseId, localeCode) => {
    const langObjectId = `${baseId}/properties/${localeCode}`;

    const properties = {};

    REQUIRED_FIELDS_PER_LOCALE.forEach((field) => {
        properties[field] = createStringPropertySchema({
            baseId: `${baseId}/properties`,
            propName: field,
        });
    });

    return {
        '$id': langObjectId,
        type: SCHEMA_TYPES.OBJECT,
        title: createSchemaTitle(localeCode),
        required: REQUIRED_FIELDS_PER_LOCALE,
        properties,
    };
};

/**
 * Creates the schema definition for a specific numeric ID within groups/tags/filters.
 *
 * @param {string} basePath The base path like "#/properties/groups"
 * @param {string} id The numeric ID string (e.g., "1")
 *
 * @returns {object} JSON schema definition for the ID object.
 */
const createIdObject = (basePath, id) => {
    const idObjectPath = `${basePath}/properties/${id}`;

    const properties = {};

    SUPPORTED_LOCALES.forEach((langCode) => {
        properties[langCode] = createLocaleObject(idObjectPath, langCode);
    });

    return {
        '$id': idObjectPath,
        type: SCHEMA_TYPES.OBJECT,
        title: createSchemaTitle(id),
        required: SUPPORTED_LOCALES,
        properties,
    };
};

/**
 * Creates the schema definition for top-level properties (groups, tags, filters).
 *
 * @param {string} propertyName "groups", "tags", or "filters"
 * @param {string[]} requiredIds Array of required numeric ID strings.
 *
 * @returns {object} JSON schema definition for the top-level property.
 */
const createTopLevelProperty = (
    propertyName,
    requiredIds,
) => {
    const basePath = `#/properties/${propertyName}`;

    const properties = {};

    requiredIds.forEach((id) => {
        properties[id] = createIdObject(
            basePath,
            id.toString(),
        );
    });

    return {
        '$id': basePath,
        type: SCHEMA_TYPES.OBJECT,
        title: createSchemaTitle(propertyName),
        required: requiredIds.map((id) => id.toString()),
        properties,
    };
};

/**
 * Generates the JSON schema for filters_i18n.json.
 */
const generateFiltersI18nSchema = () => {
    const schema = {
        definitions: {},
        '$schema': SCHEMA_DRAFT,
        '$id': FILTERS_I18N_SCHEMA_ID,
        type: SCHEMA_TYPES.OBJECT,
        title: createSchemaTitle('root'),
        required: [
            GROUPS_KEY,
            TAGS_KEY,
            FILTERS_KEY,
        ],
        properties: {
            [GROUPS_KEY]: createTopLevelProperty(
                GROUPS_KEY,
                GROUP_IDS,
            ),
            [TAGS_KEY]: createTopLevelProperty(
                TAGS_KEY,
                TAG_IDS,
            ),
            [FILTERS_KEY]: createTopLevelProperty(
                FILTERS_KEY,
                FILTER_IDS,
            ),
        },
    };

    try {
        fs.writeFileSync(outputFilePath, JSON.stringify(schema, null, 2), 'utf8');
        // eslint-disable-next-line no-console
        console.log(`Schema successfully written to ${outputFilePath}`);
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Error writing schema to ${outputFilePath}:`, error);
    }
};

module.exports = {
    generateFiltersI18nSchema,
};
