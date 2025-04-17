/**
 * @file
 * Generates the JSON schema for AdGuard filters_i18n.json.
 */

const fs = require('fs');
const path = require('path');

const {
    SCHEMA_DRAFT,
    FILTERS_I18N_SCHEMA_ID,
    SUPPORTED_LOCALES,
    ROOT_DIR_RELATIVE_PATH,
    OUTPUT_SCHEMAS_DIR,
    REQUIRED_FIELDS_PER_LOCALE,
    GROUPS_KEY,
    TAGS_KEY,
    FILTERS_KEY,
    SCHEMA_TYPES,
} = require('./constants');

const { createSchemaTitle, createStringPropertySchema } = require('./helpers');
const { GROUPS_DEFAULT_DATA, FILTERS_DEFAULT_DATA, TAGS_DEFAULT_DATA } = require('./filters-i18n-defaults');

const NON_REQUIRED_FILTER_IDS = [
    // AdGuard Annoyances filter is deprecated
    // https://github.com/AdguardTeam/FiltersRegistry/blob/master/filters/filter_14_Annoyances/metadata.json
    14,
    // AdGuard DNS filter is deprecated
    // https://github.com/AdguardTeam/FiltersRegistry/blob/master/filters/filter_15_DnsFilter/metadata.json
    15,
    // AdGuard URL Tracking filter is not supported by all platforms
    // https://github.com/AdguardTeam/FiltersRegistry/blob/master/filters/filter_17_TrackParam/metadata.json
    17,
];

/**
 * File name of the generated schema.
 */
const OUTPUT_FILE_NAME = 'filters_i18n.schema.json';

const outputFilePath = path.join(__dirname, ROOT_DIR_RELATIVE_PATH, OUTPUT_SCHEMAS_DIR, OUTPUT_FILE_NAME);

/**
 * Creates the schema definition for a specific language within a group/tag/filter item.
 *
 * @param {string} baseId The base $id path, e.g., `#/properties/groups/properties/1`
 * @param {string} localeCode The language code, e.g., `ar`
 * @param {object} defaultDataItem The default data object for the language,
 * e.g., `{ name: 'Language-specific', description: 'Block ads on websites in specified languages' }
 *
 * @returns {object} JSON schema definition for the language object.
 */
const createLocaleObject = (baseId, localeCode, defaultDataItem) => {
    const langObjectId = `${baseId}/properties/${localeCode}`;

    const properties = {};

    REQUIRED_FIELDS_PER_LOCALE.forEach((field) => {
        properties[field] = createStringPropertySchema({
            baseId: `${baseId}/${localeCode}/properties`,
            propName: field,
            defaultValue: defaultDataItem[field],
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
 * @param {object} defaultDataItem The default data object for the ID.
 *
 * @returns {object} JSON schema definition for the ID object.
 */
const createIdObject = (basePath, id, defaultDataItem) => {
    const idObjectPath = `${basePath}/properties/${id}`;

    const properties = {};

    SUPPORTED_LOCALES.forEach((langCode) => {
        properties[langCode] = createLocaleObject(idObjectPath, langCode, defaultDataItem);
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
 * @param {object} defaultData Default data for the property (e.g., GROUPS_DEFAULT_DATA)
 * where keys are ids and values are the default data objects for `name` and `description`.
 * @param {number[]} nonRequiredIds Array of IDs that should not be required,
 * e.g. some filters are deprecated now (14, 15) or not supported by all platforms (17).
 *
 * @returns {object} JSON schema definition for the top-level property.
 */
const createTopLevelProperty = (
    propertyName,
    defaultData,
    nonRequiredIds = [],
) => {
    const basePath = `#/properties/${propertyName}`;

    const properties = {};

    const allIds = Object.keys(defaultData);

    const requiredIds = allIds.filter((id) => {
        const idNum = parseInt(id, 10);
        return !nonRequiredIds.includes(idNum);
    });

    allIds.forEach((id) => {
        const defaultDataItem = defaultData[id];
        properties[id] = createIdObject(
            basePath,
            id.toString(),
            defaultDataItem,
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

const createTopLevelGroupsProperty = () => {
    return createTopLevelProperty(
        GROUPS_KEY,
        GROUPS_DEFAULT_DATA,
    );
};

const createTopLevelTagsProperty = () => {
    return createTopLevelProperty(
        TAGS_KEY,
        TAGS_DEFAULT_DATA,
    );
};

const createTopLevelFiltersProperty = () => {
    return createTopLevelProperty(
        FILTERS_KEY,
        FILTERS_DEFAULT_DATA,
        NON_REQUIRED_FILTER_IDS,
    );
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
            [GROUPS_KEY]: createTopLevelGroupsProperty(),
            [TAGS_KEY]: createTopLevelTagsProperty(),
            [FILTERS_KEY]: createTopLevelFiltersProperty(),
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
