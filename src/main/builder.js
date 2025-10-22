/* eslint-disable global-require */

import fs from 'fs';
import path from 'path';
import md5 from 'md5';

import { FiltersDownloader } from '@adguard/filters-downloader';
import { version } from './utils/version';
import { convertRulesToAdgSyntax } from './converter';
import { validateAndFilterRules, checkAffinityDirectives } from './validator';
import { init, generate } from './platforms/generator';
import { logger } from './utils/log';
import { skipFilter, addFilter, create } from './utils/report';
import { RuleMasks } from './rule/rule-masks';
import { fixVersionComments, removeAdblockVersion } from './utils/workaround';
import { downloadFile } from './utils/webutils';
import { getFilterIdFromDirName } from './utils/utils';
import { optimizeDomainBlockingRules } from './utils/builder-utils';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const TEMPLATE_FILE = 'template.txt';
const FILTER_FILE = 'filter.txt';
const REVISION_FILE = 'revision.json';
const EXCLUDE_FILE = 'exclude.txt';
const EXCLUDED_LINES_FILE = 'diff.txt';
const METADATA_FILE = 'metadata.json';
const ADGUARD_FILTERS_SERVER_URL = 'https://filters.adtidy.org/';
const TRUST_LEVEL_DIR = './utils/trust-levels';
const DEFAULT_TRUST_LEVEL = 'low';

const SPACE = ' ';
const SLASH = '/';
const COMMA = ',';
const EQUAL_SIGN = '=';
const MODIFIERS_SEPARATOR = '$';
const INCLUDE_DIRECTIVE = '@include ';
const STRIP_COMMENTS_OPTION = 'stripComments';
const OPTIMIZE_DOMAIN_BLOCKING_RULES = 'optimizeDomainBlockingRules';
const NOT_OPTIMIZED_OPTION = 'notOptimized';
const EXCLUDE_OPTION = 'exclude';
const ADD_MODIFIERS_OPTION = 'addModifiers';
const IGNORE_TRUST_LEVEL_OPTION = 'ignoreTrustLevel';

const NOT_OPTIMIZED_HINT = '!+ NOT_OPTIMIZED';

/**
 * Filter header tag for diff path which is needed for patch updates.
 */
const DIFF_PATH_TAG = 'Diff-Path:';

// TODO: Move include directive option functions to utils/builder-utils.js

/**
 * Sync reads file content
 *
 * @param path
 * @returns {*}
 */
const readFile = function (path) {
    if (!fs.existsSync(path)) {
        return null;
    }

    return fs.readFileSync(path, { encoding: 'utf-8' });
};

/**
 * Sync writes content to file
 *
 * @param path
 * @param data
 */
const writeFile = function (path, data) {
    fs.writeFileSync(path, data, 'utf8');
};

/**
 * Splits lines
 *
 * @param string
 */
const splitLines = function (string) {
    return string.split(/\r?\n/);
};

/**
 * Removes comments from lines
 *
 * @param lines
 */
const stripComments = function (lines) {
    logger.info('Stripping comments..');

    return lines.filter((line, pos) => {
        if (pos > 0 && lines[pos - 1].startsWith(RuleMasks.MASK_HINT)) {
            return true;
        }

        if (
            line.startsWith(RuleMasks.MASK_HINT)
            || line.startsWith(RuleMasks.MASK_DIRECTIVES)
        ) {
            return true;
        }

        return !line.startsWith(RuleMasks.MASK_COMMENT);
    });
};

/**
 * Adds not optimized hints
 *
 * @param lines
 */
const addNotOptimizedHints = function (lines) {
    logger.info('Adding hints..');

    const result = [];

    lines.forEach((v) => {
        if (!v) {
            return;
        }

        if (!v.startsWith(RuleMasks.MASK_COMMENT) && !v.startsWith(`${RuleMasks.MASK_HINT}${SPACE}`)) {
            result.push(NOT_OPTIMIZED_HINT);
        }

        result.push(v);
    });

    return result;
};
/**
 * Adds or updates modifiers in each line of the given array of lines.
 *
 * @param {string[]} lines - An array of text lines.
 * @param {string} modifiersStr - Modifiers as a string to add.
 * @returns {string[]} - An array of modified lines.
 */
const addModifiers = (lines, modifiersStr) => {
    return lines.map((line) => {
        // If the line is empty or contains only whitespace, it returns a comment mask
        if (!line || line.trim() === '') {
            return RuleMasks.MASK_COMMENT;
        }
        // If the line starts with a host file comment mask, it replaces it with a comment mask
        if (line.startsWith(RuleMasks.MASK_HOST_FILE_COMMENT)) {
            return line.replace(RuleMasks.MASK_HOST_FILE_COMMENT, RuleMasks.MASK_COMMENT);
        }
        // If the line starts with a comment mask, it returns the line as is.
        if (line.startsWith(RuleMasks.MASK_COMMENT)) {
            return line;
        }
        // If the line does not contain a modifiers separator, it appends the given modifiers string
        if (!line.includes(MODIFIERS_SEPARATOR)) {
            return `${line}${MODIFIERS_SEPARATOR}${modifiersStr}`;
        }
        // If the line already contains modifiers, combine the existing modifiers with the new ones,
        // ensuring no duplicates, and return the line with the updated modifiers.
        const [rule, existingModifiersStr] = line.split(MODIFIERS_SEPARATOR);
        const existingModifiers = existingModifiersStr.split(COMMA);
        const newModifiers = modifiersStr.split(COMMA);
        const combinedModifiers = [...new Set([...existingModifiers, ...newModifiers])].join(COMMA);

        return `${rule}${MODIFIERS_SEPARATOR}${combinedModifiers}`;
    });
};

/**
 * Checks case when '#%#' rules are excluded to DON'T exclude '#%#//scriptlet' rules
 *
 * @param {string} line
 * @param {string} exclusion
 * @return {boolean}
 */
const scriptletException = (line, exclusion) => (exclusion === '#%#' && line.includes('#%#//scriptlet'))
        || (exclusion === '#@%#' && line.includes('#@%#//scriptlet'));

/**
 * Checks if line is excluded with specified set of exclusions
 *
 * @param line
 * @param exclusions
 * @param excluded
 * @param reason
 */
const isExcluded = function (line, exclusions, excluded, reason) {
    // eslint-disable-next-line no-restricted-syntax
    for (let exclusion of exclusions) {
        exclusion = exclusion.trim();

        if (exclusion && !exclusion.startsWith(RuleMasks.MASK_COMMENT)) {
            const message = `${line} is excluded by "${exclusion}" in ${reason}`;

            const isExcludedByRegexp = exclusion.endsWith(SLASH) && exclusion.startsWith(SLASH)
                && line.match(new RegExp(exclusion.substring(1, exclusion.length - 1)));

            if ((isExcludedByRegexp || line.includes(exclusion)) && !scriptletException(line, exclusion)) {
                logger.info(message);
                excluded.push(`${RuleMasks.MASK_COMMENT}${SPACE}${message}`);
                excluded.push(line);
                return exclusion;
            }
        }
    }

    return null;
};

/**
 * Applies exclusion from exclusions file
 *
 * @param lines
 * @param exclusionsFile
 * @param excluded
 * @returns {*}
 */
const exclude = function (lines, exclusionsFile, excluded) {
    logger.info('Applying exclusions..');

    let exclusions = readFile(exclusionsFile);
    if (!exclusions) {
        return lines;
    }

    exclusions = splitLines(exclusions);

    const exclusionsFileName = path.parse(exclusionsFile).base;
    const result = [];

    lines.forEach((line, pos) => {
        const exclusion = isExcluded(line, exclusions, excluded, exclusionsFileName);
        if (exclusion) {
            if (pos > 0 && lines[pos - 1].startsWith(RuleMasks.MASK_HINT)) {
                result.push(`${RuleMasks.MASK_COMMENT} [excluded by ${exclusion}] ${line}`);
            }
        } else {
            result.push(line);
        }
    });

    return result;
};

/**
 * Strips leading and trailing quotes from string
 *
 * @param s
 * @returns {*}
 */
const stripEndQuotes = function (s) {
    let t = s.length;
    if (s.charAt(0) === '"') {
        s = s.substring(1, t -= 1);
    }
    // eslint-disable-next-line no-plusplus
    if (s.charAt(--t) === '"') {
        s = s.substring(0, t);
    }
    return s;
};

/**
 * Extracts the value of an attribute.
*
* @param {string} attribute - The input attribute string.
* @returns {string} The extracted attribute value without quotes if it is not empty.
* @throws {Error} If the attribute value is empty.
*/
const getOptionValue = (attribute) => {
    const quotedValue = attribute.substring(attribute.indexOf(EQUAL_SIGN) + 1);
    const value = stripEndQuotes(quotedValue).trim();
    if (value.length === 0) {
        throw new Error(`Include directive value cannot be empty: '${attribute}'`);
    }
    return value;
};

/**
 * @typedef {object} IncludeOption
 * @property {string} name Option name
 * @property {boolean|string} value Option value
 */

/**
 * @typedef {object} ParsedIncludeData
 * @property {string} url Parsed url of file to include
 * @property {IncludeOption[]} options Array of parsed include directive options
 */

/**
 * Parses an include directive line to extract the URL and options.
 *
 * @param {string} lineWithDirective - The input line with directive to parse.
 * @returns {ParsedIncludeData} Parsed result containing the URL and options.
 */
const parseIncludeDirective = function (lineWithDirective) {
    const parts = lineWithDirective.trim().split(SPACE);
    let url = parts[1].trim();
    url = stripEndQuotes(url);
    // Initialize an options array to store the parsed options.
    const options = [];
    // Stack options into the array in the sequence in which they found in the string
    for (let i = 1; i < parts.length; i += 1) {
        const attribute = parts[i].trim();
        if (attribute.startsWith(`${SLASH}${STRIP_COMMENTS_OPTION}`)) {
            options.push({ name: STRIP_COMMENTS_OPTION, value: true });
        } else if (attribute.startsWith(`${SLASH}${OPTIMIZE_DOMAIN_BLOCKING_RULES}`)) {
            options.push({ name: OPTIMIZE_DOMAIN_BLOCKING_RULES, value: true });
        } else if (attribute.startsWith(`${SLASH}${NOT_OPTIMIZED_OPTION}`)) {
            options.push({ name: NOT_OPTIMIZED_OPTION, value: true });
        } else if (attribute.startsWith(`${SLASH}${EXCLUDE_OPTION}${EQUAL_SIGN}`)) {
            options.push({ name: EXCLUDE_OPTION, value: getOptionValue(attribute) });
        } else if (attribute.startsWith(`${SLASH}${ADD_MODIFIERS_OPTION}${EQUAL_SIGN}`)) {
            options.push({ name: ADD_MODIFIERS_OPTION, value: getOptionValue(attribute) });
        } else if (attribute.startsWith(`${SLASH}${IGNORE_TRUST_LEVEL_OPTION}`)) {
            options.push({ name: IGNORE_TRUST_LEVEL_OPTION, value: true });
        }
    }
    return { url, options };
};

/**
 * Checks if lines contains invalid redirect directives
 *
 * @param lines
 * @param url
 */
const checkRedirects = function (lines, url) {
    // eslint-disable-next-line no-restricted-syntax
    for (const line of lines) {
        if (/^!\s?[Rr]edirect:/.test(line)) {
            throw new Error(`Error: include ${url} contains redirect directive: ${line}`);
        }
    }
};

/**
 * @typedef {object} ParsedIncludeResult
 * @property {string[]} includedLines Included rules.
 * @property {boolean} shouldIgnoreTrustLevel Indicates whether the metadata's trust level should be ignored.
 */

/**
 * Creates content from compiler's `@include` directive, not `!#include` preprocessor directive.
 *
 * @param {string} filterDir Filter directory.
 * @param {string} directiveLine The include line containing the URL or file path and optional options.
 * @param {Array<string>} excluded An array of strings representing excluded content.
 *
 * @returns {Promise<ParsedIncludeResult>} Parsed include data.
 * @throws {Error} Throws an error if there is an issue handling the include operation.
 */
export const include = async (filterDir, directiveLine, excluded) => {
    let includedLines = [];
    let shouldIgnoreTrustLevel = false;

    const { url, options } = parseIncludeDirective(directiveLine);

    if (!url) {
        logger.warn('Invalid include url');
        return includedLines;
    }

    logger.info(`Applying inclusion from: ${url}`);

    const externalInclude = url.includes(':');

    const included = externalInclude
        ? downloadFile(url)
        : readFile(path.join(filterDir, url));

    if (included) {
        includedLines = splitLines(included);

        checkRedirects(includedLines, url);

        // resolved `@include` directive url
        const originUrl = externalInclude
            ? FiltersDownloader.getFilterUrlOrigin(url)
            : filterDir;

        includedLines = await FiltersDownloader.resolveIncludes(includedLines, originUrl);

        includedLines = removeAdblockVersion(includedLines);

        // eslint-disable-next-line no-restricted-syntax
        for (const { name, value } of options) {
            let optionsExcludePath;
            switch (name) {
                case EXCLUDE_OPTION:
                    optionsExcludePath = path.join(filterDir, value);
                    includedLines = exclude(includedLines, optionsExcludePath, excluded);
                    break;
                case STRIP_COMMENTS_OPTION:
                    includedLines = stripComments(includedLines);
                    break;
                case OPTIMIZE_DOMAIN_BLOCKING_RULES:
                    // eslint-disable-next-line no-await-in-loop
                    includedLines = await optimizeDomainBlockingRules(includedLines);
                    break;
                case NOT_OPTIMIZED_OPTION:
                    includedLines = addNotOptimizedHints(includedLines);
                    break;
                case ADD_MODIFIERS_OPTION:
                    includedLines = addModifiers(includedLines, value);
                    break;
                case IGNORE_TRUST_LEVEL_OPTION:
                    if (externalInclude) {
                        // eslint-disable-next-line max-len
                        throw new Error(`Trust level ignoring option is not supported for external includes: ${directiveLine}`);
                    }
                    shouldIgnoreTrustLevel = true;
                    break;
                default:
                    break;
            }
        }

        includedLines = fixVersionComments(includedLines);
    } else {
        throw new Error(`Error handling include from: ${options.url}`);
    }

    logger.info(`Inclusion lines: ${includedLines.length}`);
    logger.info(`Should be filtered due to trust level: ${shouldIgnoreTrustLevel}`);

    return {
        includedLines,
        shouldIgnoreTrustLevel,
    };
};

/**
 * Resolves preprocessor `!#include` directives by FiltersDownloader.
 *
 * @param {string} filterDir Filter directory.
 * @param {string} filterName Filter name.
 * @param {string[]} lines Array of lines.
 *
 * @returns {Promise<string[]>} Promise which resolves
 * to array of rules as a result of resolving preprocessor `!#include` directives.
 *
 * @throws {Error} Throws an error if unable to resolve `!#include` directives.
 */
const getResolvedPreprocessorIncludes = async function (filterDir, filterName, lines) {
    let rules = lines;
    // bad includes are ignored here because they'll be handled in generator after resolving conditions
    // https://github.com/AdguardTeam/FiltersCompiler/issues/84
    try {
        rules = await FiltersDownloader.resolveIncludes(lines, filterDir);
    } catch (e) {
        logger.error(`Error resolving includes in ${filterName}: ${e.message}`);
    }
    return rules;
};

/**
 * Resolved preprocessor `!#include` directives and converts rules to Adguard syntax.
 *
 * @param {string} filterDir Filter directory.
 * @param {string} filterName Filter name.
 * @param {string[]} lines Array of raw rules and possibly preprocessor `!#include` directives.
 * @param {string[]} excluded Array of rules to exclude.
 * @param {string[]} invalidRules Invalid rules for the report file.
 *
 * @returns {Promise<string[]>} Promise which resolves to array of AdGuard syntax rules.
 */
const prepareAdgRules = async function (
    filterDir,
    filterName,
    lines,
    excluded,
    invalidRules,
) {
    const resolvedIncludes = await getResolvedPreprocessorIncludes(filterDir, filterName, lines);
    return convertRulesToAdgSyntax(resolvedIncludes, excluded, invalidRules);
};

/**
 * Checks whether the line contain `Diff-Path` header tag.
 *
 * `Diff-Path` header tag should be removed from the rules
 * because some third-party filters may contain it
 * but @adguard/diff-builder does not support third-party patches.
 * Anyway the `Diff-Path` header tag should be added by the diff-builder during patch building
 * and should not be present in the filter file.
 *
 * @param {string} line Line to check.
 *
 * @returns {boolean} `true` if the line contains `Diff-Path` header tag, `false` otherwise.
 */
const isDiffPathHeaderTag = (line) => {
    // non-comment lines should be kept
    if (
        !line.startsWith(RuleMasks.MASK_COMMENT)
        // ubo supports `#` for comments
        && !line.startsWith(RuleMasks.MASK_HOST_FILE_COMMENT)
    ) {
        return false;
    }

    return line.includes(DIFF_PATH_TAG);
};

/**
 * @typedef {object} CompileResult
 * @property {string[]} lines Compiled rules.
 * @property {string[]} excluded Excluded rules.
 * @property {string[]} invalid Invalid rules.
 */

/**
 * Compiles filter lines.
 *
 * @param filterDir Filter directory.
 * @param filterName Filter name.
 * @param templateContent Content of template.txt file.
 * @param trustLevelSettings Trust level settings for the filter.
 *
 * @returns {Promise<CompileResult>} Promise which resolves to compiled data for the filter.
 */
const compile = async function (filterDir, filterName, templateContent, trustLevelSettings) {
    let result = [];
    const excluded = [];

    // collect invalid rules for report
    // https://github.com/AdguardTeam/FiltersCompiler/issues/87
    const invalid = [];

    const lines = splitLines(templateContent);
    // eslint-disable-next-line no-restricted-syntax
    for (const line of lines) {
        if (line.startsWith(INCLUDE_DIRECTIVE)) {
            // eslint-disable-next-line no-await-in-loop
            const { includedLines, shouldIgnoreTrustLevel } = await include(filterDir, line, excluded);

            let includedRules = [];

            includedLines.forEach((line) => includedRules.push(line.trim()));

            // eslint-disable-next-line no-await-in-loop
            includedRules = await prepareAdgRules(
                filterDir,
                filterName,
                includedRules,
                excluded,
                invalid,
            );

            if (shouldIgnoreTrustLevel) {
                logger.info(`Ignoring trust level for ${filterName} due to @include directive: ${line}`);
            } else {
                logger.info(`Applying trust-level exclusions to ${filterName} @include directive: ${line}`);
                includedRules = exclude(includedRules, trustLevelSettings, excluded);
            }

            // 'for' loop is used in purpose instead of spread operator
            // to avoid 'Maximum call stack size exceeded' error on large number of rules
            for (let i = 0; i < includedRules.length; i += 1) {
                result.push(includedRules[i]);
            }
        } else {
            let inlineRules = [line.trim()];

            // eslint-disable-next-line no-await-in-loop
            inlineRules = await prepareAdgRules(
                filterDir,
                filterName,
                inlineRules,
                excluded,
                invalid,
            );

            logger.info('Applying trust-level exclusions to inline template.txt rules...');
            inlineRules = exclude(inlineRules, trustLevelSettings, excluded);

            // 'for' loop is used in purpose instead of spread operator
            // to avoid 'Maximum call stack size exceeded' error on large number of rules
            for (let i = 0; i < inlineRules.length; i += 1) {
                result.push(inlineRules[i]);
            }
        }
    }

    result = result.filter((line) => !isDiffPathHeaderTag(line));

    const excludeFilePath = path.join(filterDir, EXCLUDE_FILE);
    result = exclude(result, excludeFilePath, excluded);

    result = validateAndFilterRules(result, excluded, invalid, filterName);

    return {
        lines: result,
        excluded,
        invalid,
    };
};

/**
 * Creates revision object,
 * doesn't increment version if hash is not changed
 *
 * @param {string} path - The path to the revision file.
 * @param {string} hash - The hash of the filter file.
 * @returns {{version: string, timeUpdated: number}}
 */
const makeRevision = function (path, hash) {
    const result = {
        version: '1.0.0.0',
        timeUpdated: new Date().getTime(),
        hash,
    };

    const current = readFile(path);
    if (current) {
        const currentRevision = JSON.parse(current);
        if (currentRevision.version) {
            result.version = currentRevision.version;

            if (currentRevision.timeUpdated) {
                result.timeUpdated = currentRevision.timeUpdated;
            }

            if (!currentRevision.hash || currentRevision.hash !== result.hash) {
                result.version = version.increment(currentRevision.version);
                result.timeUpdated = new Date().getTime();
            }
        }
    }

    return result;
};

/**
 * Builds filter txt file from directory contents
 *
 * @param {string} filterDir - The path to the directory containing filters.
 * @param {Array<number>} whitelist - An array whitelist filters IDs.
 * @param {Array<number>} blacklist - An array blacklist filters IDs.
 * @returns {Promise<void>} A promise that resolves when all filters and its subdirectories have been processed.
 */
const buildFilter = async function (filterDir, whitelist, blacklist) {
    const templateContent = readFile(path.join(filterDir, TEMPLATE_FILE));
    if (!templateContent) {
        throw new Error('Invalid template');
    }

    const metadata = JSON.parse(readFile(path.join(filterDir, METADATA_FILE)));

    const { filterId } = metadata;

    // check whether the filter is disabled after other checks to avoid unnecessary logging
    if (metadata.disabled) {
        logger.warn(`Filter ${filterId} skipped as disabled`);
        skipFilter(metadata);
        return;
    }

    if (whitelist && whitelist.length > 0 && whitelist.indexOf(filterId) < 0) {
        logger.info(`Filter ${filterId} skipped due to '--include' option`);
        return;
    }

    if (blacklist && blacklist.length > 0 && blacklist.indexOf(filterId) >= 0) {
        logger.info(`Filter ${filterId} skipped due to '--skip' option`);
        return;
    }

    const trustLevel = metadata.trustLevel ? metadata.trustLevel : DEFAULT_TRUST_LEVEL;
    // eslint-disable-next-line no-undef
    const trustLevelSettings = path.resolve(__dirname, TRUST_LEVEL_DIR, `exclusions-${trustLevel}.txt`);

    const { name: filterName } = metadata;
    logger.info(`Compiling ${filterName}`);
    const result = await compile(filterDir, filterName, templateContent, trustLevelSettings);

    if (!checkAffinityDirectives(result.lines)) {
        throw new Error(`Error validating !#safari_cb_affinity directive in filter ${filterId}`);
    }

    const compiled = result.lines;
    const { excluded, invalid } = result;

    addFilter(metadata, result, invalid);
    logger.info(`Compiled length:${compiled.length}`);
    logger.info(`Excluded length:${excluded.length}`);

    const compiledData = compiled.join('\r\n');

    logger.info(`Writing filter file, lines:${compiled.length}`);
    writeFile(path.join(filterDir, FILTER_FILE), compiledData);
    logger.info(`Writing excluded file, lines:${excluded.length}`);
    writeFile(path.join(filterDir, EXCLUDED_LINES_FILE), excluded.join('\r\n'));
    logger.info('Writing revision file..');

    // eslint-disable-next-line no-buffer-constructor
    const hash = Buffer.from(md5(compiledData, { asString: true })).toString('base64').trim();
    const revisionFile = path.join(filterDir, REVISION_FILE);
    const revision = makeRevision(revisionFile, hash);
    writeFile(revisionFile, JSON.stringify(revision, null, '\t'));
};

/**
 * Asynchronously parses a directory and processes filters based on the provided whitelist and blacklist.
 *
 * @param {string} filtersDir - The path to the directory containing filters.
 * @param {Array<number>} whitelist - An array whitelist filters IDs.
 * @param {Array<number>} blacklist - An array blacklist filters IDs.
 * @returns {Promise<void>} A promise that resolves when all filters and its subdirectories have been processed.
 */
const parseDirectory = async function (filtersDir, whitelist, blacklist) {
    const items = fs.readdirSync(filtersDir)
        .sort((a, b) => getFilterIdFromDirName(a) - getFilterIdFromDirName(b));

    // eslint-disable-next-line no-restricted-syntax
    for (const directory of items) {
        const filterDir = path.join(filtersDir, directory);
        if (fs.lstatSync(filterDir).isDirectory()) {
            const template = path.join(filterDir, TEMPLATE_FILE);
            if (fs.existsSync(template)) {
                logger.info(`Building filter ${directory}...`);
                // eslint-disable-next-line no-await-in-loop
                await buildFilter(filterDir, whitelist, blacklist);
                logger.info(`Filter ${directory} ok`);
            } else {
                // eslint-disable-next-line no-await-in-loop
                await parseDirectory(filterDir, whitelist, blacklist);
            }
        }
    }
};

/**
 * Asynchronously builds and processes filter files, generates platform data, and creates a report.
 *
 * @async
 * @function build
 * @param {string} filtersDir - The directory containing filter files to be processed.
 * @param {string} logFile - The path to the log file where logs will be written.
 * @param {string} reportFile - The path to the report file to be created.
 * @param {string} platformsPath - The path where platform data will be generated.
 * @param {Object} platformsConfig - The configuration object for platforms.
 * @param {Array<number>} whitelist - A list of filter file names to include in processing.
 * @param {Array<number>} blacklist - A list of filter file names to exclude from processing.
 * @returns {Promise<void>} A promise that resolves when the build process is complete.
 */
export const build = async (
    filtersDir,
    logFile,
    reportFile,
    platformsPath,
    platformsConfig,
    whitelist,
    blacklist,
) => {
    logger.initialize(logFile);
    init(FILTER_FILE, METADATA_FILE, REVISION_FILE, platformsConfig, ADGUARD_FILTERS_SERVER_URL);

    await parseDirectory(filtersDir, whitelist, blacklist);

    logger.info('Generating platforms');
    await generate(filtersDir, platformsPath, whitelist, blacklist);
    logger.info('Generating platforms done');
    create(reportFile);
};
