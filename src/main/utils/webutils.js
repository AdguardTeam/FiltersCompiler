/* eslint-disable global-require */
module.exports = (() => {
    const logger = require('./log.js');

    /**
     * Some sources require proper user-agents and forbid downloading without.
     */
    const USER_AGENT = 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko)'
        + 'Chrome/63.0.3239.132 Mobile Safari/537.36';

    /**
     * Sync downloads file from url
     *
     * @param url
     * @returns {*}
     */
    const tryDownloadFile = function (url) {
        let args = ['--fail', '--silent', '--user-agent', USER_AGENT, '-L', url];
        const options = { encoding: 'utf8', maxBuffer: Infinity };
        const tlsCheck = process.env.TLS;
        if (tlsCheck === 'insecure') {
            args = ['--insecure'].concat(args);
        }
        return require('child_process')
            .execFileSync('curl', args, options);
    };

    /**
     * Sync downloads file from url with two attempts
     *
     * @param url
     * @returns {*}
     */
    const downloadFile = function (url) {
        logger.log(`Downloading: ${url}`);

        try {
            return tryDownloadFile(url);
        } catch (e) {
            logger.warn(e);
            logger.warn(`Retry downloading: ${url}`);
            return tryDownloadFile(url);
        }
    };

    return {
        downloadFile,
    };
})();
