import { createRequire } from 'module';

import { stripUrlCredentials } from '@adguard/filters-downloader';

import { logger } from './log';

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
 * Matches a scheme-less URL with a username and a password, for example
 * `user:pass@example.org/filter.txt`.
 *
 * A colon before the at sign is the userinfo separator. A local path, for
 * example `C:\filters\file@name.txt`, has no such separator, because a
 * separator follows the drive prefix.
 */
const SCHEME_LESS_CREDENTIALS_REGEXP = /^[^/\\\s@]+:[^/\\\s@]*@/;

/**
 * Removes the userinfo component from a URL, including a URL without a scheme.
 *
 * The dependency helper finds the userinfo only in a URL that has a scheme or
 * starts with `//`. An external `@include` accepts a scheme-less URL, for
 * example `user:pass@example.org/filter.txt`, because the `@include` directive
 * treats any value with a colon as an external URL. The helper parses that
 * form with a placeholder scheme, then removes the placeholder.
 *
 * @param url URL that may contain a username and a password.
 *
 * @returns URL without the userinfo component.
 */
export const sanitizeUrl = (url: string): string => {
    const sanitizedUrl = stripUrlCredentials(url);

    if (sanitizedUrl !== url || !SCHEME_LESS_CREDENTIALS_REGEXP.test(url)) {
        return sanitizedUrl;
    }

    const placeholder = 'http://';

    return stripUrlCredentials(`${placeholder}${url}`).slice(placeholder.length);
};

/**
 * Removes URL credentials from an error message and stack.
 *
 * A failed `execFileSync` call includes the full `curl` command line in the
 * error text, so the error can contain the URL with credentials. `execFileSync`
 * throws only `Error` instances, so any other value is returned unchanged.
 *
 * @param error Error to sanitize.
 *
 * @returns Sanitized error or the original value when it is not an `Error`.
 */
const sanitizeError = (error: unknown): unknown => {
    if (!(error instanceof Error)) {
        return error;
    }

    error.message = stripUrlCredentials(error.message);
    if (error.stack) {
        error.stack = stripUrlCredentials(error.stack);
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
    logger.info(`Downloading: ${sanitizeUrl(url)}`);

    // 5 times to retry after first fail attempt:
    // 1 sec for first time, double for every forthcoming attempts
    // so it will take: 1 + 2 + 4 + 8 + 16 = 31 seconds
    // https://curl.se/docs/manpage.html#--retry

    try {
        return await tryDownloadFile(url);
    } catch (e) {
        logger.warn(sanitizeError(e));
        logger.warn(`Retry downloading: ${sanitizeUrl(url)}`);
        try {
            return await tryDownloadFile(url, RETRY_NUM);
        } catch (retryError) {
            throw sanitizeError(retryError);
        }
    }
};
