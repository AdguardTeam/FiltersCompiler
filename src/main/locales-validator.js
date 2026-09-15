/* eslint-disable global-require */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './utils/log';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Each filter, group, tag should have two keys.
 */
const REQUIRED_ENDINGS = [
    'name',
    'description',
];

const LOCALES_FILE_EXTENSION = '.json';
const BASE_LOCALE = 'en';

const REQUIRED_FILES = [
    'filters',
    'groups',
    'tags',
].map((el) => `${el}${LOCALES_FILE_EXTENSION}`);

// each message key should consist of three parts
// e.g. 'filter.3.name' or 'tag.29.description'
const MESSAGE_KEY_NAME_PARTS_COUNT = 3;

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
    if (keys.length !== REQUIRED_ENDINGS.length) {
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
                || !(REQUIRED_ENDINGS.includes(keyNameParts[2]));
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
const prepareWarningDetails = (obj) => Object.entries(obj).map(([key, value]) => `"${key}": "${value}"`);

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
const prepareWarnings = (warnings) => warnings.map(([type, reason, details]) => ({ type, reason, details }));

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
 * Wraps a value in an inline-code span so it can be embedded in the generated
 * markdown safely. CRLF, CR and LF line endings are collapsed to a single
 * space, and the backtick delimiter run is one character longer than the
 * longest backtick run inside the value (backslash-escaping backticks does not
 * work: code span delimiters are matched literally), so translation content
 * cannot break out of the span.
 *
 * The value is padded with a space on each side only when needed:
 * - it starts or ends with a backtick, which could otherwise merge with the
 *   delimiter into a longer run;
 * - it starts and ends with a space while not consisting of spaces only,
 *   because CommonMark strips one leading and trailing space from code span
 *   content in that case.
 *
 * CommonMark strips at most one leading and trailing space, so the padding
 * never appears in the rendered output.
 * @param {string} value - the raw text to wrap into a code span
 * @returns {string} the inline-code span, safe to embed in the generated markdown
 */
const toCodeSpan = (value) => {
    const normalized = value.replace(/\r\n|\r|\n/g, ' ');
    const startsOrEndsWithBacktick = normalized.startsWith('`') || normalized.endsWith('`');
    const consistsOfSpacesOnly = normalized.replace(/ /g, '') === '';
    const startsAndEndsWithSpace = normalized.startsWith(' ')
        && normalized.endsWith(' ')
        && !consistsOfSpacesOnly;
    const needsPadding = startsOrEndsWithBacktick || startsAndEndsWithSpace;
    const padded = needsPadding ? ` ${normalized} ` : normalized;
    const backtickRuns = padded.match(/`+/g);
    const longestRun = backtickRuns
        ? backtickRuns.reduce((max, run) => Math.max(max, run.length), 0)
        : 0;
    const delimiter = '`'.repeat(longestRun + 1);
    return `${delimiter}${padded}${delimiter}`;
};

/**
 * Renders an indented detail line for the given format.
 * @param {string} detail - the detail text to render
 * @param {boolean} isMarkdown - whether to render markdown (true) or plain-text (false) markup
 * @returns {string} the formatted detail line
 */
const formatDetail = (detail, isMarkdown) => (isMarkdown
    ? `  - ${toCodeSpan(detail)}`
    : `      ${detail}`);

/**
 * Renders the header (locale) line for the given format.
 * @param {string} locale - the locale identifier to render
 * @param {boolean} isMarkdown - whether to render markdown (true) or plain-text (false) markup
 * @returns {string} the formatted locale header line
 */
const formatLocale = (locale, isMarkdown) => (isMarkdown
    ? `### ${toCodeSpan(locale)}`
    : `- ${locale}:`);

/**
 * Logs collected results of locales validation
 * @param {Result[]} results
 * @param {'text' | 'markdown'} format - output format: 'text' or 'markdown'
 * @returns {string} the rendered validation log
 */
const createLog = (results, format) => {
    const isMarkdown = format === 'markdown';

    const log = [];
    log.push(isMarkdown ? '## Locales validation issues' : 'There are issues with:');
    if (isMarkdown) {
        log.push('');
    }

    results.forEach((res) => {
        log.push(formatLocale(res.locale, isMarkdown));
        if (isMarkdown) {
            log.push('');
        }
        res.warnings.forEach((warning) => {
            // warning type and reason are fixed constants, only the details
            // come from translation content, so only the type is wrapped in a
            // code span and the reason stays plain bold text
            log.push(isMarkdown
                ? `- ${toCodeSpan(warning.type)} priority — **${warning.reason}**:`
                : `  - ${warning.type} priority - ${warning.reason}:`);
            warning.details.forEach((detail) => {
                log.push(formatDetail(detail, isMarkdown));
            });
            // insert a blank line after each warning to visually separate
            // markdown list entries; warnings without details are followed
            // directly by the next entry, keeping the list compact
            if (isMarkdown && warning.details.length > 0) {
                log.push('');
            }
        });
    });

    // drop the trailing blank line
    while (log[log.length - 1] === '') {
        log.pop();
    }

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
 * @param {string[]} requiredLocales locales required to be complete
 * @param {'text' | 'markdown'} [logFormat] format of the returned log: 'text' (default) or 'markdown'
 * @returns {ValidationResult}
 */
const validate = (dirPath, requiredLocales, logFormat = 'text') => {
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

    const baseLocaleKeysMap = getBaseLocaleKeys(dirPath);

    locales.forEach((locale) => {
        const localeWarnings = [];
        const filesList = readDir(path.join(dirPath, locale));
        // checks all needed files presence
        const missedFiles = REQUIRED_FILES
            .filter((el) => !filesList.includes(el));
        if (missedFiles.length !== 0) {
            localeWarnings.push([
                // if there are missedFiles, we consider it's critical
                WARNING_TYPES.CRITICAL,
                WARNING_REASONS.MISSED_FILES,
                missedFiles,
            ]);
        }

        const presentFiles = REQUIRED_FILES
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
    const resultsLog = createLog(results, logFormat);
    if (isOK) {
        logger.warn(resultsLog);
    } else {
        logger.error(resultsLog);
    }

    return { ok: isOK, data: results, log: resultsLog };
};

export const localesValidator = { validate };
