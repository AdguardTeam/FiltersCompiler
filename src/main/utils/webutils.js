/* globals require */

module.exports = (() => {

    'use strict';

    const logger = require("./log.js");

    const USER_AGENT = "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.132 Mobile Safari/537.36";

    /**
     * Sync downloads file from url
     *
     * @param url
     * @returns {*}
     */
    const downloadFile = function (url) {
        logger.log(`Downloading: ${url}`);

        return require('child_process')
            .execFileSync('curl', ['--fail', '--silent', '--user-agent', USER_AGENT, '-L', url], {encoding: 'utf8'});
    };

    return {
        downloadFile: downloadFile
    };
})();