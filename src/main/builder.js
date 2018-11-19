/* globals require, Buffer */

module.exports = (function () {

    'use strict';

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

    const version = require("./utils/version.js");
    const converter = require("./converter.js");
    const validator = require("./validator.js");
    const sorter = require("./sorting.js");
    const generator = require("./platforms/generator.js");
    const logger = require("./utils/log.js");
    const utils = require("./utils/utils.js");
    const RuleMasks = require("./rule/rule-masks");
    const workaround = require('./utils/workaround.js');
    const webutils = require('./utils/webutils.js');

    const FilterDownloader = require('filters-downloader');

    const TEMPLATE_FILE = 'template.txt';
    const FILTER_FILE = 'filter.txt';
    const REVISION_FILE = 'revision.json';
    const EXCLUDE_FILE = 'exclude.txt';
    const EXCLUDED_LINES_FILE = 'diff.txt';
    const METADATA_FILE = 'metadata.json';


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

        return fs.readFileSync(path, {encoding: 'utf-8'});
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

            if (line.startsWith(RuleMasks.MASK_HINT) || line.startsWith(RuleMasks.MASK_DIRECTIVES)) {
                return true;
            }

            return !line.startsWith(RuleMasks.MASK_COMMENT);
        });
    };

    /**
     * Checks if line is excluded with specified set of exclusions
     *
     * @param line
     * @param exclusions
     * @param excluded
     */
    const isExcluded = function (line, exclusions, excluded) {
        for (let exclusion of exclusions) {
            exclusion = exclusion.trim();

            if (exclusion && !exclusion.startsWith('!')) {
                let message = `${line} is excluded by: ${exclusion}`;

                let isExcludedByRegexp = exclusion.startsWith("/") && exclusion.endsWith("/") &&
                    line.match(new RegExp(exclusion.substring(1, exclusion.length - 1)));

                if (isExcludedByRegexp || line.includes(exclusion)) {
                    logger.log(message);
                    excluded.push('! ' + message);
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
     * @param exclusionsFileName
     * @param excluded
     * @returns {*}
     */
    const exclude = function (lines, exclusionsFileName, excluded) {

        logger.info('Applying exclusions..');

        const exclusionsFile = path.join(currentDir, exclusionsFileName);
        let exclusions = readFile(exclusionsFile);
        if (!exclusions) {
            return lines;
        }

        exclusions = splitLines(exclusions);

        const result = [];

        lines.forEach((line, pos) => {
            const exclusion = isExcluded(line, exclusions, excluded);
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
            s = s.substring(1, t--);
        }
        if (s.charAt(--t) === '"') {
            s = s.substring(0, t);
        }
        return s;
    };

    /**
     * Parses include line
     *
     * @param line
     * @returns {{url: string, stripComments: boolean, exclude: *}}
     */
    const parseIncludeLine = function (line) {
        const parts = line.split(' ');

        let url = parts[1].trim();

        url = stripEndQuotes(url);

        let stripComments = false;
        let exclude = null;

        for (let i = 1; i < parts.length; i++) {
            let attribute = parts[i].trim();
            if (attribute.startsWith("/stripComments")) {
                stripComments = true;
            } else if (attribute.startsWith("/exclude=")) {
                exclude = attribute.substring(attribute.indexOf('=') + 1);
                exclude = stripEndQuotes(exclude);
            }
        }

        return {
            url: url,
            stripComments: stripComments,
            exclude: exclude
        };
    };

    /**
     * Checks if lines contains invalid redirect directives
     *
     * @param lines
     * @param url
     */
    const checkRedirects = function (lines, url) {
        for (let line of lines) {
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
    const include = async function(line, excluded) {
        let result = [];

        const options = parseIncludeLine(line);

        if (!options.url) {
            logger.warn('Invalid include url');
            return result;
        }

        logger.log(`Applying inclusion from: ${options.url}`);

        let externalInclude = options.url.includes(':');
        const included = externalInclude ?
            webutils.downloadFile(options.url) :
            readFile(path.join(currentDir, options.url));

        if (included) {
            result = workaround.removeAdblockVersion(included);
            result = splitLines(result);

            checkRedirects(result, options.url);

            // resolved includes
            let originUrl = externalInclude ? FilterDownloader.getFilterUrlOrigin(options.url) : currentDir;
            result = await FilterDownloader.resolveIncludes(result, originUrl);

            if (options.exclude) {
                result = exclude(result, options.exclude, excluded);
            }

            if (options.stripComments) {
                result = stripComments(result);
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
     */
    const compile = async function(template) {
        let result = [];
        let excluded = [];

        const lines = splitLines(template);
        for (let line of lines) {
            if (line.startsWith('@include ')) {
                const inc = await include(line.trim(), excluded);

                let k = 0;
                while (k < inc.length) {
                    result.push(inc[k].trim());
                    k++;
                }
            } else {
                result.push(line.trim());
            }
        }

        result = await FilterDownloader.resolveIncludes(result, currentDir);

        result = converter.convert(result, excluded);

        result = exclude(result, EXCLUDE_FILE, excluded);

        result = validator.validate(result, excluded);
        result = validator.blacklistDomains(result, excluded);

        return {
            lines: result,
            excluded: excluded
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
    const makeRevision = function(path, hash) {
        const result = {
            "version": "1.0.0.0",
            "timeUpdated": new Date().getTime(),
            "hash": hash
        };

        const current = readFile(path);
        if (current) {
            let currentRevision = JSON.parse(current);
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
            return;
        }

        const filterId = metadata.filterId;
        if (whitelist && whitelist.length > 0 && whitelist.indexOf(filterId) < 0) {
            logger.info(`Filter ${filterId} skipped with whitelist`);
            return;
        }

        if (blacklist && blacklist.length > 0 && blacklist.indexOf(filterId) >= 0) {
            logger.info(`Filter ${filterId} skipped with blacklist`);
            return;
        }

        logger.info('Compiling...');
        const result = await compile(template);
        const compiled = result.lines;
        const excluded = result.excluded;
        logger.info('Compiled length:' + compiled.length);
        logger.info('Excluded length:' + excluded.length);

        const compiledData = compiled.join('\r\n');

        logger.info('Writing filter file, lines:' + compiled.length);
        writeFile(path.join(currentDir, FILTER_FILE), compiledData);
        logger.info('Writing excluded file, lines:' + excluded.length);
        writeFile(path.join(currentDir, EXCLUDED_LINES_FILE), excluded.join('\r\n'));
        logger.info('Writing revision file..');

        const hash = new Buffer(md5(compiledData, {asString: true})).toString('base64').trim();
        const revisionFile = path.join(currentDir, REVISION_FILE);
        const revision = makeRevision(revisionFile, hash);
        writeFile(revisionFile, JSON.stringify(revision, null, "\t"));
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

        for (let directory of items) {
            const filterDir = path.join(filtersDir, directory);
            if (fs.lstatSync(filterDir).isDirectory()) {

                let template = path.join(filterDir, TEMPLATE_FILE);
                if (fs.existsSync(template)) {
                    logger.info(`Building filter: ${directory}`);
                    await buildFilter(filterDir, whitelist, blacklist);
                    logger.info(`Building filter: ${directory} ok`);
                } else {
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
     * @param domainBlacklistFile
     * @param platformsPath
     * @param whitelist
     * @param blacklist
     */
    const build = async function (filtersDir, logFile, domainBlacklistFile, platformsPath, platformsConfigFile, whitelist, blacklist) {
        logger.initialize(logFile);
        validator.init(domainBlacklistFile);
        generator.init(FILTER_FILE, METADATA_FILE, REVISION_FILE, platformsConfigFile);

        await parseDirectory(filtersDir, whitelist, blacklist);

        logger.info(`Generating platforms`);
        generator.generate(filtersDir, platformsPath, whitelist, blacklist);
        logger.info(`Generating platforms done`);
    };

    return {
        build: build
    };
})();
