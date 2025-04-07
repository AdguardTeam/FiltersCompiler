const { SCHEMA_TYPES, STRING_PATTERN } = require('./constants');

/**
 * Creates a schema title based on the property name.
 *
 * @param {string} propName Property name.
 *
 * @returns {string} Formatted schema title.
 */
const createSchemaTitle = (propName) => {
    return `The ${propName.toUpperCase()} Schema`;
};

/**
 * @typedef {Object} PropertySchemaCreationData
 * @property {string} baseId The base $id path (e.g., "#/properties/groups/items/properties")
 * @property {string} propName The name of the property (e.g., "groupId")
 * @property {string} type The JSON schema type ("string", "integer", "boolean", "array")
 * @property {any} defaultValue The default value.
 * @property {any} example An example value.
 * @property {object} [extraProps={}] Any additional properties (like pattern, items).
 */

/**
 * Creates a base property schema object.
 *
 * @param {PropertySchemaCreationData} data Data for creating the schema.
 *
 * @returns {object} JSON schema definition for the property.
 */
const createPropertySchema = ({
    baseId,
    propName,
    type,
    defaultValue,
    example,
    extraProps = {},
}) => {
    const schema = {
        '$id': `${baseId}/${propName}`,
        type,
        title: createSchemaTitle(propName),
    };

    // Add default and examples only if they are not null/undefined
    // This avoids adding "default": null for types like array where it might not make sense
    if (defaultValue !== undefined && defaultValue !== null) {
        schema.default = defaultValue;
    }
    if (example !== undefined && example !== null) {
        schema.examples = [example];
    }

    return {
        ...schema,
        ...extraProps,
    };
};

/**
 * @typedef {Object} TypedPropertySchemaCreationData
 * @property {string} baseId The base $id path (e.g., "#/properties/groups/items/properties")
 * @property {string} propName The name of the property (e.g., "groupId")
 * @property {any} defaultValue The default value, may be undefined.
 * @property {any} example An example value.
 */

/**
 * Creates a string property schema object.
 *
 * @param {TypedPropertySchemaCreationData} data Data for creating the schema.
 *
 * @returns {object} JSON schema definition for the string property.
 */
const createStringPropertySchema = ({
    baseId,
    propName,
    defaultValue,
    example,
}) => {
    return createPropertySchema({
        baseId,
        propName,
        type: SCHEMA_TYPES.STRING,
        defaultValue: defaultValue || '',
        example,
        extraProps: {
            pattern: STRING_PATTERN,
        },
    });
};

/**
 * Creates an integer property schema object.
 *
 * @param {TypedPropertySchemaCreationData} data Data for creating the schema.
 *
 * @returns {object} JSON schema definition for the integer property.
 */
const createIntegerPropertySchema = ({ baseId, propName, example }) => {
    return createPropertySchema({
        baseId,
        propName,
        type: SCHEMA_TYPES.INTEGER,
        defaultValue: 0,
        example: example || 1,
    });
};

module.exports = {
    createSchemaTitle,
    createPropertySchema,
    createStringPropertySchema,
    createIntegerPropertySchema,
};
