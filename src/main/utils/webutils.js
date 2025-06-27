/* eslint-disable global-require */
import { createRequire } from 'module';
import { logger } from './log';

const require = createRequire(import.meta.url);

/**
 * Some sources require proper user-agents and forbid downloading without.
 */
const USER_AGENT = 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko)'
    + 'Chrome/63.0.3239.132 Mobile Safari/537.36';

/**
 * Sync downloads file from url
 *
 * @param url
 * @param {number} [retryNum=0] number of times to retry downloading, defaults to 0
 * @returns {*}
 */
const tryDownloadFile = function (url, retryNum = 0) {
    let args = ['--fail', '--silent', '--user-agent', USER_AGENT, '-L', url];
    if (retryNum) {
        args.push('--retry');
        args.push(retryNum);
    }
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
export const downloadFile = (url) => {
    logger.info(`Downloading: ${url}`);

    // 5 times to retry after first fail attempt:
    // 1 sec for first time, double for every forthcoming attempts
    // so it will take: 1 + 2 + 4 + 8 + 16 = 31 seconds
    // https://curl.se/docs/manpage.html#--retry
    const RETRY_NUM = 5;

    try {
        return tryDownloadFile(url);
    } catch (e) {
        logger.warn(e);
        logger.warn(`Retry downloading: ${url}`);
        return tryDownloadFile(url, RETRY_NUM);
    }
};
