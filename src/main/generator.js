/* globals require, Buffer */

module.exports = (() => {

    'use strict';

    const fs = require('fs');
    const path = require('path');
    const md5 = require('md5');

    const logger = require("./utils/log.js");
    const RuleMasks = require('./rule/rule-masks.js');

    const RULES_SEPARATOR = "\r\n";

    const CONTENT_BLOCKER_PATTERNS_EXCEPTIONS
        = [RuleMasks.MASK_SCRIPT, RuleMasks.MASK_SCRIPT_EXCEPTION, RuleMasks.MASK_CSS, RuleMasks.MASK_CSS_EXCEPTION,
        "$mp4", "$replace=", "$stealth", "$empty", "important,replace=", "$app", "$protobuf", "important,protobuf", "[-ext-", "$$"];

    const EXTENSIONS_RULES_PATTERNS_EXCEPTIONS
        = ["$mp4", "$replace=", "$stealth", "important,replace=", "$app", "$network", "$protobuf", "important,protobuf", "$$"];

    const SAFARI_EXTENSIONS_RULES_PATTERNS_EXCEPTIONS
        = EXTENSIONS_RULES_PATTERNS_EXCEPTIONS.concat(["$csp"]);

    const ANDROID_CONTENT_BLOCKER_PATTERNS_EXCEPTIONS
        = CONTENT_BLOCKER_PATTERNS_EXCEPTIONS.concat(["$csp"]);

    const UBLOCK_RULES_PATTERNS_EXCEPTIONS
        = EXTENSIONS_RULES_PATTERNS_EXCEPTIONS.concat([RuleMasks.MASK_SCRIPT, RuleMasks.MASK_SCRIPT_EXCEPTION]);

    /**
     * Platforms configurations
     * TODO: Move to json
     */
    const PlatformPaths = {
        WINDOWS: {
            platform: "windows",
            path: "windows",
            configuration: {
                omitAdgHackRules: false,
                omitCommentRules: false,
                omitContentRules: false,
                omitRulePatterns: false,
                ignoreRuleHints: false
            }
        },
        MAC: {
            platform: "mac",
            path: "mac",
            configuration: {
                omitAdgHackRules: false,
                omitCommentRules: false,
                omitContentRules: false,
                omitRulePatterns: false,
                ignoreRuleHints: false
            }
        },
        MAC_V2: {
            platform: "mac",
            path: "mac_v2",
            configuration: {
                omitAdgHackRules: false,
                omitCommentRules: false,
                omitContentRules: false,
                omitRulePatterns: false,
                ignoreRuleHints: false
            }
        },

        // Exclude hack rules and $stealth modifier
        ANDROID: {
            platform: "android",
            path: "android",
            configuration: {
                omitAdgHackRules: true,
                omitCommentRules: false,
                omitContentRules: false,
                omitRulePatterns: ["$stealth"],
                ignoreRuleHints: false
            }
        },

        // Exclude hack, content, script and css-inject rules, exclude rules with advanced modifiers
        IOS: {
            platform: "ios",
            path: "ios",
            configuration: {
                omitAdgHackRules: true,
                omitCommentRules: false,
                omitContentRules: true,
                omitRulePatterns: CONTENT_BLOCKER_PATTERNS_EXCEPTIONS,
                ignoreRuleHints: false
            }
        },

        // Exclude hack and content rules, exclude rules with advanced modifiers.
        // Rules with "$empty" modifier are processed as a common url-blocking rule
        EXTENSION_CHROMIUM: {
            platform: "ext_chromium",
            path: "extension/chromium",
            configuration: {
                omitAdgHackRules: true,
                omitCommentRules: false,
                omitContentRules: true,
                omitRulePatterns: EXTENSIONS_RULES_PATTERNS_EXCEPTIONS,
                ignoreRuleHints: false
            }
        },
        EXTENSION_FIREFOX: {
            platform: "ext_ff",
            path: "extension/firefox",
            configuration: {
                omitAdgHackRules: true,
                omitCommentRules: false,
                omitContentRules: true,
                omitRulePatterns: EXTENSIONS_RULES_PATTERNS_EXCEPTIONS,
                ignoreRuleHints: false
            }
        },
        EXTENSION_SAFARI: {
            platform: "ext_safari",
            path: "extension/safari",
            configuration: {
                omitAdgHackRules: true,
                omitCommentRules: false,
                omitContentRules: true,
                omitRulePatterns: SAFARI_EXTENSIONS_RULES_PATTERNS_EXCEPTIONS,
                ignoreRuleHints: false
            }
        },
        EXTENSION_EDGE: {
            platform: "ext_edge",
            path: "extension/edge",
            configuration: {
                omitAdgHackRules: true,
                omitCommentRules: false,
                omitContentRules: true,
                omitRulePatterns: EXTENSIONS_RULES_PATTERNS_EXCEPTIONS,
                ignoreRuleHints: false
            }
        },
        EXTENSION_OPERA: {
            platform: "ext_opera",
            path: "extension/opera",
            configuration: {
                omitAdgHackRules: true,
                omitCommentRules: false,
                omitContentRules: true,
                omitRulePatterns: EXTENSIONS_RULES_PATTERNS_EXCEPTIONS,
                ignoreRuleHints: false
            }
        },

        // https://github.com/AdguardTeam/ContentBlocker/issues/46
        // Exclude hack, content, script and css rules, exclude rules with advanced modifiers
        EXTENSION_ANDROID_CONTENT_BLOCKER: {
            platform: "ext_android_cb",
            path: "extension/android-content-blocker",
            configuration: {
                omitAdgHackRules: true,
                omitCommentRules: false,
                omitContentRules: true,
                omitRulePatterns: ANDROID_CONTENT_BLOCKER_PATTERNS_EXCEPTIONS,
                ignoreRuleHints: false
            }
        },

        // Additional configuration for uBlock
        // https://github.com/AdguardTeam/AdguardFilters/issues/5138
        EXTENSION_UBLOCK: {
            platform: "ext_ublock",
            path: "extension/ublock",
            configuration: {
                omitAdgHackRules: true,
                omitCommentRules: false,
                omitContentRules: true,
                omitRulePatterns: UBLOCK_RULES_PATTERNS_EXCEPTIONS,
                ignoreRuleHints: false
            }
        }
    };

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
     * Filters set of rules with configuration
     *
     * @param originalRules
     * @param config
     */
    const cleanupRules = function (originalRules, config) {
        //TODO: Implement

        return originalRules;
    };

    const createDir = (dir) => {
        // This will create a dir given a path such as './folder/subfolder'
        const splitPath = dir.split('/');
        splitPath.reduce((path, subPath) => {
            let currentPath;
            if (subPath !== '.') {
                currentPath = path + '/' + subPath;
                if (!fs.existsSync(currentPath)) {
                    fs.mkdirSync(currentPath);
                }
            }
            else {
                currentPath = subPath;
            }
            return currentPath;
        }, '');
    };

    /**
     * Writes filter platform build
     */
    const writeFilterRules = function (filterId, dir, platform, rulesHeader, rules, optimized) {
        const filterFile = path.join(dir, `${filterId}${optimized ? '_optimized' : ''}.txt`);

        const data = rulesHeader.concat(rules).join(RULES_SEPARATOR);

        createDir(dir);

        // TODO: Ublock exception
        // For the English filter only we should provide additional filter version.
        // if (filterId === 2 && platform === 'ext_ublock' && !optimized) {
        //     const secondFile = path.join(dir, `${filterId}_without_easylist.txt`)
        //     //FileUtils.writeStringToFile(file, joinRulesWithHeader(WorkaroundUtils.rewriteHeader(header), WorkaroundUtils.rewriteRules(rules), RULES_SEPARATOR), "utf-8");
        // }

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

        const originalRules = readFile(path.join(filterDir, filterFile));

        const metadataFilePath = path.join(filterDir, metadataFile);
        const revisionFilePath = path.join(filterDir, revisionFile);
        const header = makeHeader(metadataFilePath, revisionFilePath);

        for (let platform in PlatformPaths) {

            const config = PlatformPaths[platform];
            const rules = cleanupRules(originalRules, config);
            const platformHeader = [calculateChecksum(header, rules)].concat(header);

            logger.log(`Filter ${filterId}. Rules ${originalRules.length} => ${rules.length} => {?}. PlatformPath: '${config.path}'`);

            const platformDir = path.join(platformsPath, config.path);
            writeFilterRules(filterId, platformDir, config.platform, platformHeader, rules, false);
        }
    };

    /**
     * Initializes service
     *
     * @param filterFileName
     * @param metadataFileName
     * @param revisionFileName
     */
    const init = function (filterFileName, metadataFileName, revisionFileName) {
        filterFile = filterFileName;
        metadataFile = metadataFileName;
        revisionFile = revisionFileName;
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

        createDir(platformsPath);

        //TODO: Write metadata?

        const items = fs.readdirSync(filtersDir);

        for (let directory of items) {
            const filterDir = path.join(filtersDir, directory);
            if (fs.lstatSync(filterDir).isDirectory()) {

                logger.log(`Building filter platforms: ${directory}`);
                buildFilter(filterDir, platformsPath);
                logger.log(`Building filter platforms: ${directory} done`);
            }
        }
    };

    return {
        init: init,
        generate: generate
    };
})();