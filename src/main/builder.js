import fs from 'fs';
import path from 'path';
import md5 from 'md5';

import { FiltersDownloader, stripUrlCredentials } from '@adguard/filters-downloader';
import { convertRulesToAdgSyntax } from './converter';
import { validateAndFilterRules, checkAffinityDirectives } from './validator';
import { init, generate } from './platforms/generator';
import { logger } from './utils/log';
import { skipFilter, addFilter, create } from './utils/report';
import {
    RuleMasks,
    hasHint,
    isHint,
    SPACE,
    HINT_MASK,
    NOT_OPTIMIZED_HINT,
} from './rule/rule-masks';
import { fixVersionComments, removeAdblockVersion } from './utils/workaround';
import {
    downloadFile, sanitizeError, sanitizeText, sanitizeUrl,
} from './utils/webutils';
import { getFilterIdFromDirName } from './utils/utils';
import { optimizeDomainBlockingRules } from './utils/builder-utils';
import { getRemoteIncludeUrl, RemoteIncludeError, resolveIncludes } from './utils/include-resolver';
import { exclude, getTrustLevelExclusionsFile } from './utils/rule-exclusions';
import { makeRevision } from './utils/revision';

const TEMPLATE_FILE = 'template.txt';
const FILTER_FILE = 'filter.txt';
const REVISION_FILE = 'revision.json';
const EXCLUDE_FILE = 'exclude.txt';
const EXCLUDED_LINES_FILE = 'diff.txt';
const METADATA_FILE = 'metadata.json';
const ADGUARD_FILTERS_SERVER_URL = 'https://filters.adtidy.org/';

const SLASH = '/';
const COMMA = ',';
const EQUAL_SIGN = '=';
const MODIFIERS_SEPARATOR = '$';
const INCLUDE_DIRECTIVE = '@include ';
const CONDITION_START_DIRECTIVE = '!#if';
const CONDITION_END_DIRECTIVE = '!#endif';
const STRIP_COMMENTS_OPTION = 'stripComments';
const OPTIMIZE_DOMAIN_BLOCKING_RULES = 'optimizeDomainBlockingRules';
const NOT_OPTIMIZED_OPTION = 'notOptimized';
const EXCLUDE_OPTION = 'exclude';
const ADD_MODIFIERS_OPTION = 'addModifiers';
const IGNORE_TRUST_LEVEL_OPTION = 'ignoreTrustLevel';

const NOT_OPTIMIZED_SUFFIX = `${SPACE}${NOT_OPTIMIZED_HINT}`;
const NOT_OPTIMIZED_HINT_LINE = `${HINT_MASK}${NOT_OPTIMIZED_HINT}`;

/**
 * Matches a preprocessor include directive line.
 */
const PREPROCESSOR_INCLUDE_REGEXP = /^!#include\s+(.+)$/;

/**
 * Matches an absolute URL. Such a target has no directory that it can leave.
 */
const ABSOLUTE_URL_REGEXP = /^([a-z][a-z0-9+.-]*:[/\\]{2,})|^[/\\]{2,}/i;

/**
 * Filter header tag for diff path which is needed for patch updates.
 */
const DIFF_PATH_TAG = 'Diff-Path:';

// TODO: Move include directive option functions to utils/builder-utils.js

/**
 * Sync reads file content
 *
 * @param {string} path Path to the file.
 * @returns {string|null} File content, or `null` if the file does not exist.
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
 * Adds not optimized hints.
 *
 * A hint applies only to the line that immediately follows it, so consumers
 * read it from the line right before the rule. The token is appended to an
 * existing hint line only when that line directly precedes the rule: a blank
 * line or a comment between them detaches the hint, and a separate hint line
 * is inserted instead.
 *
 * Lines are classified by their trimmed text: this runs on included lines that
 * `compile()` trims only later, so indentation must not hide a hint or a blank
 * line.
 *
 * Exported for unit tests.
 *
 * @param {string[]} lines Lines to process.
 *
 * @returns {string[]} Lines with the hints added.
 */
export const addNotOptimizedHints = function (lines) {
    logger.info('Adding hints..');

    const result = [];
    let previousLine = null;

    lines.forEach((line) => {
        const trimmedLine = line.trim();

        if (!trimmedLine) {
            previousLine = trimmedLine;
            return;
        }

        const isRule = !trimmedLine.startsWith(RuleMasks.MASK_COMMENT);
        const isHinted = isHint(previousLine);
        const alreadyMarked = hasHint(previousLine, NOT_OPTIMIZED_HINT);

        if (isRule) {
            if (!isHinted) {
                result.push(NOT_OPTIMIZED_HINT_LINE);
            } else if (!alreadyMarked) {
                const hintIndex = result.length - 1;
                result[hintIndex] = `${result[hintIndex]}${NOT_OPTIMIZED_SUFFIX}`;
            }
        }

        result.push(line);
        previousLine = trimmedLine;
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
    const parts = lineWithDirective.trim().split(/\s+/);
    let url = (parts[1] ?? '').trim();
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
 * Checks that an external include URL uses HTTP or HTTPS.
 *
 * The `@include` directive treats any value with a colon as an external URL
 * and passes it to curl. A scheme-less credential form, for example
 * `user:pass@example.org/filter.txt`, is not an HTTP(S) URL. Curl versions
 * differ in how they read that form: some send the userinfo as Basic auth and
 * download the file, while others read `user:` as a protocol and fail. The
 * compiler accepts only HTTP(S) here, so the value is rejected before the log
 * and the download, and the password cannot reach either. This is a
 * deliberate behavior change: a scheme-less value that some curl versions
 * downloaded is now rejected.
 *
 * @param {string} url Include URL.
 * @returns {boolean} `true` if the URL uses HTTP or HTTPS.
 */
const isHttpUrl = function (url) {
    try {
        const { protocol } = new URL(url);
        return protocol === 'http:' || protocol === 'https:';
    } catch {
        return false;
    }
};

/**
 * Removes credentials from every URL in an include directive line.
 *
 * An invalid directive can contain a scheme-less URL, which the generic helper
 * does not recognize, so each whitespace-separated part is sanitized as a URL.
 * The line is normalized to a single line with single spaces.
 *
 * @param {string} line Include directive line.
 * @returns {string} Directive line without credentials.
 */
const sanitizeDirectiveLine = function (line) {
    return sanitizeText(line).trim().split(/\s+/).join(' ');
};

/**
 * Normalizes the separators and the dot segments of a local `!#include` path
 * the same way the downloader does before it checks the directory.
 *
 * The downloader converts `\` to `/` and treats `%2e`, `.%2e`, `%2e.`, and
 * `%2e%2e` as dot segments before `isInsideLocalDirectory()` runs. A plain
 * `path.resolve()` does neither on POSIX, so without this normalization the
 * warning misses a target that the downloader drops, for example
 * `..\common.txt` or `%2e%2e/common.txt`.
 *
 * @param {string} includePath Path from the `!#include` directive.
 * @returns {string} Path with forward slashes and plain dot segments.
 */
const normalizeIncludePath = function (includePath) {
    return includePath
        .replace(/\\/g, '/')
        .split('/')
        .map((segment) => {
            const lowerCaseSegment = segment.toLowerCase();

            if (lowerCaseSegment === '%2e') {
                return '.';
            }

            if (lowerCaseSegment === '.%2e'
                || lowerCaseSegment === '%2e.'
                || lowerCaseSegment === '%2e%2e') {
                return '..';
            }

            return segment;
        })
        .join('/');
};

/**
 * Logs a warning for each local `!#include` target that leaves the directory
 * of the containing file.
 *
 * The dependency ignores such an include, as uBO does, so the compiled filter
 * loses the included rules without a message. The warning tells the filter
 * maintainer why the rules are missing. An absolute URL has no directory that
 * it can leave, so it is not checked.
 *
 * The target is normalized the way the downloader normalizes it, so Windows
 * separators and percent-encoded dot segments are checked too.
 *
 * @param {string} directory Directory of the file that contains the directive.
 * @param {string[]} lines Lines that may contain `!#include` directives.
 */
const warnAboutDroppedPreprocessorIncludes = function (directory, lines) {
    const base = path.resolve(directory);

    // eslint-disable-next-line no-restricted-syntax
    for (const line of lines) {
        const match = PREPROCESSOR_INCLUDE_REGEXP.exec(line);
        if (!match) {
            continue;
        }

        const includePath = match[1].trim();
        if (ABSOLUTE_URL_REGEXP.test(includePath)) {
            continue;
        }

        // A leading separator means a path inside the directory, as in uBO.
        const normalizedIncludePath = normalizeIncludePath(includePath).replace(/^\/+/, '');
        const target = path.resolve(base, normalizedIncludePath);
        const relative = path.relative(base, target);

        if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
            const sanitizedLine = sanitizeDirectiveLine(line.trim());
            logger.warn(
                `Ignoring !#include outside the directory of the containing file: '${sanitizedLine}'`,
            );
        }
    }
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
            // The redirect target can be a scheme-less URL, which the generic
            // helper does not recognize, so the URL and the directive line are
            // sanitized separately.
            throw new Error(
                `Error: include ${sanitizeUrl(url)} contains redirect directive: ${sanitizeDirectiveLine(line)}`,
            );
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
        throw new Error(`Invalid include directive: '${sanitizeDirectiveLine(directiveLine.trim())}'`);
    }

    const ignoreTrustLevel = options.some(({ name }) => name === IGNORE_TRUST_LEVEL_OPTION);

    const externalInclude = url.includes(':');

    if (externalInclude && !isHttpUrl(url)) {
        throw new Error(`Invalid external include URL: '${sanitizeUrl(url)}'`);
    }

    logger.info(`Applying inclusion from: ${sanitizeUrl(url)}`);

    const included = externalInclude
        ? await downloadFile(url)
        : readFile(path.join(filterDir, url));

    if (included !== null) {
        includedLines = splitLines(included);

        // An empty remote response is accepted, but it is likely a broken
        // source rather than an intentional empty list, so keep a signal.
        if (externalInclude && included.trim() === '') {
            logger.warn(`Included remote file is empty: ${sanitizeUrl(url)}`);
        }

        checkRedirects(includedLines, url);

        // A local include with `/ignoreTrustLevel` must not pull third-party
        // rules through a remote `!#include`: such rules would skip the
        // trust-level exclusions, which is forbidden for external content.
        if (ignoreTrustLevel) {
            const remoteIncludeUrl = includedLines
                .map((line) => getRemoteIncludeUrl(line))
                .find((remoteUrl) => remoteUrl !== null);

            if (remoteIncludeUrl) {
                throw new Error('Trust level ignoring option is not supported for an @include '
                    + `with a remote !#include: ${directiveLine}`);
            }
        }

        // resolved `@include` directive url
        const originUrl = externalInclude
            ? FiltersDownloader.getFilterUrlOrigin(url)
            : path.dirname(path.join(filterDir, url));

        if (!externalInclude) {
            warnAboutDroppedPreprocessorIncludes(originUrl, includedLines);
        }

        try {
            includedLines = await resolveIncludes(includedLines, originUrl, undefined, {
                remoteOrigin: externalInclude,
            });
        } catch (e) {
            // A local file can contain a `!#include` whose target is a
            // scheme-less URL, and the dependency leaves that form in the
            // message, so the error reaches the caller sanitized here.
            throw sanitizeError(e);
        }

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
                        throw new Error(stripUrlCredentials(`Trust level ignoring option is not supported for external includes: ${directiveLine}`));
                    }
                    shouldIgnoreTrustLevel = true;
                    break;
                default:
                    break;
            }
        }

        includedLines = fixVersionComments(includedLines);
    } else {
        throw new Error(`Error handling include from: ${sanitizeUrl(url)}`);
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
 * @param {boolean} [deferRemoteIncludes] Leave a remote `!#include` for the
 * generator to resolve after the conditions. Set for a line inside a conditional block.
 *
 * @returns {Promise<string[]>} Promise which resolves
 * to array of rules as a result of resolving preprocessor `!#include` directives.
 *
 * @throws {Error} Throws an error if unable to resolve `!#include` directives.
 */
const getResolvedPreprocessorIncludes = async function (filterDir, filterName, lines, deferRemoteIncludes) {
    warnAboutDroppedPreprocessorIncludes(filterDir, lines);

    try {
        return await resolveIncludes(lines, filterDir, undefined, { deferRemoteIncludes });
    } catch (e) {
        // remote includes must fail the build: an unresolved directive would be
        // dropped by the converter and never reach the generator
        if (e instanceof RemoteIncludeError) {
            throw new Error(`Error resolving includes in ${filterName}: ${e.message}`, { cause: e });
        }
        // bad local includes are ignored here because they'll be handled in generator after resolving conditions
        // https://github.com/AdguardTeam/FiltersCompiler/issues/84
        logger.error(sanitizeText(`Error resolving includes in ${filterName}: ${e.message}`));
        return lines;
    }
};

/**
 * Resolved preprocessor `!#include` directives and converts rules to Adguard syntax.
 *
 * @param {string} filterDir Filter directory.
 * @param {string} filterName Filter name.
 * @param {string[]} lines Array of raw rules and possibly preprocessor `!#include` directives.
 * @param {string[]} excluded Array of rules to exclude.
 * @param {string[]} invalidRules Invalid rules for the report file.
 * @param {string} [previousLine] Line preceding the first of `lines` in the template.
 * @param {boolean} [deferRemoteIncludes] Leave a remote `!#include` for the
 * generator to resolve after the conditions. Set for a line inside a conditional block.
 *
 * @returns {Promise<string[]>} Promise which resolves to array of AdGuard syntax rules.
 */
const prepareAdgRules = async function (
    filterDir,
    filterName,
    lines,
    excluded,
    invalidRules,
    previousLine,
    deferRemoteIncludes,
) {
    const resolvedIncludes = await getResolvedPreprocessorIncludes(
        filterDir,
        filterName,
        lines,
        deferRemoteIncludes,
    );
    return convertRulesToAdgSyntax(resolvedIncludes, excluded, invalidRules, previousLine);
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
export const compile = async function (filterDir, filterName, templateContent, trustLevelSettings) {
    let result = [];
    const excluded = [];

    // collect invalid rules for report
    // https://github.com/AdguardTeam/FiltersCompiler/issues/87
    const invalid = [];

    const lines = splitLines(templateContent);
    let previousLine;
    let conditionDepth = 0;
    // eslint-disable-next-line no-restricted-syntax
    for (const line of lines) {
        const trimmedLine = line.trim();

        if (trimmedLine.startsWith(CONDITION_START_DIRECTIVE)) {
            conditionDepth += 1;
        }

        if (trimmedLine.startsWith(INCLUDE_DIRECTIVE)) {
            // eslint-disable-next-line no-await-in-loop
            const { includedLines, shouldIgnoreTrustLevel } = await include(filterDir, trimmedLine, excluded);

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
                // `/ignoreTrustLevel` throws for an external include, so this
                // line can contain only a local path, which has no credentials.
                logger.info(`Ignoring trust level for ${filterName} due to @include directive: ${line}`);
            } else {
                logger.info(stripUrlCredentials(
                    `Applying trust-level exclusions to ${filterName} @include directive: ${line}`,
                ));
                includedRules = exclude(includedRules, trustLevelSettings, excluded);
            }

            // 'for' loop is used in purpose instead of spread operator
            // to avoid 'Maximum call stack size exceeded' error on large number of rules
            for (let i = 0; i < includedRules.length; i += 1) {
                result.push(includedRules[i]);
            }
        } else {
            // A preprocessor directive is not a rule, and `!#include` expands to the rules of
            // another file, so a hint on the line before any `!#` directive (`!#include`,
            // `!#if`, `!#else`, `!#endif`, ...) must not apply to the lines it resolves to.
            const inlinePreviousLine = trimmedLine.startsWith(RuleMasks.MASK_DIRECTIVES)
                ? undefined
                : previousLine;

            let inlineRules = [trimmedLine];

            // eslint-disable-next-line no-await-in-loop
            inlineRules = await prepareAdgRules(
                filterDir,
                filterName,
                inlineRules,
                excluded,
                invalid,
                inlinePreviousLine,
                conditionDepth > 0,
            );

            logger.info('Applying trust-level exclusions to inline template.txt rules...');
            inlineRules = exclude(inlineRules, trustLevelSettings, excluded, inlinePreviousLine);

            // 'for' loop is used in purpose instead of spread operator
            // to avoid 'Maximum call stack size exceeded' error on large number of rules
            for (let i = 0; i < inlineRules.length; i += 1) {
                result.push(inlineRules[i]);
            }
        }

        if (trimmedLine.startsWith(CONDITION_END_DIRECTIVE)) {
            conditionDepth = Math.max(0, conditionDepth - 1);
        }

        previousLine = line.trim();
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
 * Builds filter txt file from directory contents
 *
 * @param {string} filterDir - The path to the directory containing filters.
 * @param {Array<number>|null} [includedFilterIds] - An array of filter IDs to include.
 * @param {Array<number>|null} [excludedFilterIds] - An array of filter IDs to exclude.
 * @param {boolean} [writeRevision] - Write the revision file. Set to `false` when
 * the generator computes the revision from the final platform output.
 * @returns {Promise<void>} A promise that resolves when all filters and its subdirectories have been processed.
 */
const buildFilter = async function (filterDir, includedFilterIds, excludedFilterIds, writeRevision = true) {
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

    if (includedFilterIds && includedFilterIds.length > 0 && includedFilterIds.indexOf(filterId) < 0) {
        logger.info(`Filter ${filterId} skipped due to '--include' option`);
        return;
    }

    if (excludedFilterIds && excludedFilterIds.length > 0 && excludedFilterIds.indexOf(filterId) >= 0) {
        logger.info(`Filter ${filterId} skipped due to '--skip' option`);
        return;
    }

    const trustLevelSettings = getTrustLevelExclusionsFile(metadata.trustLevel);

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

    if (writeRevision) {
        logger.info('Writing revision file..');
        const hash = Buffer.from(md5(compiledData, { asString: true })).toString('base64').trim();
        const revisionFile = path.join(filterDir, REVISION_FILE);
        const revision = makeRevision(revisionFile, hash);
        writeFile(revisionFile, JSON.stringify(revision, null, '\t'));
    }
};

/**
 * Asynchronously parses a directory and processes filters based on the provided included/excluded filter IDs.
 *
 * @param {string} filtersDir - The path to the directory containing filters.
 * @param {Array<number>|null} [includedFilterIds] - An array of filter IDs to include.
 * @param {Array<number>|null} [excludedFilterIds] - An array of filter IDs to exclude.
 * @param {boolean} [writeRevision] - Write revision files during compilation.
 * @returns {Promise<void>} A promise that resolves when all filters and its subdirectories have been processed.
 */
const parseDirectory = async function (filtersDir, includedFilterIds, excludedFilterIds, writeRevision = true) {
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
                await buildFilter(filterDir, includedFilterIds, excludedFilterIds, writeRevision);
                logger.info(`Filter ${directory} ok`);
            } else {
                // eslint-disable-next-line no-await-in-loop
                await parseDirectory(filterDir, includedFilterIds, excludedFilterIds, writeRevision);
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
 * @param {string|null} platformsPath - The path where platform data will be generated; `null` skips platform output.
 * @param {Object} platformsConfig - The configuration object for platforms.
 * @param {Array<number>|null} [includedFilterIds] - A list of filter IDs to include in processing.
 * @param {Array<number>|null} [excludedFilterIds] - A list of filter IDs to exclude from processing.
 * @returns {Promise<void>} A promise that resolves when the build process is complete.
 */
export const build = async (
    filtersDir,
    logFile,
    reportFile,
    platformsPath,
    platformsConfig,
    includedFilterIds,
    excludedFilterIds,
) => {
    logger.initialize(logFile);
    init(FILTER_FILE, METADATA_FILE, REVISION_FILE, platformsConfig, ADGUARD_FILTERS_SERVER_URL);

    await parseDirectory(filtersDir, includedFilterIds, excludedFilterIds, !platformsPath);

    logger.info('Generating platforms');
    await generate(filtersDir, platformsPath, includedFilterIds, excludedFilterIds);
    logger.info('Generating platforms done');
    create(reportFile);
};
