/* globals require, Buffer */

module.exports = (() => {

    'use strict';

    const fs = require('fs');
    const path = require('path');
    const md5 = require('md5');
    const downloadFileSync = require('download-file-sync');

    const logger = require("../utils/log.js");
    const filter = require("./filter.js");
    const workaround = require('../utils/workaround.js');

    const RULES_SEPARATOR = "\r\n";

    const OPTIMIZATION_STATS_DOWNLOAD_URL = 'https://chrome.adtidy.org/filters/{0}/stats.json?key=4DDBE80A3DA94D819A00523252FB6380';

    /**
     * Platforms configurations
     */
    let platformPathsConfig = null;
    let filterFile = null;
    let metadataFile = null;
    let revisionFile = null;
    let optimizationEnabled = true;

    /**
     * Sync reads file content
     *
     * @param path
     * @returns {*}
     */
    const readFile = function (path) {
        try {
            return fs.readFileSync(path, {encoding: 'utf-8'});
        } catch (e) {
            return null;
        }
    };

    /**
     * Creates header contents
     *
     * @param metadataFile
     * @param revisionFile
     * @returns {[*,*,*,*,string]}
     */
    const makeHeader = function (metadataFile, revisionFile) {
        const metadataString = readFile(metadataFile);
        if (!metadataString) {
            throw new Error('Error reading metadata');
        }

        const metadata = JSON.parse(metadataString);

        const revisionString = readFile(revisionFile);
        if (!revisionString) {
            throw new Error('Error reading revision');
        }

        const revision = JSON.parse(revisionString);

        return [
            `! Title: ${metadata.name}`,
            `! Description: ${metadata.description}`,
            `! Version: ${revision.version}`,
            `! TimeUpdated: ${new Date(revision.timeUpdated).toDateString()}`,
            `! Expires: ${metadata.expires} (update frequency)`
        ];
    };

    /**
     * Strips spec character from end of string
     *
     * @param string
     * @param char
     */
    const stripEnd = function (string, char) {
        if (string.endsWith(char)) {
            return stripEnd(string.substring(0, string.length - 1));
        } else {
            return string;
        }
    };

    /**
     * Calculates checksum
     * See:
     * https://adblockplus.org/en/filters#special-comments
     * https://hg.adblockplus.org/adblockplus/file/tip/addChecksum.py
     *
     * @param header Header lines
     * @param rules  Rules lines
     */
    const calculateChecksum = function (header, rules) {
        const content = header.concat(rules).join("\n");
        const checksum = new Buffer(md5(content, {asString: true})).toString('base64');
        return "! Checksum: " + stripEnd(checksum.trim(), "=");
    };

    /**
     * This will create a dir given a path such as './folder/subfolder'
     *
     * @param dir
     */
    const createDir = (dir) => {
        const splitPath = dir.split('/');
        splitPath.reduce((path, subPath) => {
            let currentPath;
            if (subPath !== '.') {
                currentPath = path + '/' + subPath;
                if (!fs.existsSync(currentPath)) {
                    fs.mkdirSync(currentPath);
                }
            } else {
                currentPath = subPath;
            }

            return currentPath;
        }, '');
    };

    /**
     * Replaces tags keywords with tag ids
     *
     * @param filters
     * @param tags
     */
    const replaceTagKeywords = function (filters, tags) {
        const tagsMap = new Map();

        tags.forEach((f) => {
            tagsMap.set(f.keyword, f.tagId);
        });

        for (const f of filters) {
            if (f.tags) {
                let ids = [];
                for (const t of f.tags) {
                    let id = tagsMap.get(t);
                    if (id) {
                        ids.push(id);
                    } else {
                        logger.error("Missing tag with keyword: " + t);
                    }
                }

                delete f.tags;
                f.tags = ids;
            }
        }

        return filters;
    };

    /**
     * Parses "Expires" field and converts it to seconds
     *
     * @param filters
     */
    const replaceExpires = function (filters) {
        for (const f of filters) {
            if (f.expires) {
                if (f.expires.indexOf('day') > 0) {
                    f.expires = parseInt(f.expires) * 24 * 60 * 60;
                } else if (f.expires.indexOf('hour') > 0) {
                    f.expires = parseInt(f.expires) * 60 * 60;
                }

                if (isNaN(f.expires)) {
                    //Default
                    f.expires = 86400;
                }
            }
        }

        return filters;
    };

    /**
     * In case of backward compatibility
     * Adds 'languages' metadata field parsed from 'lang:' tags
     *
     * @param filters
     * @param tags
     */
    const parseLangTags = function (filters) {
        for (const f of filters) {
            if (f.tags) {
                const filterLanguages = [];
                for (const t of f.tags) {
                    if (t.startsWith('lang:')) {
                        filterLanguages.push(t.substring(5));
                    }
                }

                f.languages = filterLanguages;
            }
        }

        return filters;
    };

    /**
     * Writes metadata files
     */
    const writeFiltersMetadata = function (platformsPath, filtersDir, filtersMetadata) {
        logger.log('Writing filters metadata');

        const groups = JSON.parse(readFile(path.join(filtersDir, '../groups', 'metadata.json')));
        if (!groups) {
            logger.error('Error reading groups metadata');
            return;
        }

        let tags = JSON.parse(readFile(path.join(filtersDir, '../tags', 'metadata.json')));
        if (!tags) {
            logger.error('Error reading tags metadata');
            return;
        }

        filtersMetadata = parseLangTags(filtersMetadata);
        filtersMetadata = replaceTagKeywords(filtersMetadata, tags);
        filtersMetadata = replaceExpires(filtersMetadata);

        const localizations = loadLocales(path.join(filtersDir, '../locales'));

        for (let platform in platformPathsConfig) {
            const config = platformPathsConfig[platform];
            const platformDir = path.join(platformsPath, config.path);
            createDir(platformDir);

            logger.log('Writing filters metadata: ' + config.path);
            const filtersFile = path.join(platformDir, 'filters.json');
            const metadata = {groups: groups, tags: tags, filters: filtersMetadata};
            if (platform === 'MAC') {
                //Hide tag fields for old app versions
                delete metadata.tags;
            }
            fs.writeFileSync(filtersFile, JSON.stringify(metadata, null, '\t'), 'utf8');

            logger.log('Writing filters localizations: ' + config.path);
            const filtersI18nFile = path.join(platformDir, 'filters_i18n.json');
            const i18nMetadata = {groups: localizations.groups, tags: localizations.tags, filters: localizations.filters};
            if (platform === 'MAC') {
                //Hide tag fields for old app versions
                delete i18nMetadata.tags;
            }
            fs.writeFileSync(filtersI18nFile, JSON.stringify(i18nMetadata, null, '\t'), 'utf8');
        }

        logger.log('Writing filters metadata done');
    };

    /**
     * Loads filter metadata
     *
     * @param filterDir
     * @returns {null}
     */
    const loadFilterMetadata = function (filterDir) {
        const metadataFilePath = path.join(filterDir, metadataFile);
        const metadataString = readFile(metadataFilePath);
        if (!metadataString) {
            throw new Error('Error reading filter metadata:' + filterDir);
        }

        const revisionFilePath = path.join(filterDir, revisionFile);
        const revisionString = readFile(revisionFilePath);
        if (!revisionString) {
            throw new Error('Error reading filter revision:' + filterDir);
        }

        const revision = JSON.parse(revisionString);

        const result = JSON.parse(metadataString);
        result.version = revision.version;
        result.timeUpdated = revision.timeUpdated;
        delete result.disabled;

        return result;
    };

    /**
     * Parses object info
     * Splits string {mask}{id}.{message} like "group.1.name" etc.
     *
     * @param string
     * @param mask
     * @returns {{id: *, message: *}}
     */
    const parseInfo = (string, mask) => {
        let searchIndex = string.indexOf(mask) + mask.length;

        return {
            id: string.substring(searchIndex, string.indexOf('.', searchIndex)),
            message: string.substring(string.lastIndexOf('.') + 1)
        };
    };

    /**
     * Loads localizations
     *
     * @param dir
     */
    const loadLocales = function (dir) {

        const result = {
            groups: {},
            tags: {},
            filters: {}
        };

        const locales = fs.readdirSync(dir);
        for (let directory of locales) {
            const localeDir = path.join(dir, directory);
            if (fs.lstatSync(localeDir).isDirectory()) {
                const groups = JSON.parse(readFile(path.join(localeDir, 'groups.json')));
                if (groups) {
                    for (let group of groups) {
                        for (let p in group) {
                            const info = parseInfo(p, 'group.');
                            if (!info || !info.id) {
                                continue;
                            }

                            let id = info.id;
                            result.groups[id] = result.groups[id] || {};
                            result.groups[id][directory] = result.groups[id][directory] || {};
                            result.groups[id][directory][info.message] = group[p];
                        }
                    }
                }

                let tags = JSON.parse(readFile(path.join(localeDir, 'tags.json')));
                if (tags) {
                    for (let tag of tags) {
                        for (let p in tag) {
                            const info = parseInfo(p, 'tag.');
                            if (!info || !info.id) {
                                continue;
                            }

                            let id = info.id;
                            result.tags[id] = result.tags[id] || {};
                            result.tags[id][directory] = result.tags[id][directory] || {};
                            result.tags[id][directory][info.message] = tag[p];
                        }
                    }
                }

                let filters = JSON.parse(readFile(path.join(localeDir, 'filters.json')));
                if (filters) {
                    for (let filter of filters) {
                        for (let p in filter) {
                            const info = parseInfo(p, 'filter.');
                            if (!info || !info.id) {
                                continue;
                            }

                            let id = info.id;
                            result.filters[id] = result.filters[id] || {};
                            result.filters[id][directory] = result.filters[id][directory] || {};
                            result.filters[id][directory][info.message] = filter[p];
                        }
                    }
                }
            }
        }

        return result;
    };

    /**
     * Writes filter platform build
     */
    const writeFilterRules = function (filterId, dir, platform, rulesHeader, rules, optimized) {
        const filterFile = path.join(dir, `${filterId}${optimized ? '_optimized' : ''}.txt`);

        const data = rulesHeader.concat(rules).join(RULES_SEPARATOR);

        createDir(dir);

        // For English filter only we should provide additional filter version.
        if (filterId == 2 && platform === 'ext_ublock' && !optimized) {
            const correctedFile = path.join(dir, `${filterId}_without_easylist.txt`);

            let correctedHeader = workaround.rewriteHeader(rulesHeader);
            let correctedRules = workaround.rewriteRules(rules);
            const header = [calculateChecksum(correctedHeader, correctedRules)].concat(correctedHeader);
            const correctedData = header.concat(correctedRules).join(RULES_SEPARATOR);

            fs.writeFileSync(correctedFile, correctedData, 'utf8');
        }

        fs.writeFileSync(filterFile, data, 'utf8');
    };

    /**
     * Builds platforms for filter
     *
     * @param filterDir
     * @param platformsPath
     */
    const buildFilter = function (filterDir, platformsPath) {

        let mask = 'filter_';
        const filterId = filterDir.substring(filterDir.lastIndexOf(mask) + mask.length, filterDir.lastIndexOf('_'));

        const originalRules = readFile(path.join(filterDir, filterFile)).split('\r\n');

        const metadataFilePath = path.join(filterDir, metadataFile);
        const revisionFilePath = path.join(filterDir, revisionFile);
        const header = makeHeader(metadataFilePath, revisionFilePath);

        let optimizationConfig;
        if (optimizationEnabled) {
            optimizationConfig = downloadFileSync(OPTIMIZATION_STATS_DOWNLOAD_URL.replace('{0}', filterId));
            optimizationConfig = JSON.parse(optimizationConfig);
        }

        for (let platform in platformPathsConfig) {

            const config = platformPathsConfig[platform];
            const rules = filter.cleanupRules(originalRules, config);
            const optimizedRules = filter.cleanupAndOptimizeRules(originalRules, config, optimizationConfig, filterId);

            const platformHeader = [calculateChecksum(header, rules)].concat(header);
            const platformOptimizedHeader = [calculateChecksum(header, optimizedRules)].concat(header);

            logger.log(`Filter ${filterId}. Rules ${originalRules.length} => ${rules.length} => ${optimizedRules.length}. PlatformPath: '${config.path}'`);

            const platformDir = path.join(platformsPath, config.path);
            writeFilterRules(filterId, platformDir, config.platform, platformHeader, rules, false);
            writeFilterRules(filterId, platformDir, config.platform, platformOptimizedHeader, optimizedRules, true);
        }
    };

    /**
     * Initializes service
     *
     * @param filterFileName
     * @param metadataFileName
     * @param revisionFileName
     */
    const init = function (filterFileName, metadataFileName, revisionFileName, platformsConfigFile) {
        filterFile = filterFileName;
        metadataFile = metadataFileName;
        revisionFile = revisionFileName;

        const config = readFile(platformsConfigFile);
        if (!config) {
            logger.error('Platforms config file is invalid: ' + platformsConfigFile);
            return;
        }

        platformPathsConfig = JSON.parse(config);
    };

    /**
     * Parses directory recursive
     *
     * @param filtersDir
     * @param filtersMetadata
     */
    const parseDirectory = function (filtersDir, filtersMetadata, platformsPath) {
        const items = fs.readdirSync(filtersDir);
        for (let directory of items) {
            const filterDir = path.join(filtersDir, directory);
            if (fs.lstatSync(filterDir).isDirectory()) {

                let metadataFilePath = path.join(filterDir, metadataFile);
                if (fs.existsSync(metadataFilePath)) {
                    logger.log(`Building filter platforms: ${directory}`);
                    buildFilter(filterDir, platformsPath);
                    logger.log(`Building filter platforms: ${directory} done`);

                    filtersMetadata.push(loadFilterMetadata(filterDir));
                } else {
                    parseDirectory(filterDir, filtersMetadata, platformsPath);
                }
            }
        }
    };

    /**
     * Generates platforms builds
     *
     * @param filtersDir
     * @param platformsPath
     */
    const generate = function (filtersDir, platformsPath) {
        if (!platformsPath) {
            logger.warn('Platforms build output path is not specified');
            return;
        }

        if (!platformPathsConfig) {
            logger.warn('Platforms configuration is not specified');
            return;
        }

        createDir(platformsPath);

        const filtersMetadata = [];

        parseDirectory(filtersDir, filtersMetadata, platformsPath);

        writeFiltersMetadata(platformsPath, filtersDir, filtersMetadata);
    };

    /**
     * Disables optimized filter builds
     */
    const disableOptimization = function () {
        optimizationEnabled = false;
    };

    return {
        init: init,
        generate: generate,
        disableOptimization: disableOptimization
    };
})();