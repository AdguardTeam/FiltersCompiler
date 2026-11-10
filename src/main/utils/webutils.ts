import { createRequire } from 'module';

import { logger } from './log';
import { stripUrlCredentials, stripUrlCredentialsFromText } from './url';

const require = createRequire(import.meta.url);

/**
 * Some sources require proper user-agents and forbid downloading without.
 */
const USER_AGENT = 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko)'
    + 'Chrome/63.0.3239.132 Mobile Safari/537.36';

/**
 * Downloads file from url
 *
 * @param url
 * @param retryNum number of times to retry downloading, defaults to 0
 * @returns raw content of the file
 */
const tryDownloadFile = async function (url: string, retryNum = 0) {
    let args = ['--fail', '--silent', '--user-agent', USER_AGENT, '-L', url];
    if (retryNum) {
        args.push('--retry');
        args.push(String(retryNum));
    }
    const options = { encoding: 'utf8' as const, maxBuffer: Infinity };
    const tlsCheck = process.env.TLS;
    if (tlsCheck === 'insecure') {
        args = ['--insecure'].concat(args);
    }
    return require('child_process')
        .execFileSync('curl', args, options) as string;
};

/**
 * Removes URL credentials from an error message and stack.
 *
 * A failed `execFileSync` call includes the full `curl` command line in the
 * error text, so the error can contain the URL with credentials.
 *
 * @param error Error or value to sanitize.
 *
 * @returns Sanitized error or value.
 */
const sanitizeError = (error: unknown): unknown => {
    if (error instanceof Error) {
        error.message = stripUrlCredentialsFromText(error.message);
        if (error.stack) {
            error.stack = stripUrlCredentialsFromText(error.stack);
        }
        return error;
    }

    if (typeof error === 'string') {
        return stripUrlCredentialsFromText(error);
    }

    return error;
};

/**
 * Number of times to retry downloading after the first failed attempt for `downloadFile` function.
 */
export const RETRY_NUM = 5;

/**
 * Downloads file from url with two attempts
 *
 * @param url
 * @returns raw content of the file
 */
export const downloadFile = async (url: string) => {
    logger.info(`Downloading: ${stripUrlCredentials(url)}`);

    // 5 times to retry after first fail attempt:
    // 1 sec for first time, double for every forthcoming attempts
    // so it will take: 1 + 2 + 4 + 8 + 16 = 31 seconds
    // https://curl.se/docs/manpage.html#--retry

    try {
        return await tryDownloadFile(url);
    } catch (e) {
        logger.warn(sanitizeError(e));
        logger.warn(`Retry downloading: ${stripUrlCredentials(url)}`);
        try {
            return await tryDownloadFile(url, RETRY_NUM);
        } catch (retryError) {
            throw sanitizeError(retryError);
        }
    }
};
