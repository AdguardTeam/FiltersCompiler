/**
 * @file
 * Generates the JSON schema for AdGuard filters.json.
 */

const fs = require('fs');
const path = require('path');

const {
    SCHEMA_DRAFT,
    FILTERS_SCHEMA_ID,
    ROOT_DIR_RELATIVE_PATH,
    OUTPUT_SCHEMAS_DIR,
    GROUPS_KEY,
    TAGS_KEY,
    FILTERS_KEY,
    SCHEMA_TYPES,
    GROUP_ID_KEY,
    GROUP_NAME_KEY,
    GROUP_DESCRIPTION_KEY,
    DISPLAY_NUMBER_KEY,
    TAG_ID_KEY,
    KEYWORD_KEY,
    FILTER_ID_KEY,
    NAME_KEY,
    DESCRIPTION_KEY,
    TIME_ADDED_KEY,
    DEPRECATED_KEY,
    HOMEPAGE_KEY,
    EXPIRES_KEY,
    SUBSCRIPTION_URL_KEY,
    DOWNLOAD_URL_KEY,
    VERSION_KEY,
    TIME_UPDATED_KEY,
    LANGUAGES_KEY,
} = require('./constants');
const {
    createSchemaTitle,
    createIntegerPropertySchema,
    createStringPropertySchema,
    createPropertySchema,
} = require('./helpers');

/**
 * File name of the generated schema.
 */
const OUTPUT_FILE_NAME = 'filters.schema.json';

const outputFilePath = path.join(__dirname, ROOT_DIR_RELATIVE_PATH, OUTPUT_SCHEMAS_DIR, OUTPUT_FILE_NAME);

/**
 * @typedef {Object} ItemsObjectSchemaCreationData
 * @property {string} baseId The base $id path (e.g., "#/properties/groups")
 * @property {string[]} required Array of required field names within each item object.
 * @property {object} properties An object mapping field names to their generated schema definitions.
 */

/**
 * Creates the schema definition for the items within an array property.
 *
 * @param {ItemsObjectSchemaCreationData} data Data for creating the schema.
 *
 * @returns {object} JSON schema definition for the array items.
 */
const createItemsObjectSchema = ({
    baseId,
    required,
    properties,
}) => {
    return {
        '$id': `${baseId}/items`,
        type: SCHEMA_TYPES.OBJECT,
        title: 'The ITEMS Schema',
        required,
        properties,
    };
};

/**
 * Creates the schema definition for group properties.
 *
 * @returns {object} JSON schema definition for the group properties.
 */
const createGroupProperties = () => {
    const groupItemsBaseId = '#/properties/groups/items/properties';

    return {
        [GROUP_ID_KEY]: createIntegerPropertySchema({
            baseId: groupItemsBaseId,
            propName: GROUP_ID_KEY,
        }),
        [GROUP_NAME_KEY]: createStringPropertySchema({
            baseId: groupItemsBaseId,
            propName: GROUP_NAME_KEY,
            example: 'Ad Blocking',
        }),
        [GROUP_DESCRIPTION_KEY]: createStringPropertySchema({
            baseId: groupItemsBaseId,
            propName: GROUP_DESCRIPTION_KEY,
            example: 'Block ads',
        }),
        [DISPLAY_NUMBER_KEY]: createIntegerPropertySchema({
            baseId: groupItemsBaseId,
            propName: DISPLAY_NUMBER_KEY,
        }),
    };
};

/**
 * Creates the schema definition for groups.
 *
 * @returns {object} JSON schema definition for the groups.
 */
const getGroupsSchema = () => {
    const baseId = `#/properties/${GROUPS_KEY}`;

    return {
        '$id': baseId,
        type: SCHEMA_TYPES.ARRAY,
        title: createSchemaTitle(GROUPS_KEY),
        items: createItemsObjectSchema({
            baseId,
            required: [
                GROUP_ID_KEY,
                GROUP_NAME_KEY,
                GROUP_DESCRIPTION_KEY,
                DISPLAY_NUMBER_KEY,
            ],
            properties: createGroupProperties(),
        }),
    };
};

/**
 * Creates the schema definition for tag properties.
 * @returns {object} JSON schema definition for the tag properties.
 */
const createTagProperties = () => {
    const tagItemsBaseId = `#/properties/${TAGS_KEY}/items/properties`;

    return {
        [TAG_ID_KEY]: createIntegerPropertySchema({
            baseId: tagItemsBaseId,
            propName: TAG_ID_KEY,
        }),
        [KEYWORD_KEY]: createStringPropertySchema({
            baseId: tagItemsBaseId,
            propName: KEYWORD_KEY,
            example: 'purpose:ads',
        }),
    };
};

/**
 * Creates the schema definition for tags.
 *
 * @returns {object} JSON schema definition for the tags.
 */
const createTagsSchema = () => {
    const baseId = `#/properties/${TAGS_KEY}`;

    return {
        '$id': baseId,
        type: SCHEMA_TYPES.ARRAY,
        title: createSchemaTitle(TAGS_KEY),
        items: createItemsObjectSchema({
            baseId,
            required: [
                TAG_ID_KEY,
                KEYWORD_KEY,
            ],
            properties: createTagProperties(),
        }),
    };
};

/**
 * Creates the schema definition for filter properties.
 *
 * @returns {object} JSON schema definition for the filter properties.
 */
const createFilterProperties = () => {
    const filterItemsBaseId = '#/properties/filters/items/properties';

    return {
        [FILTER_ID_KEY]: createIntegerPropertySchema({
            baseId: filterItemsBaseId,
            propName: FILTER_ID_KEY,
            example: 101,
        }),
        [NAME_KEY]: createStringPropertySchema({
            baseId: filterItemsBaseId,
            propName: NAME_KEY,
            example: 'EasyList',
        }),
        [DESCRIPTION_KEY]: createStringPropertySchema({
            baseId: filterItemsBaseId,
            propName: DESCRIPTION_KEY,
            example: 'EasyList is the primary subscription that removes adverts from web pages in English language.',
        }),
        [TIME_ADDED_KEY]: createStringPropertySchema({
            baseId: filterItemsBaseId,
            propName: TIME_ADDED_KEY,
            example: '2014-06-30T10:56:55+0300',
        }),
        [DEPRECATED_KEY]: createPropertySchema({
            baseId: filterItemsBaseId,
            propName: DEPRECATED_KEY,
            type: SCHEMA_TYPES.BOOLEAN,
            defaultValue: false,
        }),
        [HOMEPAGE_KEY]: createStringPropertySchema({
            baseId: filterItemsBaseId,
            propName: HOMEPAGE_KEY,
            example: 'https://easylist.to/',
        }),
        [EXPIRES_KEY]: createIntegerPropertySchema({
            baseId: filterItemsBaseId,
            propName: EXPIRES_KEY,
            example: 172800,
        }),
        [DISPLAY_NUMBER_KEY]: createIntegerPropertySchema({
            baseId: filterItemsBaseId,
            propName: DISPLAY_NUMBER_KEY,
            example: 3,
        }),
        [GROUP_ID_KEY]: createIntegerPropertySchema({
            baseId: filterItemsBaseId,
            propName: GROUP_ID_KEY,
        }),
        [SUBSCRIPTION_URL_KEY]: createStringPropertySchema({
            baseId: filterItemsBaseId,
            propName: SUBSCRIPTION_URL_KEY,
            example: 'https://easylist.to/easylist/easylist.txt',
        }),
        [DOWNLOAD_URL_KEY]: createStringPropertySchema({
            baseId: filterItemsBaseId,
            propName: DOWNLOAD_URL_KEY,
            example: 'https://filters.adtidy.org/extension/safari/filters/1.txt',
        }),
        [VERSION_KEY]: createStringPropertySchema({
            baseId: filterItemsBaseId,
            propName: VERSION_KEY,
            example: '2.0.20.32',
        }),
        [TIME_UPDATED_KEY]: createStringPropertySchema({
            baseId: filterItemsBaseId,
            propName: TIME_UPDATED_KEY,
            example: '2018-12-04T16:00:16+0300',
        }),
        [LANGUAGES_KEY]: createPropertySchema({
            baseId: filterItemsBaseId,
            propName: LANGUAGES_KEY,
            type: SCHEMA_TYPES.ARRAY,
        }),
        [TAGS_KEY]: createPropertySchema({
            baseId: filterItemsBaseId,
            propName: TAGS_KEY,
            type: SCHEMA_TYPES.ARRAY,
            extraProps: {
                items: {
                    '$id': `${filterItemsBaseId}/tags/items`,
                    type: SCHEMA_TYPES.INTEGER,
                    title: 'The Items Schema',
                    default: 0,
                    examples: [1],
                },
            },
        }),
    };
};

/**
 * Creates the schema definition for filters.
 *
 * @returns {object} JSON schema definition for the filters.
 */
const createFiltersSchema = () => {
    const baseId = `#/properties/${FILTERS_KEY}`;

    return {
        '$id': baseId,
        type: SCHEMA_TYPES.ARRAY,
        title: createSchemaTitle(FILTERS_KEY),
        items: createItemsObjectSchema({
            baseId,
            required: [
                FILTER_ID_KEY,
                NAME_KEY,
                DESCRIPTION_KEY,
                TIME_ADDED_KEY,
                HOMEPAGE_KEY,
                EXPIRES_KEY,
                DISPLAY_NUMBER_KEY,
                GROUP_ID_KEY,
                SUBSCRIPTION_URL_KEY,
                DOWNLOAD_URL_KEY,
                VERSION_KEY,
                TIME_UPDATED_KEY,
                DEPRECATED_KEY,
                LANGUAGES_KEY,
                TAGS_KEY,
            ],
            properties: createFilterProperties(),
        }),
    };
};

/**
 * Generates the JSON schema for whole filters.json.
 */
const generateFiltersSchema = () => {
    const schema = {
        definitions: {},
        '$schema': SCHEMA_DRAFT,
        '$id': FILTERS_SCHEMA_ID,
        type: SCHEMA_TYPES.OBJECT,
        title: createSchemaTitle('root'),
        required: [
            GROUPS_KEY,
            TAGS_KEY,
            FILTERS_KEY,
        ],
        properties: {
            [GROUPS_KEY]: getGroupsSchema(),
            [TAGS_KEY]: createTagsSchema(),
            [FILTERS_KEY]: createFiltersSchema(),
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
    generateFiltersSchema,
};
