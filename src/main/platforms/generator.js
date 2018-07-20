/* globals require, Buffer */

module.exports = (() => {

    'use strict';

    const fs = require('fs');
    const path = require('path');
    const crypto = require('crypto');
    const moment = require('moment');

    const logger = require("../utils/log.js");
    const filter = require("./filter.js");
    const workaround = require('../utils/workaround.js');
    const optimization = require('../optimization');

    const FilterDownloader = require('filters-downloader');

    const RULES_SEPARATOR = "\r\n";
    const filterIdsPool = [];
    const metadataFilterIdsPool = [];

    /**
     * Platforms configurations
     */
    let platformPathsConfig = null;
    let filterFile = null;
    let metadataFile = null;
    let revisionFile = null;

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
            `! TimeUpdated: ${moment(revision.timeUpdated).format()}`,
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
            return stripEnd(string.substring(0, string.length - 1), char);
        } else {
            return string;
        }
    };

    /**
     * Checks if filter id is unique
     *
     * @param pool
     * @param filterId
     */
    const checkFilterId = function (pool, filterId) {
        if (pool.indexOf(filterId) >= 0) {
            throw new Error('Invalid filters: Filter identifier is not unique: ' + filterId);
        }

        pool.push(filterId);
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
        let content = header.concat(rules).join("\n");
        content = normalizeData(content);
        const checksum = crypto.createHash('md5').update(content).digest("base64");

        return "! Checksum: " + stripEnd(checksum.trim(), "=");
    };

    /**
     * Replaces newlines
     *
     * @param message
     * @returns {XML|string|*}
     */
    const normalizeData = function (message) {
        message = message.replace(/\r/g, "");
        message = message.replace(/\n+/g, "\n");
        return message;
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

        const lostTags = [];
        for (const f of filters) {
            if (f.tags) {
                let ids = [];
                for (const t of f.tags) {
                    let id = tagsMap.get(t);
                    if (id) {
                        ids.push(id);
                    } else {
                        logger.error("Missing tag with keyword: " + t);
                        lostTags.push(t);
                    }
                }

                delete f.tags;
                f.tags = ids;
            }
        }

        if (lostTags.length > 0) {
            throw new Error("Missing tag with keyword: " + lostTags.join(', '));
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
     */
    const parseLangTags = function (filters) {
        for (const f of filters) {
            if (f.tags) {
                const filterLanguages = [];
                let hasRecommended = false;
                for (const t of f.tags) {
                    if (!hasRecommended && t === 'recommended') {
                        hasRecommended = true;
                    }

                    if (t.startsWith('lang:')) {
                        filterLanguages.push(t.substring(5));
                    }
                }

                // Languages will be added for recommended filters only
                f.languages = hasRecommended ? filterLanguages : [];
            }
        }

        return filters;
    };

    /**
     * Writes metadata files
     */
    const writeFiltersMetadata = function (platformsPath, filtersDir, filtersMetadata) {
        logger.info('Writing filters metadata');

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

            logger.info('Writing filters metadata: ' + config.path);
            const filtersFile = path.join(platformDir, 'filters.json');
            let metadata = {groups: groups, tags: tags, filters: filtersMetadata};
            if (platform === 'MAC') {
                metadata = workaround.rewriteMetadataForOldMac(metadata);
            }

            fs.writeFileSync(filtersFile, JSON.stringify(metadata, null, '\t'), 'utf8');

            logger.info('Writing filters localizations: ' + config.path);
            const filtersI18nFile = path.join(platformDir, 'filters_i18n.json');
            let i18nMetadata = {groups: localizations.groups, tags: localizations.tags, filters: localizations.filters};
            if (platform === 'MAC') {
                delete i18nMetadata.tags;
            }

            fs.writeFileSync(filtersI18nFile, JSON.stringify(i18nMetadata, null, '\t'), 'utf8');
        }

        logger.info('Writing filters metadata done');
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
        result.timeUpdated = moment(revision.timeUpdated).format("YYYY-MM-DDTHH:mm:ssZZ");
        result.timeAdded = moment(result.timeAdded).format("YYYY-MM-DDTHH:mm:ssZZ");
        delete result.disabled;

        checkFilterId(metadataFilterIdsPool, result.filterId);

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
    const writeFilterRules = function (filterId, dir, config, rulesHeader, rules, optimized) {

        createDir(dir);

        const filterFile = path.join(dir, `${filterId}${optimized ? '_optimized' : ''}.txt`);
        writeFilterFile(filterFile, config.configuration.adbHeader, rulesHeader, rules);

        // For English filter only we should provide additional filter version.
        if (filterId == 2 && config.platform === 'ext_ublock' && !optimized) {
            const correctedHeader = workaround.rewriteHeader(rulesHeader);
            const correctedRules = workaround.rewriteRules(rules);

            const correctedFile = path.join(dir, `${filterId}_without_easylist.txt`);
            writeFilterFile(correctedFile, config.configuration.adbHeader, correctedHeader, correctedRules);
        }
    };

    /**
     * Calculates checksum and writes filter file
     *
     * @param filterFile
     * @param adbHeader
     * @param rulesHeader
     * @param rules
     */
    const writeFilterFile = function (filterFile, adbHeader, rulesHeader, rules) {
        let header = rulesHeader;
        if (adbHeader) {
            // Add Adb Plus compatibility header
            header = [adbHeader].concat(rulesHeader);
        }

        const checksum = calculateChecksum(header, rules);

        let data = [checksum].concat(rulesHeader).concat(rules);
        if (adbHeader) {
            data = [adbHeader].concat(data);
        }

        fs.writeFileSync(filterFile, data.join(RULES_SEPARATOR), 'utf8');
    };

    /**
     * Removes rules array duplicates,
     * ignores comments and hinted rules
     *
     * @param list a list of rules to filter
     * @returns {*} a list of ruls without duplicate
     */
    const removeRuleDuplicates = function (list) {
        logger.info('Removing duplicates..');

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
            }

            return result;
        });
    };

    /**
     * Builds platforms for filter
     *
     * @param filterDir
     * @param platformsPath
     */
    const buildFilter = function (filterDir, platformsPath) {

        const mask = 'filter_';
        const start = filterDir.lastIndexOf(mask) + mask.length;
        const filterId = filterDir.substring(start, filterDir.indexOf('_', start));

        checkFilterId(filterIdsPool, filterId);

        const originalRules = readFile(path.join(filterDir, filterFile)).split('\r\n');

        const metadataFilePath = path.join(filterDir, metadataFile);
        const revisionFilePath = path.join(filterDir, revisionFile);
        const header = makeHeader(metadataFilePath, revisionFilePath);

        const metadata = JSON.parse(readFile(metadataFilePath));
        if (metadata.disabled) {
            logger.warn('Filter skipped');
            return;
        }

        const optimizationConfig = optimization.getFilterOptimizationConfig(filterId);

        for (let platform in platformPathsConfig) {
            const config = platformPathsConfig[platform];
            let rules = FilterDownloader.resolveConditions(originalRules, config.defines);
            rules = filter.cleanupRules(rules, config);
            let optimizedRules = filter.cleanupAndOptimizeRules(originalRules, config, optimizationConfig, filterId);

            rules = removeRuleDuplicates(rules);
            optimizedRules = removeRuleDuplicates(rules);

            logger.log(`Filter ${filterId}. Rules ${originalRules.length} => ${rules.length} => ${optimizedRules.length}. PlatformPath: '${config.path}'`);

            const platformDir = path.join(platformsPath, config.path, 'filters');
            writeFilterRules(filterId, platformDir, config, header, rules, false);
            writeFilterRules(filterId, platformDir, config, header, optimizedRules, true);
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
                    logger.info(`Building filter platforms: ${directory}`);
                    buildFilter(filterDir, platformsPath);
                    logger.info(`Building filter platforms: ${directory} done`);

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
     * @param {String} filtersDir
     * @param {String} platformsPath
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

    return {
        init: init,
        generate: generate
    };
})();
