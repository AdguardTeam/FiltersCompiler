/* globals require, Buffer */

module.exports = (() => {

    'use strict';

    const fs = require('fs');
    const path = require('path');
    const md5 = require('md5');

    const logger = require("../utils/log.js");
    const filter = require("./filter.js");

    const RULES_SEPARATOR = "\r\n";

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

        for (let platform in platformPathsConfig) {

            const config = platformPathsConfig[platform];
            const rules = filter.cleanupRules(originalRules.split('\r\n'), config);
            const platformHeader = [calculateChecksum(header, rules)].concat(header);

            //TODO: Add optimization configs

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
    const init = function (filterFileName, metadataFileName, revisionFileName, platformsConfigFile) {
        filterFile = filterFileName;
        metadataFile = metadataFileName;
        revisionFile = revisionFileName;

        const config = readFile(platformsConfigFile);
        if (!config) {
            let message = 'Platforms config file is invalid';
            logger.error(message);
            return;
        }

        platformPathsConfig = JSON.parse(config);
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