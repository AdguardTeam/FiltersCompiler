/* eslint-disable global-require */
module.exports = (() => {
    const logger = require('./utils/log');

    const fs = require('fs');
    const path = require('path');
    const Ajv = require('ajv');

    const OLD_MAC_SCHEMAS_SUBDIR = 'mac';
    const SCHEMA_EXTENSION = '.schema.json';

    const OLD_MAC_PLATFORMS_DIR = 'mac';

    /**
     * Loads all available schemas from dir
     *
     * @param dir
     * @returns {{}}
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
     * Recursively validates dir content with provided schemas
     *
     * @param dir
     * @param validator
     * @param schemas
     * @param oldSchemas
     * @param filtersRequiredAmount
     * @returns {boolean}
     */
    const validateDir = (dir, validator, schemas, oldSchemas, filtersRequiredAmount) => {
        let items;
        try {
            items = fs.readdirSync(dir);
        } catch (e) {
            logger.log(e.message);
            return false;
        }
        // eslint-disable-next-line no-restricted-syntax
        for (const f of items) {
            const item = path.join(dir, f);
            if (fs.lstatSync(item).isDirectory()) {
                if (!validateDir(item, validator, schemas, oldSchemas)) {
                    return false;
                }
            } else {
                const fileName = path.basename(item, '.json');
                let schema = schemas[fileName];

                // Validate mac dir with old schemas
                if (path.basename(path.dirname(item)) === OLD_MAC_PLATFORMS_DIR) {
                    logger.log('Look up old schemas for mac directory');
                    schema = oldSchemas[fileName];
                }

                if (schema) {
                    logger.info(`Validating ${item}`);

                    const json = JSON.parse(fs.readFileSync(item));

                    // Validate filters amount
                    if (fileName === 'filters') {
                        if (json.filters.length < filtersRequiredAmount) {
                            logger.error(`Invalid filters amount in ${item}`);
                            return false;
                        }
                    }

                    const validate = validator.compile(schema);
                    const valid = validate(json);
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
     * @param platformsPath
     * @param jsonSchemasConfigDir
     * @param filtersRequiredAmount
     */
    const validate = (platformsPath, jsonSchemasConfigDir, filtersRequiredAmount) => {
        logger.info('Validating json schemas for platforms');

        const schemas = loadSchemas(jsonSchemasConfigDir);
        const oldSchemas = loadSchemas(path.join(jsonSchemasConfigDir, OLD_MAC_SCHEMAS_SUBDIR));

        const ajv = new Ajv();

        const result = validateDir(platformsPath, ajv, schemas, oldSchemas, filtersRequiredAmount);

        logger.info('Validating json schemas for platforms - done');
        logger.info(`Validation result: ${result}`);

        return result;
    };

    return {
        validate,
    };
})();
