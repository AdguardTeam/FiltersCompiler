/* eslint-disable global-require */
module.exports = (() => {
    const fs = require('fs');
    const path = require('path');
    const logger = require('./utils/log.js');

    const FULL_REQUIRED_ENDINGS = ['name', 'description'];
    const ONLY_NAME_REQUIRED_ENDINGS = ['name'];
    const LOCALES_FILE_EXTENSION = '.json';

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

    /**
     * Sync reads file content
     * @param filePath - path to locales file
     */
    const readFile = function (filePath) {
        try {
            return fs.readFileSync(path.resolve(__dirname, filePath), { encoding: 'utf8' });
        } catch (e) {
            return null;
        }
    };

    /**
     * Sync reads directory content
     * @param dirPath - path to directory
     */
    const readDir = (dirPath) => {
        try {
            return fs.readdirSync(path.resolve(__dirname, dirPath), { encoding: 'utf8' });
        } catch (e) {
            return null;
        }
    };

    /**
     * Validates messages keys
     * @param {Array} keys locale messages keys
     * @param {string} id filters / groups / tags
     */
    const validateMessagesKeys = (keys, id) => {
        if (keys.length !== LOCALES_DATA[id].required.length) {
            return false;
        }
        const isValidKeys = keys.reduce((acc, key) => {
            const keyNameParts = key.split('.');
            const propPrefix = id.slice(0, -1);
            const filterId = Number(keyNameParts[1]);
            return keyNameParts.length === 3
                && keyNameParts[0] === propPrefix
                && Number.isInteger(filterId)
                && filterId > 0
                && LOCALES_DATA[id].required.includes(keyNameParts[2])
                && acc;
        }, true);

        return isValidKeys;
    };

    const isValidValues = (values) => values.every((v) => v !== '');

    /**
     * Formats output for invalid messages object
     * @param {string} locale
     * @param {Object} obj messages object
     */
    const formatElData = (locale, obj) => {
        const elData = [];
        elData.push(`${locale} -- invalid message key or no value:`);
        const keys = Object.keys(obj);
        keys.forEach((key) => {
            elData.push(`    "${key}": "${obj[key]}"`);
        });
        elData.push('');
        return elData.join('\n');
    };

    /**
     * Validates locales messages
     * @param {string} dirPath relative path to locales directory
     */
    const validate = (dirPath) => {
        logger.info('Validating locales...');
        const result = [];
        const locales = readDir(dirPath);
        const dataKeys = Object.keys(LOCALES_DATA);
        const requiredFilesList = dataKeys
            .map((el) => `${el}${LOCALES_FILE_EXTENSION}`);

        locales.forEach((locale) => {
            const filesList = readDir(path.join(dirPath, locale));
            // checks all needed files presence
            const filteredList = requiredFilesList
                .filter((el) => !filesList.includes(el));
            if (filteredList.length !== 0) {
                result.push(`${locale} -- missed files: ${filteredList.join(' ')}`);
                result.push('');
            }

            dataKeys.forEach((id) => {
                const fileName = `${id}${LOCALES_FILE_EXTENSION}`;
                const messagesPath = path.join(dirPath, locale, fileName);
                const messagesData = JSON.parse(readFile(messagesPath));
                // skip if no messagesData found, probably there is no file
                // and that should be written to 'result'
                if (messagesData === null) {
                    return;
                }
                messagesData.forEach((el) => {
                    const messagesKeys = Object.keys(el);
                    const messagesValues = Object.values(el);
                    const isValidKeys = validateMessagesKeys(messagesKeys, id);
                    if (!isValidKeys || !isValidValues(messagesValues)) {
                        result.push(formatElData(locale, el));
                    }
                });
            });
        });

        if (result.length === 0) {
            logger.info('Validation result: OK');
        } else {
            logger.error('There are issues with:');
            result.forEach((r) => {
                logger.error(r);
            });
        }
        return result;
    };

    return {
        validate,
    };
})();
