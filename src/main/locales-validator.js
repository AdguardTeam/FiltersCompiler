/* eslint-disable global-require */
module.exports = (() => {
    const fs = require('fs');
    const path = require('path');
    const logger = require('./utils/log.js');

    const FULL_REQUIRED_ENDINGS = ['name', 'description'];
    const ONLY_NAME_REQUIRED_ENDINGS = ['name'];
    const LOCALES_FILE_EXTENSION = '.json';
    const BASE_LOCALE = 'en';

    // each message key should consist of three parts
    // e.g. 'filter.3.name' or 'tag.29.description'
    const MESSAGE_KEY_NAME_PARTS_COUNT = 3;

    const LOCALES_DATA = {
        filters: {
            required: FULL_REQUIRED_ENDINGS,
        },
        groups: {
            required: ONLY_NAME_REQUIRED_ENDINGS,
        },
        tags: {
            required: FULL_REQUIRED_ENDINGS,
        },
    };

    const WARNING_REASONS = {
        MISSED_FILES: 'missed files',
        NO_MESSAGES: 'empty file or no messages in file',
        INVALID_DATA_OBJ: 'invalid or absent message key/value',
    };

    const WARNING_TYPES = {
        CRITICAL: 'critical',
        LOW: 'low',
    };

    /**
     * Sync reads file content
     * @param filePath - path to locales file
     */
    const readFile = (filePath) => fs.readFileSync(path.resolve(__dirname, filePath), 'utf8');

    /**
     * Sync reads directory content
     * @param dirPath - path to directory
     */
    const readDir = (dirPath) => fs.readdirSync(path.resolve(__dirname, dirPath), 'utf8');

    /**
     * Validates messages keys
     * @param {Array} keys locale messages keys
     * @param {string} id filters / groups / tags
     */
    const areValidMessagesKeys = (keys, id) => {
        if (keys.length !== LOCALES_DATA[id].required.length) {
            return false;
        }
        const areValidKeys = !keys
            .find((key) => {
                const keyNameParts = key.split('.');
                const propPrefix = id.slice(0, -1);
                const filterId = Number(keyNameParts[1]);
                return keyNameParts.length !== MESSAGE_KEY_NAME_PARTS_COUNT
                    || keyNameParts[0] !== propPrefix
                    || !(Number.isInteger(filterId))
                    || !(filterId > 0)
                    || !(LOCALES_DATA[id].required.includes(keyNameParts[2]));
            });
        return areValidKeys;
    };

    /**
     * Validates locale messages values
     * @param {string[]} values
     */
    const areValidMessagesValues = (values) => values.every((v) => v !== '');

    /**
     * Prepares invalid locales data object for results
     * @param {Object} obj iterable locales messages object
     * @returns {Array}
     */
    const prepareWarningDetails = (obj) => {
        const details = Object.keys(obj)
            .reduce((acc, key) => {
                acc.push(`"${key}": "${obj[key]}"`);
                return acc;
            }, []);
        return details;
    };

    /**
     * Returns map of base locale keys
     * @param dirPath
     */
    const getBaseLocaleKeys = (dirPath) => {
        const baseLocaleKeys = {};

        const baseLocalePath = path.join(dirPath, BASE_LOCALE);
        const baseLocaleFiles = readDir(baseLocalePath);

        baseLocaleFiles.forEach((fileName) => {
            const baseLocaleData = JSON.parse(readFile(path.join(baseLocalePath, fileName)));
            baseLocaleKeys[fileName] = baseLocaleData.flatMap((entry) => Object.keys(entry));
        });
        return baseLocaleKeys;
    };

    /**
     * Compares messagesData keys to base locale keys
     * @param baseLocaleKeys
     * @param messagesData
     * @param localeWarnings
     */
    const compareKeys = (baseLocaleKeys, messagesData, localeWarnings) => {
        const messagesDataKeys = messagesData.flatMap((entry) => Object.keys(entry));

        baseLocaleKeys.forEach((entry) => {
            if (!messagesDataKeys.includes(entry)) {
                localeWarnings.push([
                    WARNING_TYPES.CRITICAL,
                    WARNING_REASONS.INVALID_DATA_OBJ,
                    [entry],
                ]);
            }
        });
    };

    /**
     * Prepares raw warnings for results
     * @param {Array[]} warnings collected raw warnings
     * @returns {Warning[]}
     */
    const prepareWarnings = (warnings) => {
        const output = warnings
            .reduce((acc, data) => {
                const [type, reason, details] = data;
                acc.push({ type, reason, details });
                return acc;
            }, []);
        return output;
    };

    /**
     * @typedef {Object} Warning
     * @property {string} type
     * @property {string} reason
     * @property {string[]} details
     */

    /**
     * @typedef {Object} Result
     * @property {string} locale
     * @property {Warning[]} warnings
     */

    /**
     * Logs collected results of locales validation
     * @param {Result[]} results
     * @returns {string}
     */
    const createLog = (results) => {
        const log = [];
        log.push('There are issues with:');
        results.forEach((res) => {
            log.push(`- ${res.locale}:`);
            res.warnings.forEach((warning) => {
                log.push(`  - ${warning.type} priority - ${warning.reason}:`);
                warning.details.forEach((detail) => {
                    log.push(`      ${detail}`);
                });
            });
        });
        return log.join('\n');
    };

    /**
     * @typedef {Object} ValidationResult
     * @property {boolean} ok
     * @property {Result[]} data
     * @property {string} log
     */

    /**
     * Validates locales messages
     * @param {string} dirPath relative path to locales directory
     * @returns {ValidationResult}
     */
    const validate = (dirPath, requiredLocales) => {
        logger.info('Validating locales...');
        const results = [];
        let locales;
        try {
            locales = readDir(dirPath);
        } catch (e) {
            throw new Error(`There is no locales dir '${dirPath}'`);
        }

        if (locales.length === 0) {
            throw new Error(`Locales dir '${dirPath}' is empty`);
        }

        const requiredFiles = Object.keys(LOCALES_DATA)
            .map((el) => `${el}${LOCALES_FILE_EXTENSION}`);

        const baseLocaleKeysMap = getBaseLocaleKeys(dirPath);

        locales.forEach((locale) => {
            const localeWarnings = [];
            const filesList = readDir(path.join(dirPath, locale));
            // checks all needed files presence
            const missedFiles = requiredFiles
                .filter((el) => !filesList.includes(el));
            if (missedFiles.length !== 0) {
                localeWarnings.push([
                    // if there are missedFiles, we consider it's critical
                    WARNING_TYPES.CRITICAL,
                    WARNING_REASONS.MISSED_FILES,
                    missedFiles,
                ]);
            }

            const presentFiles = requiredFiles
                .filter((el) => !missedFiles.includes(el));

            // iterate over existent files
            presentFiles.forEach((fileName) => {
                const messagesPath = path.join(dirPath, locale, fileName);
                let messagesData;
                try {
                    messagesData = JSON.parse(readFile(messagesPath));
                } catch (e) {
                    localeWarnings.push([
                        // if there is invalid data format, we consider it's critical
                        WARNING_TYPES.CRITICAL,
                        WARNING_REASONS.NO_MESSAGES,
                        [fileName],
                    ]);
                    return;
                }

                if (messagesData.length === 0) {
                    // for some locales there is no translations
                    // so it should bt critical only for required (our) locales
                    const warningType = requiredLocales.includes(locale)
                        ? WARNING_TYPES.CRITICAL
                        : WARNING_TYPES.LOW;
                    localeWarnings.push([
                        warningType,
                        WARNING_REASONS.NO_MESSAGES,
                        [fileName],
                    ]);
                }

                if (requiredLocales.includes(locale)) {
                    // check if all keys from base locale are presented in messagesData
                    compareKeys(baseLocaleKeysMap[fileName], messagesData, localeWarnings);
                }

                messagesData.forEach((obj) => {
                    const messagesKeys = Object.keys(obj);
                    const messagesValues = Object.values(obj);
                    const extensionLength = LOCALES_FILE_EXTENSION.length;
                    const id = fileName.slice(0, -extensionLength);
                    if (!areValidMessagesKeys(messagesKeys, id)
                        || !areValidMessagesValues(messagesValues)) {
                        localeWarnings.push([
                            // invalid messages data object is always critical
                            WARNING_TYPES.CRITICAL,
                            WARNING_REASONS.INVALID_DATA_OBJ,
                            prepareWarningDetails(obj),
                        ]);
                    }
                });
            });

            if (localeWarnings.length !== 0) {
                const warnings = prepareWarnings(localeWarnings);
                results.push({ locale, warnings });
            }
        });

        if (results.length === 0) {
            logger.info('Validation result: OK');
            return { ok: true };
        }

        const isOK = !results
            .some((res) => {
                const isCriticalWarning = res.warnings
                    .some((warning) => warning.type === WARNING_TYPES.CRITICAL);
                return isCriticalWarning;
            });
        const resultsLog = createLog(results);
        if (isOK) {
            logger.warn(resultsLog);
        } else {
            logger.error(resultsLog);
        }

        return { ok: isOK, data: results, log: resultsLog };
    };

    return {
        validate,
    };
})();
