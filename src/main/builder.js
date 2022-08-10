/* eslint-disable global-require */

module.exports = (function () {
    /**
     * @typedef {Object} fs
     * @property {function} readFileSync
     * @property {function} writeFileSync
     * @property {function} lstatSync
     * @property {function} readdirSync
     * @property {function} isDirectory
     * @property {function} appendFile
     * @property {function} existsSync
     * @property {function} mkdirSync
     */
    const fs = require('fs');
    /**
     * @typedef {Object} path
     * @property {function} join
     */
    const path = require('path');
    const md5 = require('md5');

    const version = require('./utils/version.js');
    const converter = require('./converter.js');
    const validator = require('./validator.js');
    const generator = require('./platforms/generator.js');
    const logger = require('./utils/log.js');
    const report = require('./utils/report.js');
    const RuleMasks = require('./rule/rule-masks');
    const workaround = require('./utils/workaround.js');
    const webutils = require('./utils/webutils.js');

    const FiltersDownloader = require('filters-downloader');

    const TEMPLATE_FILE = 'template.txt';
    const FILTER_FILE = 'filter.txt';
    const REVISION_FILE = 'revision.json';
    const EXCLUDE_FILE = 'exclude.txt';
    const EXCLUDED_LINES_FILE = 'diff.txt';
    const METADATA_FILE = 'metadata.json';
    const ADGUARD_FILTERS_SERVER_URL = 'https://filters.adtidy.org/';
    const TRUST_LEVEL_DIR = './utils/trust-levels';
    const DEFAULT_TRUST_LEVEL = 'low';

    const INCLUDE_DIRECTIVE = '@include ';
    const INCLUDE_OPTION_COMMENTS = '/stripComments';
    const INCLUDE_OPTION_NOT_OPTIMIZED = '/notOptimized';
    const INCLUDE_OPTION_EXCLUDE = '/exclude=';

    const NOT_OPTIMIZED_HINT = '!+ NOT_OPTIMIZED';

    let currentDir;

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
        return string.split(/[\r\n]+/);
    };

    /**
     * Removes comments from lines
     *
     * @param lines
     */
    const stripComments = function (lines) {
        logger.log('Stripping comments..');

        return lines.filter((line, pos) => {
            if (pos > 0 && lines[pos - 1].startsWith(RuleMasks.MASK_HINT)) {
                return true;
            }

            if (line.startsWith(RuleMasks.MASK_HINT)
                || line.startsWith(RuleMasks.MASK_DIRECTIVES)) {
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
        logger.log('Adding hints..');

        const result = [];

        lines.forEach((v) => {
            if (!v) {
                return;
            }

            if (!v.startsWith('! ')) {
                result.push(NOT_OPTIMIZED_HINT);
            }

            result.push(v);
        });

        return result;
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

            if (exclusion && !exclusion.startsWith('!')) {
                const message = `${line} is excluded by "${exclusion}" in ${reason}`;

                const isExcludedByRegexp = exclusion.endsWith('/') && exclusion.startsWith('/')
                    && line.match(new RegExp(exclusion.substring(1, exclusion.length - 1)));

                if ((isExcludedByRegexp || line.includes(exclusion)) && !scriptletException(line, exclusion)) {
                    logger.log(message);
                    excluded.push(`! ${message}`);
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
     * Parses include line
     *
     * @param line
     * @returns {{url: string, stripComments: boolean, notOptimized: boolean, exclude: *}}
     */
    const parseIncludeLine = function (line) {
        const parts = line.split(' ');

        let url = parts[1].trim();

        url = stripEndQuotes(url);

        let stripComments = false;
        let notOptimized = false;
        let exclude = null;

        for (let i = 1; i < parts.length; i += 1) {
            const attribute = parts[i].trim();
            if (attribute.startsWith(INCLUDE_OPTION_COMMENTS)) {
                stripComments = true;
            } else if (attribute.startsWith(INCLUDE_OPTION_NOT_OPTIMIZED)) {
                notOptimized = true;
            } else if (attribute.startsWith(INCLUDE_OPTION_EXCLUDE)) {
                exclude = attribute.substring(attribute.indexOf('=') + 1);
                exclude = stripEndQuotes(exclude);
            }
        }

        return {
            url,
            stripComments,
            notOptimized,
            exclude,
        };
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
     * Creates content from include line
     *
     * @param line
     * @param excluded
     * @returns {Array}
     */
    const include = async function (line, excluded) {
        let result = [];

        const options = parseIncludeLine(line);

        if (!options.url) {
            logger.warn('Invalid include url');
            return result;
        }

        logger.log(`Applying inclusion from: ${options.url}`);

        const externalInclude = options.url.includes(':');
        // eslint-disable-next-line max-len
        const included = externalInclude ? webutils.downloadFile(options.url) : readFile(path.join(currentDir, options.url));

        if (included) {
            result = splitLines(included);

            checkRedirects(result, options.url);

            // resolved includes
            const originUrl = externalInclude ? FiltersDownloader.getFilterUrlOrigin(options.url) : currentDir;
            result = await FiltersDownloader.resolveIncludes(result, originUrl);

            result = workaround.removeAdblockVersion(result);

            if (options.exclude) {
                const optionsExcludePath = path.join(currentDir, options.exclude);
                result = exclude(result, optionsExcludePath, excluded);
            }

            if (options.stripComments) {
                result = stripComments(result);
            }

            if (options.notOptimized) {
                result = addNotOptimizedHints(result);
            }

            result = workaround.fixVersionComments(result);
        } else {
            throw new Error(`Error handling include from: ${options.url}`);
        }

        logger.log(`Inclusion lines: ${result.length}`);
        return result;
    };

    /**
     * Compiles filter lines
     *
     * @param template
     * @param trustLevelSettings
     * @param filterName
     */
    const compile = async function (template, trustLevelSettings, filterName) {
        let result = [];
        const excluded = [];

        // https://github.com/AdguardTeam/FiltersCompiler/issues/87
        // collect invalid rules for report
        const invalid = [];

        const lines = splitLines(template);
        // eslint-disable-next-line no-restricted-syntax
        for (const line of lines) {
            if (line.startsWith(INCLUDE_DIRECTIVE)) {
                // eslint-disable-next-line no-await-in-loop
                const inc = await include(line.trim(), excluded);

                let k = 0;
                while (k < inc.length) {
                    result.push(inc[k].trim());
                    k += 1;
                }
            } else {
                result.push(line.trim());
            }
        }

        // bad includes are ignored here because they'll be handled in generator after resolving conditions
        // https://github.com/AdguardTeam/FiltersCompiler/issues/84
        try {
            result = await FiltersDownloader.resolveIncludes(result, currentDir);
        } catch (e) {
            logger.warn(`Error resolving includes in ${filterName}: ${e.message}`);
        }

        result = converter.convertRulesToAdgSyntax(result, excluded);

        const excludeFilePath = path.join(currentDir, EXCLUDE_FILE);
        result = exclude(result, excludeFilePath, excluded);

        logger.info('Applying trust-level exclusions..');
        result = exclude(result, trustLevelSettings, excluded);

        result = validator.validate(result, excluded, invalid, filterName);

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
     * @param path
     * @param hash
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
     * @param filterDir
     * @param whitelist
     * @param blacklist
     */
    const buildFilter = async function (filterDir, whitelist, blacklist) {
        currentDir = filterDir;

        const template = readFile(path.join(currentDir, TEMPLATE_FILE));
        if (!template) {
            throw new Error('Invalid template');
        }

        const metadata = JSON.parse(readFile(path.join(currentDir, METADATA_FILE)));
        if (metadata.disabled) {
            logger.warn('Filter skipped');
            report.skipFilter(metadata);
            return;
        }

        const { filterId } = metadata;
        if (whitelist && whitelist.length > 0 && whitelist.indexOf(filterId) < 0) {
            logger.info(`Filter ${filterId} skipped with whitelist`);
            return;
        }

        if (blacklist && blacklist.length > 0 && blacklist.indexOf(filterId) >= 0) {
            logger.info(`Filter ${filterId} skipped with blacklist`);
            return;
        }

        const trustLevel = metadata.trustLevel ? metadata.trustLevel : DEFAULT_TRUST_LEVEL;
        // eslint-disable-next-line no-undef
        const trustLevelSettings = path.resolve(__dirname, TRUST_LEVEL_DIR, `exclusions-${trustLevel}.txt`);

        const { name } = metadata;
        logger.info(`Compiling ${name}`);
        const result = await compile(template, trustLevelSettings, name);

        if (!validator.checkAffinityDirectives(result.lines)) {
            throw new Error(`Error validating !#safari_cb_affinity directive in filter ${filterId}`);
        }

        const compiled = result.lines;
        const { excluded, invalid } = result;

        report.addFilter(metadata, result, invalid);
        logger.info(`Compiled length:${compiled.length}`);
        logger.info(`Excluded length:${excluded.length}`);

        const compiledData = compiled.join('\r\n');

        logger.info(`Writing filter file, lines:${compiled.length}`);
        writeFile(path.join(currentDir, FILTER_FILE), compiledData);
        logger.info(`Writing excluded file, lines:${excluded.length}`);
        writeFile(path.join(currentDir, EXCLUDED_LINES_FILE), excluded.join('\r\n'));
        logger.info('Writing revision file..');

        // eslint-disable-next-line no-buffer-constructor
        const hash = Buffer.from(md5(compiledData, { asString: true })).toString('base64').trim();
        const revisionFile = path.join(currentDir, REVISION_FILE);
        const revision = makeRevision(revisionFile, hash);
        writeFile(revisionFile, JSON.stringify(revision, null, '\t'));
    };

    /**
     * Parses directory recursive
     *
     * @param filtersDir
     * @param whitelist
     * @param blacklist
     */
    const parseDirectory = async function (filtersDir, whitelist, blacklist) {
        const items = fs.readdirSync(filtersDir);

        // eslint-disable-next-line no-restricted-syntax
        for (const directory of items) {
            const filterDir = path.join(filtersDir, directory);
            if (fs.lstatSync(filterDir).isDirectory()) {
                const template = path.join(filterDir, TEMPLATE_FILE);
                if (fs.existsSync(template)) {
                    logger.info(`Building filter: ${directory}`);
                    // eslint-disable-next-line no-await-in-loop
                    await buildFilter(filterDir, whitelist, blacklist);
                    logger.info(`Building filter: ${directory} ok`);
                } else {
                    // eslint-disable-next-line no-await-in-loop
                    await parseDirectory(filterDir, whitelist, blacklist);
                }
            }
        }
    };

    /**
     * Builds all filters in child directories
     *
     * @param filtersDir
     * @param logFile
     * @param reportFile
     * @param platformsPath
     * @param platformsConfig
     * @param whitelist
     * @param blacklist
     */
    const build = async function (
        filtersDir,
        logFile,
        reportFile,
        platformsPath,
        platformsConfig,
        whitelist,
        blacklist
    ) {
        logger.initialize(logFile);
        generator.init(FILTER_FILE, METADATA_FILE, REVISION_FILE, platformsConfig, ADGUARD_FILTERS_SERVER_URL);

        await parseDirectory(filtersDir, whitelist, blacklist);

        logger.info('Generating platforms');
        await generator.generate(filtersDir, platformsPath, whitelist, blacklist);
        logger.info('Generating platforms done');
        report.create(reportFile);
    };

    return {
        build,
    };
}());
