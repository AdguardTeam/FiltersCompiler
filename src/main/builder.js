/* globals require */

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

            if (line.startsWith(RuleMasks.MASK_HINT)) {
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

            if (!exclusion.startsWith('!')) {
                let message = `${line} is excluded by: ${exclusion}`;

                let isExcludedByRegexp = exclusion.startsWith("/") && exclusion.endsWith("/") &&
                    line.match(new RegExp(exclusion.substring(1, exclusion.length - 2)));

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

        logger.log('Applying exclusions..');

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
     * Removes rules array duplicates,
     * ignores comments and hinted rules
     *
     * @param list
     * @returns {*}
     */
    const removeRuleDuplicates = function (list, excluded) {
        logger.log('Removing duplicates..');

        return list.filter((item, pos) => {
            if (pos > 0) {
                let previous = list[pos - 1];
                if (previous && previous.startsWith(RuleMasks.MASK_HINT)) {
                    return true;
                }
            }

            let duplicatePosition = list.indexOf(item);
            if (duplicatePosition !== pos && duplicatePosition > 0) {
                let duplicate = list[duplicatePosition - 1];
                if (duplicate && duplicate.startsWith(RuleMasks.MASK_HINT)) {
                    return true;
                }
            }

            const result = item.startsWith(RuleMasks.MASK_COMMENT) ||
                duplicatePosition === pos;

            if (!result) {
                logger.log(`${item} removed as duplicate`);
                excluded.push('! Duplicated:');
                excluded.push(item);
            }

            return result;
        });
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
     * Creates content from include line
     *
     * @param line
     * @param excluded
     * @returns {Array}
     */
    const include = function (line, excluded) {
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

        result = converter.convert(result, excluded);

        logger.log(`Inclusion lines: ${result.length}`);

        return result;
    };

    /**
     * Compiles filter lines
     *
     * @param template
     */
    const compile = function (template) {
        let result = [];
        let excluded = [];

        const lines = splitLines(template);
        for (let line of lines) {
            if (line.startsWith('@include ')) {
                const inc = include(line.trim(), excluded);

                let k = 0;
                while (k < inc.length) {
                    result.push(inc[k].trim());
                    k++;
                }
            } else {
                result.push(line.trim());
            }
        }

        result = exclude(result, EXCLUDE_FILE, excluded);
        result = removeRuleDuplicates(result, excluded);

        result = validator.validate(result, excluded);
        result = validator.blacklistDomains(result, excluded);
        //result = sorter.sort(result);

        return {
            lines: result,
            excluded: excluded
        };
    };

    /**
     * Creates revision object
     *
     * @param path
     * @returns {{version: string, timeUpdated: number}}
     */
    const makeRevision = function (path) {
        const result = {
            "version": "1.0.0.0",
            "timeUpdated": new Date().getTime()
        };

        const current = readFile(path);
        if (current) {
            let p = JSON.parse(current);
            if (p && p.version) {
                result.version = version.increment(p.version);
                result.timeUpdated = new Date().getTime();
            }
        }

        return result;
    };

    /**
     * Builds filter txt file from directory contents
     *
     * @param filterDir
     */
    const buildFilter = function (filterDir) {
        currentDir = filterDir;

        const template = readFile(path.join(currentDir, TEMPLATE_FILE));
        if (!template) {
            throw new Error('Invalid template');
        }

        const metadata = readFile(path.join(currentDir, METADATA_FILE));
        if (JSON.parse(metadata).disabled) {
            logger.warn('Filter skipped');
            return;
        }

        const revisionFile = path.join(currentDir, REVISION_FILE);
        const revision = makeRevision(revisionFile);

        logger.log('Compiling..');
        const result = compile(template);
        const compiled = result.lines;
        const excluded = result.excluded;
        logger.log('Compiled length:' + compiled.length);
        logger.log('Excluded length:' + excluded.length);

        logger.log('Writing filter file, lines:' + compiled.length);
        writeFile(path.join(currentDir, FILTER_FILE), compiled.join('\r\n'));
        logger.log('Writing excluded file, lines:' + excluded.length);
        writeFile(path.join(currentDir, EXCLUDED_LINES_FILE), excluded.join('\r\n'));
        logger.log('Writing revision file..');
        writeFile(revisionFile, JSON.stringify(revision, null, "\t"));
    };

    /**
     * Parses directory recursive
     *
     * @param filtersDir
     */
    const parseDirectory = function (filtersDir) {
        const items = fs.readdirSync(filtersDir);

        for (let directory of items) {
            const filterDir = path.join(filtersDir, directory);
            if (fs.lstatSync(filterDir).isDirectory()) {

                let template = path.join(filterDir, TEMPLATE_FILE);
                if (fs.existsSync(template)) {
                    logger.log(`Building filter: ${directory}`);
                    buildFilter(filterDir);
                    logger.log(`Building filter: ${directory} ok`);
                } else {
                    parseDirectory(filterDir);
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
     */
    const build = function (filtersDir, logFile, domainBlacklistFile, platformsPath, platformsConfigFile) {
        logger.initialize(logFile);
        validator.init(domainBlacklistFile);
        generator.init(FILTER_FILE, METADATA_FILE, REVISION_FILE, platformsConfigFile);

        parseDirectory(filtersDir);

        logger.log(`Generating platforms`);
        generator.generate(filtersDir, platformsPath);
        logger.log(`Generating platforms done`);
    };

    return {
        build: build
    };
})();

