/* globals require */

module.exports = (() => {

    'use strict';

    const logger = require("./log.js");

    /**
     * Sync downloads file from url
     *
     * @param url
     * @returns {*}
     */
    const downloadFile = function (url) {
        logger.log(`Downloading: ${url}`);

        return require('child_process')
            .execFileSync('curl', ['--fail', '--silent', '-L', url], {encoding: 'utf8'});
    };

    return {
        downloadFile: downloadFile
    };
})();