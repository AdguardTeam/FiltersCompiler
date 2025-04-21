/* eslint-disable global-require */
module.exports = (() => {
    const logger = require('./utils/log');

    const fs = require('fs');
    const path = require('path');
    const Ajv = require('ajv');

    const SCHEMA_EXTENSION = '.schema.json';

    const OLD_MAC_V1_PLATFORM = 'mac';
    const OLD_MAC_V2_PLATFORM = 'mac_v2';

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

                // Validate `mac` (mac v1) dir with old schemas
                if (path.basename(path.dirname(item)) === OLD_MAC_V1_PLATFORM) {
                    logger.log('Look up old schemas for mac directory');
                    schema = oldSchemas[OLD_MAC_V1_PLATFORM][fileName];
                }

                // Validate `mac_v2` dir with old schemas
                if (path.basename(path.dirname(item)) === OLD_MAC_V2_PLATFORM) {
                    logger.log('Look up old schemas for mac_v2 directory');
                    schema = oldSchemas[OLD_MAC_V2_PLATFORM][fileName];
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
     * @param platformsPath
     * @param jsonSchemasConfigDir
     * @param filtersRequiredAmount
     */
    const validate = (platformsPath, jsonSchemasConfigDir, filtersRequiredAmount) => {
        logger.info('Validating json schemas for platforms');

        const schemas = loadSchemas(jsonSchemasConfigDir);

        const oldSchemasMacV1 = loadSchemas(path.join(jsonSchemasConfigDir, OLD_MAC_V1_PLATFORM));
        const oldSchemasMacV2 = loadSchemas(path.join(jsonSchemasConfigDir, OLD_MAC_V2_PLATFORM));
        const oldSchemas = {
            [OLD_MAC_V1_PLATFORM]: oldSchemasMacV1,
            [OLD_MAC_V2_PLATFORM]: oldSchemasMacV2,
        };

        const ajv = new Ajv({
            allErrors: true,
            useDefaults: true,
        });

        const result = validateDir(platformsPath, ajv, schemas, oldSchemas, filtersRequiredAmount);

        logger.info('Validating json schemas for platforms - done');
        logger.info(`Validation result: ${result}`);

        return result;
    };

    return {
        validate,
    };
})();
