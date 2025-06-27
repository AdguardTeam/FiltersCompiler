/* eslint-disable global-require */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import moment from 'moment';

import { FiltersDownloader } from '@adguard/filters-downloader';
import { logger } from '../utils/log';
import { cleanupAndOptimizeRules, cleanupRules } from './filter';
import {
    rewriteRules,
    rewriteHeader,
    removeScriptletRules,
    rewriteMetadataForOldMacV1,
    rewriteMetadataForOldMacV2,
    modifyBaseFilterHeader,
} from '../utils/workaround';
import { convertToUbo } from '../converter';
import { getFilterOptimizationConfig } from '../optimization';
import { RuleMasks } from '../rule/rule-masks';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const RULES_SEPARATOR = '\r\n';
let filterIdsPool = [];
const metadataFilterIdsPool = [];

const OPTIMIZED_PLATFORMS_LIST = ['ext_safari', 'android', 'ios'];

const PLATFORM_FILTERS_DIR = 'filters';
const FILTERS_METADATA_FILE_JSON = 'filters.json';
const FILTERS_I18N_METADATA_FILE_JSON = 'filters_i18n.json';

// AG-20175
const FILTERS_METADATA_FILE_JS = 'filters.js';
const FILTERS_I18N_METADATA_FILE_JS = 'filters_i18n.js';

/**
 * Tag id for obsolete filters.
 *
 * @see {@link https://github.com/AdguardTeam/FiltersRegistry/blob/85f2e9f6f5f7c04797017e713dc5986b22a78840/tags/metadata.json#L184}
 */
const OBSOLETE_TAG_ID = 46;

/**
 * From 1 to 99 we have AdGuard filters
 *
 * @type {number}
 */
const LAST_ADGUARD_FILTER_ID = 99;
const LOCAL_SCRIPT_RULES_FILE = 'local_script_rules.txt';
const LOCAL_SCRIPT_RULES_FILE_JSON = 'local_script_rules.json';

const LOCAL_SCRIPT_RULES_COMMENT = 'By the rules of AMO and addons.opera.com we cannot use remote scripts'
    + '(and our JS injection rules could be counted as remote scripts).\r\n'
    + 'So what we do:\r\n'
    + '1. We gather all current JS rules in the DEFAULT_SCRIPT_RULES object'
    + '(see lib/utils/local-script-rules.js)\r\n'
    + '2. We disable JS rules got from remote server\r\n'
    + '3. We allow only custom rules got from the User filter (which user creates manually)'
    + 'or from this DEFAULT_SCRIPT_RULES object';

const ONE_HOUR_SEC = 60 * 60;
const ONE_DAY_SEC = 24 * ONE_HOUR_SEC;

/**
 * Default value of filter expiration time
 * if impossible to parse a value specified in platforms.json or in filter metadata.
 *
 * Defaults to 1 day (or 86400 in seconds).
 */
const DEFAULT_EXPIRES_SEC = 1 * ONE_DAY_SEC;

/**
 * Platforms configurations
 */
let platformPathsConfig = null;
let filterFile = null;
let metadataFile = null;
let revisionFile = null;
let adguardFiltersServerUrl = null;

/**
 * Sync reads file content
 *
 * @param path
 * @returns {*}
 */
const readFile = function (path) {
    try {
        return fs.readFileSync(path, { encoding: 'utf-8' });
    } catch (e) {
        return null;
    }
};

/**
 * Creates header contents
 *
 * @param metadataFile
 * @param revisionFile
 * @param platformsJsonExpires
 * @returns {[*,*,*,*,string]}
 */
const makeHeader = function (metadataFile, revisionFile, platformsJsonExpires) {
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

    const expires = typeof platformsJsonExpires !== 'undefined'
        ? platformsJsonExpires
        : metadata.expires;

    return [
        `! Title: ${metadata.name}`,
        `! Description: ${metadata.description}`,
        `! Version: ${revision.version}`,
        `! TimeUpdated: ${moment(revision.timeUpdated).format()}`,
        `! Expires: ${expires} (update frequency)`,
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
    }
    return string;
};

/**
 * Checks if filter id is unique
 *
 * @param pool
 * @param filterId
 */
const checkFilterId = function (pool, filterId) {
    if (pool.indexOf(filterId) >= 0) {
        throw new Error(`Invalid filters: Filter identifier is not unique: ${filterId}`);
    }

    pool.push(filterId);
};

/**
 * Replaces newlines
 *
 * @param message
 * @returns {XML|string|*}
 */
const normalizeData = function (message) {
    message = message.replace(/\r/g, '');
    message = message.replace(/\n+/g, '\n');
    return message;
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
    let content = header.concat(rules).join('\n');
    content = normalizeData(content);
    const checksum = crypto.createHash('md5').update(content).digest('base64');

    return `! Checksum: ${stripEnd(checksum.trim(), '=')}`;
};

/**
 * This will create a dir given a path such as './folder/subfolder'
 * @param {string} dir - The path of the directory to create. Can be absolute or relative.
 * @returns {string} The path of the last directory created or the existing directory.
 * @throws {Error} Throws an error if there is a permission issue or if the directory cannot be created.
 */
const createDir = (dir) => {
    const { sep } = path;
    const initDir = path.isAbsolute(dir) ? sep : '';
    // eslint-disable-next-line no-undef
    const baseDir = __dirname;

    return dir.split(sep).reduce((parentDir, childDir) => {
        const curDir = path.resolve(baseDir, parentDir, childDir);
        try {
            fs.mkdirSync(curDir);
        } catch (err) {
            if (err.code === 'EEXIST') { // curDir already exists!
                return curDir;
            }

            // To avoid `EISDIR` error on Mac and `EACCES`-->`ENOENT` and `EPERM` on Windows.
            if (err.code === 'ENOENT') { // Throw the original parentDir error on curDir `ENOENT` failure.
                throw new Error(`EACCES: permission denied, mkdir '${parentDir}'`);
            }

            const caughtErr = ['EACCES', 'EPERM', 'EISDIR'].indexOf(err.code) > -1;
            if ((!caughtErr || caughtErr) && (curDir === path.resolve(dir))) {
                throw err; // Throw if it's just the last created dir.
            }
        }

        return curDir;
    }, initDir);
};

/**
 * Replaces tag keywords in the provided filters with their corresponding tag IDs.
 *
 * @param {Array<Object>} rawFilters - The array of filter objects to process.
 * @param {Array<Object>} tags - The array of tag objects.
 * @returns {Array<Object>} A new array of filter objects with tag keywords replaced by their corresponding tag IDs.
 * @throws {Error} If any tag keyword in the filters does not have a corresponding tag in the `tags` array.
 */
const replaceTagKeywords = function (rawFilters, tags) {
    const tagsMap = new Map();

    tags.forEach((tag) => {
        tagsMap.set(tag.keyword, tag.tagId);
    });

    // create new variable to avoid mutation of input parameters
    const filters = [];
    const lostTags = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const filter of rawFilters) {
        const newFilter = { ...filter };
        if (newFilter.tags) {
            const ids = [];
            // eslint-disable-next-line no-restricted-syntax
            for (const t of newFilter.tags) {
                const id = tagsMap.get(t);
                if (id) {
                    ids.push(id);
                } else {
                    logger.error(`Missing tag with keyword: ${t}`);
                    lostTags.push(t);
                }
            }

            delete newFilter.tags;
            newFilter.tags = ids;
        }
        filters.push(newFilter);
    }

    if (lostTags.length > 0) {
        throw new Error(`Missing tag with keyword: ${lostTags.join(', ')}`);
    }

    return filters;
};

/**
 * Converts `rawExpires` with `day` marker into **seconds**.
 *
 * @param {any} rawExpires Raw `expires` value from filter metadata or platforms.json.
 *
 * @returns {number} Parsed expires value from days to seconds,
 * or {@link DEFAULT_EXPIRES_SEC} if it cannot be parsed.
 */
const convertExpiresDaysToSeconds = (rawExpires) => {
    const expiresDays = parseInt(rawExpires, 10);
    if (Number.isNaN(expiresDays)) {
        return DEFAULT_EXPIRES_SEC;
    }
    return expiresDays * ONE_DAY_SEC;
};

/**
 * Converts `rawExpires` with `hour` marker into **seconds**.
 *
 * @param {any} rawExpires Raw `expires` value from filter metadata or platforms.json.
 *
 * @returns {number} Parsed expires value from hours to seconds,
 * or {@link DEFAULT_EXPIRES_SEC} if it cannot be parsed.
 */
const convertExpiresHoursToSeconds = (rawExpires) => {
    const expiresHours = parseInt(rawExpires, 10);
    if (Number.isNaN(expiresHours)) {
        return DEFAULT_EXPIRES_SEC;
    }
    return expiresHours * ONE_HOUR_SEC;
};

/**
 * Overrides filter metadata `expires` property with platforms.json's `expires` property.
 *
 * Then parses the value and converts it to **seconds**.
 * If it cannot be parsed or not set at all, the default value {@link DEFAULT_EXPIRES_SEC} is used.
 *
 * @example
 * `12 hours` → 43200
 * `1 day`    → 86400
 * `2 days`   → 172800
 *
 * @param rawFilters Input filters' metadata.
 * @param platformsJsonExpires Platforms.json's `expires` property to override filters' `expires`.
 *
 * @returns {Array<object>} Updated filters' metadata with `expires` property in **seconds**.
 */
const replaceExpires = function (rawFilters, platformsJsonExpires) {
    const filters = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const filter of rawFilters) {
        // do not mutate input parameters
        const newFilter = { ...filter };
        // expires value which is set in platforms.json has higher priority
        // https://github.com/AdguardTeam/FiltersCompiler/issues/198
        if (typeof platformsJsonExpires !== 'undefined') {
            newFilter.expires = platformsJsonExpires;
        }

        if (newFilter.expires) {
            if (newFilter.expires.indexOf('day') > 0) {
                newFilter.expires = convertExpiresDaysToSeconds(newFilter.expires);
            } else if (newFilter.expires.indexOf('hour') > 0) {
                newFilter.expires = convertExpiresHoursToSeconds(newFilter.expires);
            }
        } else {
            // use default value if 'expires' is not set either in platforms.json or in filter metadata
            newFilter.expires = DEFAULT_EXPIRES_SEC;
        }
        filters.push(newFilter);
    }

    return filters;
};

/**
 * First step of processing filters metadata
 *
 * @param filtersMetadata
 */
const processFiltersFromMetadata = function (filtersMetadata) {
    // do not mutate input parameters
    const filters = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const filter of filtersMetadata) {
        const newFilter = {
            ...filter,
            deprecated: Boolean(filter.deprecated),
        };

        /**
         * In case of backward compatibility
         * Adds 'languages' metadata field parsed from 'lang:' tags
         */
        if (newFilter.tags) {
            const filterLanguages = [];
            let hasRecommended = false;
            // eslint-disable-next-line no-restricted-syntax
            for (const t of newFilter.tags) {
                if (!hasRecommended && t === 'recommended') {
                    hasRecommended = true;
                }

                if (t.startsWith('lang:')) {
                    filterLanguages.push(t.substring(5));
                }
            }

            // Languages will be added for recommended filters only
            newFilter.languages = hasRecommended ? filterLanguages : [];
        }

        filters.push(newFilter);
    }

    return filters;
};

/**
 * Does several things with filters URLs:
 * 1. Rewrites subscription urls for specified platform config
 * 2. Adds downloadUrl field to the filter
 *
 * @param metadata
 * @param config
 */
const postProcessUrls = (metadata, config) => {
    const useOptimized = OPTIMIZED_PLATFORMS_LIST.indexOf(config.platform) >= 0;

    const result = {};

    result.groups = metadata.groups.slice(0);
    result.tags = metadata.tags.slice(0);
    result.filters = [];

    const platformPath = config.path;
    // eslint-disable-next-line no-restricted-syntax
    for (const f of metadata.filters) {
        const fileName = `${f.filterId}${useOptimized ? '_optimized' : ''}.txt`;
        const downloadUrl = `${adguardFiltersServerUrl}${platformPath}/filters/${fileName}`;

        const copy = { ...f, downloadUrl };

        if (copy.subscriptionUrl && copy.subscriptionUrl.startsWith(adguardFiltersServerUrl)) {
            copy.subscriptionUrl = downloadUrl;
        }

        result.filters.push(copy);
    }

    return result;
};

/**
 * Removes redundant metadata for included or excluded filters for the current platform
 *
 * @param metadata
 * @param platform
 *
 * @returns {object} Metadata with filtered `filters` array due to the `platform`.
 */
const removeRedundantFiltersMetadata = (metadata, platform) => {
    // leaves only included filters metadata
    metadata.filters = metadata.filters.filter((filter) => !filter.platformsIncluded
        || (filter.platformsIncluded && filter.platformsIncluded.includes(platform)));
    // removes excluded filters metadata
    metadata.filters = metadata.filters.filter((filter) => !filter.platformsExcluded
        || (filter.platformsExcluded && !filter.platformsExcluded.includes(platform)));

    return metadata;
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
    const searchIndex = string.indexOf(mask) + mask.length;

    return {
        id: string.substring(searchIndex, string.indexOf('.', searchIndex)),
        message: string.substring(string.lastIndexOf('.') + 1),
    };
};

/**
 * Loads locale data from a specified directory and organizes it into groups, tags, and filters.
 *
 * @param {string} dir - The directory containing locale subdirectories with JSON files.
 * @returns {Object} An object containing the loaded locale data.
 */
const loadLocales = function (dir) {
    const result = {
        groups: {},
        tags: {},
        filters: {},
    };

    const locales = fs.readdirSync(dir);
    // eslint-disable-next-line no-restricted-syntax
    for (const directory of locales) {
        const localeDir = path.join(dir, directory);
        if (fs.lstatSync(localeDir).isDirectory()) {
            const groups = JSON.parse(readFile(path.join(localeDir, 'groups.json')));
            if (groups) {
                // eslint-disable-next-line no-restricted-syntax
                for (const group of groups) {
                    // eslint-disable-next-line guard-for-in,no-restricted-syntax
                    for (const p in group) {
                        const info = parseInfo(p, 'group.');
                        if (!info || !info.id) {
                            continue;
                        }

                        const { id } = info;
                        result.groups[id] = result.groups[id] || {};
                        result.groups[id][directory] = result.groups[id][directory] || {};
                        result.groups[id][directory][info.message] = group[p];
                    }
                }
            }

            const tags = JSON.parse(readFile(path.join(localeDir, 'tags.json')));
            if (tags) {
                // eslint-disable-next-line no-restricted-syntax
                for (const tag of tags) {
                    // eslint-disable-next-line guard-for-in,no-restricted-syntax
                    for (const p in tag) {
                        const info = parseInfo(p, 'tag.');
                        if (!info || !info.id) {
                            continue;
                        }

                        const { id } = info;
                        result.tags[id] = result.tags[id] || {};
                        result.tags[id][directory] = result.tags[id][directory] || {};
                        result.tags[id][directory][info.message] = tag[p];
                    }
                }
            }

            const filters = JSON.parse(readFile(path.join(localeDir, 'filters.json')));
            if (filters) {
                // eslint-disable-next-line no-restricted-syntax
                for (const filter of filters) {
                    // eslint-disable-next-line guard-for-in,no-restricted-syntax
                    for (const p in filter) {
                        const info = parseInfo(p, 'filter.');
                        if (!info || !info.id) {
                            continue;
                        }

                        const { id } = info;
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
 * Excludes obsolete filters data from localizations
 * @param {object} localizationsFilters
 * @param {array} obsoleteFilters
 * @return {object} result
 */
const excludeObsoleteFilters = (localizationsFilters, obsoleteFilters) => {
    const result = { ...localizationsFilters };
    obsoleteFilters.forEach((filter) => {
        delete result[filter.filterId];
    });
    return result;
};

/**
 * Removes obsolete filters metadata
 * @param {object} metadata
 * @return {object} result
 */
const removeObsoleteFilters = (metadata) => {
    const result = { ...metadata };
    result.filters = metadata.filters.filter((filter) => !filter.tags.includes(OBSOLETE_TAG_ID));
    return result;
};

/**
 * Sorts metadata's filters by `filterId` property.
 *
 * @param {object} metadata Metadata to sort filters for.
 * @returns {object} Metadata with sorted filters.
 */
export const sortMetadataFilters = (metadata) => {
    const result = { ...metadata };
    result.filters.sort((a, b) => a.filterId - b.filterId);
    return result;
};

/**
 * Checks whether the filter should be built for the specified platform.
 *
 * @param {object} metadata Filter metadata.
 * @param {string} platform Platform.
 *
 * @returns True if
 * - both `platformsIncluded` and `platformsExcluded` properties are not defined in the `metadata`,
 * - `platformsExcluded` does not contain the specified `platform`,
 * - `platformsIncluded` contains the specified `platform`.
 *
 * @throws An error if both `platformsIncluded` and `platformsExcluded` are defined.
 */
export const shouldBuildFilterForPlatform = (metadata, platform) => {
    const { filterId, platformsExcluded, platformsIncluded } = metadata;

    if (platformsExcluded && platformsIncluded) {
        let errorMessage = 'Both platformsIncluded and platformsExcluded cannot be defined simultaneously';
        if (filterId) {
            errorMessage += ` for filter ${filterId}`;
        }
        throw new Error(errorMessage);
    }

    if (platformsExcluded && platformsExcluded.includes(platform)) {
        return false;
    }

    if (!platformsIncluded) {
        return true;
    }

    return platformsIncluded.includes(platform);
};

/**
 * Removes group descriptions from the input groups.
 *
 * @param {Object} inputGroups Input groups metadata.
 * @returns {Object} Output groups metadata.
 */
const removeGroupDescriptions = (inputGroups) => {
    const result = {};
    Object.keys(inputGroups).forEach((groupId) => {
        result[groupId] = {};

        Object.keys(inputGroups[groupId]).forEach((locale) => {
            const localeData = inputGroups[groupId][locale];
            const cleanedLocaleData = { ...localeData };

            if (cleanedLocaleData.description) {
                delete cleanedLocaleData.description;
            }

            result[groupId][locale] = cleanedLocaleData;
        });
    });

    return result;
};

/**
 * Writes filters metadata and localizations for different platforms.
 *
 * @param {string} platformsPath - The base path where platform-specific directories are located.
 * @param {string} filtersDir - The directory containing filters metadata and related files.
 * @param {Array<Object>} filtersMetadata - The metadata for filters to be processed.
 * @param {Array<string>} obsoleteFilters - A list of obsolete filters to be excluded.
 *
 * @returns {void}
 * @throws {Error} If reading or parsing metadata files fails.
 */
const writeFiltersMetadata = function (platformsPath, filtersDir, filtersMetadata, obsoleteFilters) {
    logger.info('Writing filters metadata');

    const groups = JSON.parse(readFile(path.join(filtersDir, '../groups', 'metadata.json')));
    if (!groups) {
        logger.error('Error reading groups metadata');
        return;
    }

    const tags = JSON.parse(readFile(path.join(filtersDir, '../tags', 'metadata.json')));
    if (!tags) {
        logger.error('Error reading tags metadata');
        return;
    }

    // do not mutate input parameters
    const parsedLangTagsFiltersMetadata = processFiltersFromMetadata(filtersMetadata);
    const replacedTagKeywordsFiltersMetadata = replaceTagKeywords(parsedLangTagsFiltersMetadata, tags);

    const localizations = loadLocales(path.join(filtersDir, '../locales'));

    // eslint-disable-next-line guard-for-in,no-restricted-syntax
    for (const platform in platformPathsConfig) {
        const config = platformPathsConfig[platform];
        const platformDir = path.join(platformsPath, config.path);
        createDir(platformDir);

        logger.info(`Writing filters metadata: ${config.path}`);
        const filtersFileJson = path.join(platformDir, FILTERS_METADATA_FILE_JSON);
        const filtersFileJs = path.join(platformDir, FILTERS_METADATA_FILE_JS);

        const replacedExpiresFiltersMetadata = replaceExpires(replacedTagKeywordsFiltersMetadata, config.expires);

        let metadata = {
            groups,
            tags,
            filters: replacedExpiresFiltersMetadata,
        };

        metadata = postProcessUrls(metadata, config);
        metadata = removeRedundantFiltersMetadata(metadata, config.platform);

        if (platform === 'MAC') {
            metadata = rewriteMetadataForOldMacV1(metadata);
        } else if (platform === 'MAC_V2') {
            metadata = rewriteMetadataForOldMacV2(metadata);
            metadata = removeObsoleteFilters(metadata);
        } else {
            metadata = removeObsoleteFilters(metadata);
        }

        const filtersContent = JSON.stringify(sortMetadataFilters(metadata), null, '\t');

        fs.writeFileSync(filtersFileJson, filtersContent, 'utf8');
        fs.writeFileSync(filtersFileJs, filtersContent, 'utf8');

        logger.info(`Writing filters localizations: ${config.path}`);
        const filtersI18nFileJson = path.join(platformDir, FILTERS_I18N_METADATA_FILE_JSON);
        const filtersI18nFileJs = path.join(platformDir, FILTERS_I18N_METADATA_FILE_JS);

        let localizedFilters = { ...localizations.filters };

        filtersMetadata.forEach((metadata) => {
            if (!shouldBuildFilterForPlatform(metadata, config.platform)) {
                const { filterId } = metadata;
                // eslint-disable-next-line max-len
                logger.info(`Adding localization for filter ${filterId} skipped for platform '${config.platform}' due to platformsExcluded or platformsIncluded`);
                delete localizedFilters[filterId];
            }
        });

        // old MAC platform may not support absence some filters i18n metadata,
        // for all other platforms we can exclude obsolete filters
        if (platform !== 'MAC') {
            localizedFilters = excludeObsoleteFilters(localizedFilters, obsoleteFilters);
        }

        const i18nMetadata = {
            groups: localizations.groups,
            tags: localizations.tags,
            filters: localizedFilters,
        };

        let i18nGroups = localizations.groups;

        // no new fields should be added for old 'MAC' platform
        if (platform === 'MAC') {
            delete i18nMetadata.tags;
            i18nGroups = removeGroupDescriptions(localizations.groups);
        }

        i18nMetadata.groups = i18nGroups;

        const i18nContent = JSON.stringify(i18nMetadata, null, '\t');

        fs.writeFileSync(filtersI18nFileJson, i18nContent, 'utf8');
        fs.writeFileSync(filtersI18nFileJs, i18nContent, 'utf8');
    }

    logger.info('Writing filters metadata done');
};

/**
 * Separates script rules from AG filters into specified file.
 *
 * @param platformsPath - Path to platforms folder
 */
export const writeLocalScriptRules = function (platformsPath) {
    logger.info('Writing local script rules');

    // eslint-disable-next-line guard-for-in,no-restricted-syntax
    for (const platform in platformPathsConfig) {
        const config = platformPathsConfig[platform];
        const platformDir = path.join(platformsPath, config.path);

        const rulesTxt = [];
        const rulesJson = {
            comment: LOCAL_SCRIPT_RULES_COMMENT,
            rules: [],
        };

        // TODO: find a better way to iterate over ag filters
        // because AdGuard Chinese filter has id 224
        // https://github.com/AdguardTeam/FiltersRegistry/blob/master/filters/filter_224_Chinese/metadata.json
        for (let i = 1; i <= LAST_ADGUARD_FILTER_ID; i += 1) {
            const filterRules = readFile(path.join(platformDir, PLATFORM_FILTERS_DIR, `${i}.txt`));
            if (!filterRules) {
                continue;
            }

            const lines = filterRules.split('\n');
            // eslint-disable-next-line no-restricted-syntax
            for (let rule of lines) {
                rule = rule.trim();

                if (!rule
                    || rule.startsWith(RuleMasks.MASK_COMMENT)) {
                    continue;
                }

                if (rule.includes(RuleMasks.MASK_SCRIPT)) {
                    rulesTxt.push(rule);

                    const m = rule.split(RuleMasks.MASK_SCRIPT);
                    rulesJson.rules.push({
                        domains: m[0],
                        script: m[1],
                    });
                }
            }
        }

        // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1847
        // remove scriptlet rules in local_script_rules.json
        rulesJson.rules = removeScriptletRules(rulesJson.rules);

        fs.writeFileSync(
            path.join(platformDir, LOCAL_SCRIPT_RULES_FILE),
            rulesTxt.join(RULES_SEPARATOR),
            'utf8',
        );
        fs.writeFileSync(
            path.join(platformDir, LOCAL_SCRIPT_RULES_FILE_JSON),
            JSON.stringify(rulesJson, null, 4),
            'utf8',
        );
    }

    logger.info('Writing local script rules done');
};

/**
 * Loads and processes filter metadata from the specified directory.
 *
 * @param {string} filterDir - The directory containing the filter metadata and revision files.
 * @param {number[]} [whitelist] - An optional array of whitelist filter IDs.
 * @param {number[]} [blacklist] - An optional array of blacklist filter IDs.
 * @returns {Object} The processed filter metadata.
 * @throws {Error} If the metadata or revision file cannot be read.
 */
const loadFilterMetadata = function (filterDir, whitelist, blacklist) {
    const metadataFilePath = path.join(filterDir, metadataFile);
    const metadataString = readFile(metadataFilePath);
    if (!metadataString) {
        throw new Error(`Error reading filter metadata:${filterDir}`);
    }

    const revisionFilePath = path.join(filterDir, revisionFile);
    const revisionString = readFile(revisionFilePath);
    if (!revisionString) {
        throw new Error(`Error reading filter revision:${filterDir}`);
    }

    const revision = JSON.parse(revisionString);

    const result = JSON.parse(metadataString);
    result.version = revision.version;
    result.timeUpdated = moment(revision.timeUpdated).format('YYYY-MM-DDTHH:mm:ssZZ');
    result.timeAdded = moment(result.timeAdded).format('YYYY-MM-DDTHH:mm:ssZZ');
    delete result.disabled;

    const { filterId } = result;
    if (
        (whitelist && whitelist.includes(filterId))
        || (blacklist && !blacklist.includes(filterId))
    ) {
        checkFilterId(metadataFilterIdsPool, filterId);
    }

    return result;
};

/**
 * Exclude `#%#` and `#@%#` rules from rules list.
 *
 * @param {Array<any>} rules Input list of rules.
 * @return {Array<any>} Filtered list of rules.
 */
const excludeScriptRules = (rules) => {
    return rules.filter((rule) => {
        return rule
            && !rule.includes(RuleMasks.MASK_SCRIPT)
            && !rule.includes(RuleMasks.MASK_SCRIPT_EXCEPTION);
    });
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
 * Writes filter platform build
 */
const writeFilterRules = function (filterId, dir, config, rulesHeader, rules, optimized) {
    createDir(dir);

    const filterFile = path.join(dir, `${filterId}${optimized ? '_optimized' : ''}.txt`);
    let rulesList = rules;

    // Convert Adguard scriptlets and redirect rules to UBlock syntax.
    // Exclude script rules
    // and script rules exceptions https://github.com/AdguardTeam/FiltersCompiler/issues/199
    // Modify title for base filter
    if (config.platform === 'ext_ublock') {
        rulesList = convertToUbo(rulesList);
        rulesList = excludeScriptRules(rulesList);
        if (filterId === 2) {
            modifyBaseFilterHeader(rulesHeader, optimized);
        }
    }

    writeFilterFile(filterFile, config.configuration.adbHeader, rulesHeader, rulesList);

    // For English filter only we should provide additional filter version.
    if (filterId === 2 && config.platform === 'ext_ublock' && !optimized) {
        const correctedHeader = rewriteHeader(rulesHeader);
        const correctedRules = rewriteRules(rulesList);

        const correctedFile = path.join(dir, `${filterId}_without_easylist.txt`);
        writeFilterFile(correctedFile, config.configuration.adbHeader, correctedHeader, correctedRules);
    }
};

/**
 * Removes rules array duplicates,
 * ignores comments and hinted rules
 *
 * @param list a list of rules to filter
 * @returns {*} a list of rules without duplicate
 */
const removeRuleDuplicates = function (list) {
    logger.info('Removing duplicates..');

    return list.filter((item, pos) => {
        // Do not remove hinted duplicates
        if (pos > 0) {
            const previous = list[pos - 1];
            if (previous && previous.startsWith(RuleMasks.MASK_HINT)) {
                return true;
            }
        }

        // Do not remove hinted duplicates
        const duplicatePosition = list.indexOf(item, pos > 0 ? pos - 1 : pos);
        if (duplicatePosition !== pos && duplicatePosition > 0) {
            const duplicate = list[duplicatePosition - 1];
            if (duplicate && duplicate.startsWith(RuleMasks.MASK_HINT)) {
                return true;
            }
        }

        // Do not remove commented duplicates
        const result = item.startsWith(RuleMasks.MASK_COMMENT) || duplicatePosition === pos;

        if (!result) {
            logger.info(`${item} removed as duplicate`);
        }

        return result;
    });
};

/**
 * Builds platforms for filter
 *
 * @param filterDir - Path to filter directory
 * @param platformsPath - Path to platforms folder
 * @param whitelist - Array of filter ids to whitelist
 * @param blacklist - Array of filter ids to blacklist
 */
const buildFilter = async (filterDir, platformsPath, whitelist, blacklist) => {
    const originalRules = readFile(path.join(filterDir, filterFile)).split('\r\n');

    const metadataFilePath = path.join(filterDir, metadataFile);
    const revisionFilePath = path.join(filterDir, revisionFile);

    const metadata = JSON.parse(readFile(metadataFilePath));
    const { filterId } = metadata;
    checkFilterId(filterIdsPool, filterId);

    if (whitelist && whitelist.length > 0 && whitelist.indexOf(filterId) < 0) {
        logger.info(`Filter ${filterId} skipped with whitelist`);
        return;
    }

    if (blacklist && blacklist.length > 0 && blacklist.indexOf(filterId) >= 0) {
        logger.info(`Filter ${filterId} skipped with blacklist`);
        return;
    }

    const optimizationConfig = getFilterOptimizationConfig(filterId);

    // eslint-disable-next-line guard-for-in,no-restricted-syntax
    for (const platform in platformPathsConfig) {
        const config = platformPathsConfig[platform];

        if (!shouldBuildFilterForPlatform(metadata, config.platform)) {
            // eslint-disable-next-line max-len
            logger.info(`Build of filter ${filterId} skipped for platform '${config.platform}' due to platformsExcluded or platformsIncluded`);
            continue;
        }

        let rules = FiltersDownloader.resolveConditions(originalRules, config.defines);

        // handle includes after resolving conditions:
        // if there is a bad include after resolving conditions, the generator should be terminated
        // https://github.com/AdguardTeam/FiltersCompiler/issues/84
        // eslint-disable-next-line no-await-in-loop
        rules = await FiltersDownloader.resolveIncludes(rules, filterDir, config.defines);

        rules = cleanupRules(rules, config, filterId);
        rules = removeRuleDuplicates(rules);

        // Apply replacement rules
        if (config.configuration?.replacements) {
            rules = rules.map((rule) => {
                // eslint-disable-next-line no-restricted-syntax
                for (const repl of config.configuration.replacements) {
                    rule = rule.replace(new RegExp(repl.from, 'g'), repl.to);
                }
                return rule;
            });
        }

        const optimizedRules = cleanupAndOptimizeRules(rules, config, optimizationConfig, filterId);
        // eslint-disable-next-line max-len
        logger.info(`Filter ${filterId}. Rules ${originalRules.length} => ${rules.length} => ${optimizedRules.length}. PlatformPath: '${config.path}'`);

        const header = makeHeader(metadataFilePath, revisionFilePath, config.expires);

        const platformDir = path.join(platformsPath, config.path, PLATFORM_FILTERS_DIR);
        writeFilterRules(filterId, platformDir, config, header, rules, false);

        // add '(Optimized)' to the '! Title:' for optimized filters
        // https://github.com/AdguardTeam/FiltersCompiler/issues/78
        const optimizedHeader = [...header];
        optimizedHeader[0] += ' (Optimized)';

        writeFilterRules(filterId, platformDir, config, optimizedHeader, optimizedRules, true);
    }
};

/**
 * Initializes service
 *
 * @param filterFileName output filter file name.
 * @param metadataFileName output metadata file name.
 * @param revisionFileName output revision file name.
 * @param platformsConfig platforms configuration object.
 * @param adguardFiltersServer server that will serve the filters that're being built.
 */
export const init = function (
    filterFileName,
    metadataFileName,
    revisionFileName,
    platformsConfig,
    adguardFiltersServer,
) {
    filterFile = filterFileName;
    metadataFile = metadataFileName;
    revisionFile = revisionFileName;

    adguardFiltersServerUrl = adguardFiltersServer;

    if (!platformsConfig) {
        throw new Error('Platforms config is not defined');
    }

    platformPathsConfig = platformsConfig;
};

/**
 * Checks if filter has 'obsolete' tag
 * @param {object} metadata
 * @returns {boolean}
 */
const isObsoleteFilter = (metadata) => metadata.tags && metadata.tags.some((tag) => tag === 'obsolete');

/**
 * Parses directory recursive
 *
 * @param filtersDir
 * @param filtersMetadata
 * @param platformsPath
 * @param whitelist
 * @param blacklist
 * @param obsoleteFiltersMetadata
 */
export const parseDirectory = async (
    filtersDir,
    filtersMetadata,
    platformsPath,
    whitelist,
    blacklist,
    obsoleteFiltersMetadata,
) => {
    const items = fs.readdirSync(filtersDir);
    // eslint-disable-next-line no-restricted-syntax
    for (const directory of items) {
        const filterDir = path.join(filtersDir, directory);
        if (fs.lstatSync(filterDir).isDirectory()) {
            const metadataFilePath = path.join(filterDir, metadataFile);
            if (fs.existsSync(metadataFilePath)) {
                logger.info(`Building filter platforms: ${directory}`);
                // eslint-disable-next-line no-await-in-loop
                await buildFilter(filterDir, platformsPath, whitelist, blacklist);
                logger.info(`Building filter platforms: ${directory} done`);
                const filterMetadata = loadFilterMetadata(filterDir, whitelist, blacklist);
                filtersMetadata.push(filterMetadata);
                if (isObsoleteFilter(filterMetadata)) {
                    obsoleteFiltersMetadata.push(filterMetadata);
                }
            } else {
                // eslint-disable-next-line no-await-in-loop
                await parseDirectory(
                    filterDir,
                    filtersMetadata,
                    platformsPath,
                    whitelist,
                    blacklist,
                    obsoleteFiltersMetadata,
                );
            }
        }
    }
};

/**
 * Generates platform-specific files and metadata based on the provided filters and configurations.
 *
 * @async
 * @param {string} filtersDir - The directory containing filter files to be processed.
 * @param {string} platformsPath - The output path where the generated platform files will be stored.
 * @param {Array<number>} whitelist - A list of whitelist filter IDs.
 * @param {Array<number>} blacklist - A list of blacklist filter IDs.
 * @returns {Promise<void>} Resolves when the generation process is complete.
 *
 * @throws {Error} If `platformsPath` or `platformPathsConfig` is not specified.
 */
export const generate = async (filtersDir, platformsPath, whitelist, blacklist) => {
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
    const obsoleteFiltersMetadata = [];

    await parseDirectory(filtersDir, filtersMetadata, platformsPath, whitelist, blacklist, obsoleteFiltersMetadata);

    writeFiltersMetadata(platformsPath, filtersDir, filtersMetadata, obsoleteFiltersMetadata);
    writeLocalScriptRules(platformsPath);

    // reset af the end
    // TODO: find out better way to reset
    filterIdsPool = [];
};
