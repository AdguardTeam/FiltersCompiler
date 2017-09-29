/* globals module, require, console */

//TODO: Write detailed log to file

module.exports = (function () {

    'use strict';

    var fs = require('fs');
    var path = require('path');

    var version = require("./utils/version.js");
    var converter = require("./converter.js");
    var logger = require("./utils/log.js");

    var TEMPLATE_FILE = 'template.txt';
    var FILTER_FILE = 'filter.txt';
    var REVISION_FILE = 'revision.json';
    var METADATA_FILE = 'metadata.json';
    var EXCLUDE_FILE = 'exclude.txt';

    var currentDir;

    /**
     * Sync reads file content
     *
     * @param path
     * @returns {*}
     */
    var readFile = function (path) {
        try {
            return fs.readFileSync(path, {encoding: 'utf-8'});
        } catch (e) {
            return null;
        }
    };

    /**
     * Sync writes content to file
     *
     * @param path
     * @param data
     */
    var writeFile = function (path, data) {
        fs.writeFileSync(path, data, 'utf8', {encoding: 'utf-8'});
    };

    /**
     * Sync downloads file from url
     *
     * @param url
     */
    var downloadFile = function (url) {
        logger.log("Downloading " + url);

        var downloadFileSync = require('download-file-sync');
        var content = downloadFileSync(url);

        return content;
    };

    /**
     * Splits lines
     *
     * @param lines
     */
    var splitLines = function (string) {
        return string.replace('\r', '\n').replace('\n\n', '\n').split('\n');
    };

    /**
     * Removes comments from lines
     *
     * @param lines
     */
    var stripComments = function (lines) {
        logger.log('Stripping comments');

        var result = [];

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (line.indexOf('!') !== 0) {
                result.push(line);
            }
        }

        return result;
    };

    /**
     * Applies exclusion from exclusions file
     *
     * @param lines
     * @param exclusionsFileName
     * @returns {*}
     */
    var exclude = function (lines, exclusionsFileName) {

        logger.log('Applying exclusions');

        var exclusionsFile = path.join(currentDir, exclusionsFileName);
        var exclusions = readFile(exclusionsFile);
        if (!exclusions) {
            return lines;
        }

        exclusions = splitLines(exclusions);

        var result = [];
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];

            var flag = false;
            for (var k = 0; k < exclusions.length; k++) {
                if (line.indexOf(exclusions[k].trim()) >= 0) {
                    flag = true;
                    break;
                }
            }

            if (!flag) {
                result.push(line);
            }
        }

        logger.log('Excluded lines: ' + (lines.length - result.length));

        return result;
    };

    /**
     * Parses include line
     *
     * @param line
     * @returns {{url: string, stripComments: boolean, exclude: *}}
     */
    var parseIncludeLine = function (line) {
        var parts = line.split(' ');

        var url = parts[1].trim();

        function stripEndQuotes(s) {
            var t = s.length;
            if (s.charAt(0) === '"') {
                s = s.substring(1, t--);
            }
            if (s.charAt(--t) === '"') {
                s = s.substring(0, t);
            }
            return s;
        }

        url = stripEndQuotes(url);

        var stripComments = false;
        var exclude = null;

        for (var i = 1; i < parts.length; i++) {
            var attribute = parts[i].trim();
            if (attribute.indexOf("/stripComments") === 0) {
                stripComments = true;
            } else if (attribute.indexOf("/exclude=") === 0) {
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
     * @returns {Array}
     */
    var include = function (line) {
        var result = [];

        var options = parseIncludeLine(line);

        if (!options.url) {
            logger.warn('Invalid include url');
            return result;
        }

        logger.log('Applying inclusion from ' + options.url);

        var included;
        if (options.url.indexOf(':') >= 0) {
            // remote file
            included = downloadFile(options.url);
        } else {
            // local file
            included = readFile(path.join(currentDir, options.url));
        }

        if (included) {
            result = splitLines(included);

            if (options.exclude) {
                result = exclude(result, options.exclude);
            }

            if (options.stripComments) {
                result = stripComments(result);
            }
        }

        result = converter.convert(result);

        logger.log('Inclusion lines:' + result.length);

        return result;
    };

    /**
     * Removes duplicates
     *
     * @param list
     * @returns {*}
     */
    var removeDuplicates = function (list) {
        logger.log('Removing duplicates');

        var uniqueArray = list.filter(function(item, pos) {
            return item.indexOf('!') === 0 ||
                list.indexOf(item) === pos;
        });

        return uniqueArray;
    };

    /**
     * Compiles filter lines
     *
     * @param template
     * @returns {Array}
     */
    var compile = function (template) {
        var result = [];

        var lines = splitLines(template);
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (line.indexOf('@include ') === 0) {
                var inc = include(line);
                var k = 0;
                while (k < inc.length) {
                    result.push(inc[k].trim());
                    k++;
                }
            } else {
                result.push(line.trim());
            }
        }

        result = exclude(result, EXCLUDE_FILE);
        result = removeDuplicates(result);

        return result;
    };

    /**
     * Creates revision object
     *
     * @param path
     * @returns {{version: string, timeUpdated: number}}
     */
    var makeRevision = function (path) {
        var result = {
            "version": "1.0.0.0",
            "timeUpdated": new Date().getTime()
        };

        var current = readFile(path);
        if (current) {
            var p = JSON.parse(current);
            if (p.version) {
                result.version = version.increment(p.version);
            }
        }

        return result;
    };

    /**
     * Creates header contents
     *
     * @param metadataFile
     * @param revision
     * @returns {[*,*,*,*,string]}
     */
    var makeHeader = function (metadataFile, revision) {
        logger.log('Adding header');

        //TODO: Add checksum

        var metadataString = readFile(metadataFile);
        if (!metadataString) {
            throw new Error('Error reading metadata');
        }

        var metadata = JSON.parse(metadataString);

        var result = [
            '! Title: ' + metadata.name,
            '! Description: ' + metadata.description,
            '! Version: ' + revision.version,
            '! TimeUpdated: ' + new Date(revision.timeUpdated).toDateString(),
            '! Expires: 2 days (update frequency)'
        ];

        //TODO: Parse expires

        return result;
    };

    /**
     * Builds filter txt file from directory contents
     *
     * @param filterDir
     */
    var buildFilter = function (filterDir) {
        currentDir = filterDir;

        var template = readFile(path.join(currentDir, TEMPLATE_FILE));
        if (!template) {
            throw new Error('Invalid template');
        }

        var revisionFile = path.join(currentDir, REVISION_FILE);
        var revision = makeRevision(revisionFile);

        logger.log('Compiling..');
        var compiled = compile(template);
        logger.log('Compiled length:' + compiled.length);

        var metadataFile = path.join(currentDir, METADATA_FILE);
        var header = makeHeader(metadataFile, revision);

        var filter = header.concat(compiled);

        logger.log('Writing filter file, lines:' + filter.length);
        writeFile(path.join(currentDir, FILTER_FILE), filter.join('\r\n'));
        logger.log('Writing revision file..');
        writeFile(revisionFile, JSON.stringify(revision, null, "\t"));
    };

    /**
     * Builds all filters in child directories
     *
     * @param filtersDir
     * @param logFile
     */
    var build = function (filtersDir, logFile) {
        logger.initialize(logFile);
        
        var items = fs.readdirSync(filtersDir);

        for (var i = 0; i < items.length; i++) {
            var d = items[i];

            var filterDir = path.join(filtersDir, d);
            if (fs.lstatSync(filterDir).isDirectory()) {

                logger.log('Building filter: ' + d);
                buildFilter(filterDir);
                logger.log('Building filter: ' + d + ' ok');
            }
        }
    };

    return {
        build: build
    };
})();

