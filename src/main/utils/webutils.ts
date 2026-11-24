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
 * Matches a URL that starts with a scheme and a slash or a backslash, for
 * example `https://`, `https:/`, or `https:\`.
 *
 * The scheme-less fallback in {@link sanitizeUrl} handles a value such as
 * `user:pass@example.org`, which has a colon but no slash after it. A real URL
 * can contain a `name:value@` segment in a path or a query, so the fallback
 * must not run on it: the sanitized value is logged and put into the error,
 * and it must name the URL that was requested.
 */
const SCHEME_WITH_SLASHES_REGEXP = /^[a-z][a-z0-9+.-]+:[\\/]/i;

/**
 * Placeholder scheme for the dependency helper.
 *
 * The helper finds the userinfo only in a URL that has a scheme or starts with
 * `//`. An external `@include` accepts a scheme-less URL, for example
 * `user:pass@example.org/filter.txt`, because the `@include` directive treats
 * any value with a colon as an external URL. The helper parses that form with
 * this placeholder scheme, then the placeholder is removed from the result.
 */
const PLACEHOLDER_SCHEME = 'http://';

/**
 * Checks that a value can start with a userinfo component.
 *
 * A userinfo component has a colon between the username and the password. A
 * scheme-less value can be a local path whose file name contains an at sign,
 * for example `filters/user@example.txt`. The dependency helper removes that
 * at sign as a username when a scheme is present, so the fallback must not try
 * such a value.
 *
 * @param value Value that the dependency helper parses with a placeholder
 * scheme.
 *
 * @returns `true` if a colon precedes an at sign.
 */
const startsWithUserinfo = (value: string): boolean => {
    const colonIndex = value.indexOf(':');
    const atSignIndex = value.indexOf('@');

    return colonIndex !== -1 && atSignIndex !== -1 && colonIndex < atSignIndex;
};

/**
 * Returns the offsets at which a userinfo component can start in a value
 * without a scheme.
 *
 * The value can start with the userinfo, as in
 * `user:pass@example.org/filter.txt`, or a path can precede it, as in
 * `sub/user:pass@example.org/filter.txt`. A password cannot contain a slash in
 * a URL with a scheme, but a malformed password can, for example
 * `admin:2024#Se/cret@example.org/filter.txt`, so a match that stops at a
 * path separator misses it. The offsets are the start and every position after
 * a slash or a backslash, and the dependency helper decides whether a suffix
 * has userinfo.
 *
 * @param url URL without a scheme.
 *
 * @returns Offsets from the start to the end of the value.
 */
const getUserinfoStartOffsets = (url: string): number[] => {
    const offsets = [0];

    for (let index = 0; index < url.length; index += 1) {
        if (url[index] === '/' || url[index] === '\\') {
            offsets.push(index + 1);
        }
    }

    return offsets;
};

/**
 * Removes the userinfo component from a value without a scheme at the given
 * offset.
 *
 * @param url Value without a scheme.
 * @param offset Offset at which a userinfo component can start.
 *
 * @returns Value without the userinfo component, or `undefined` if the offset
 * has no userinfo.
 */
const sanitizeUserinfoAt = (url: string, offset: number): string | undefined => {
    const candidate = url.slice(offset);

    if (!startsWithUserinfo(candidate)) {
        return undefined;
    }

    const valueWithPlaceholder = `${PLACEHOLDER_SCHEME}${candidate}`;
    const sanitizedValue = stripUrlCredentials(valueWithPlaceholder);

    if (sanitizedValue === valueWithPlaceholder) {
        return undefined;
    }

    return `${url.slice(0, offset)}${sanitizedValue.slice(PLACEHOLDER_SCHEME.length)}`;
};

/**
 * Removes the userinfo component from a URL, including a URL without a scheme.
 *
 * The dependency helper finds the userinfo only in a URL that has a scheme or
 * starts with `//`. An external `@include` accepts a scheme-less URL, for
 * example `user:pass@example.org/filter.txt`, because the `@include` directive
 * treats any value with a colon as an external URL. The fallback parses each
 * candidate with a placeholder scheme, then removes the placeholder.
 *
 * A value that such a directive treats as external can also start with a path
 * prefix, for example `sub/user:pass@example.org/filter.txt`, or contain a
 * malformed password, for example
 * `admin:2024#Se/cret@example.org/filter.txt`. The fallback tries every
 * position after a path separator, so the prefix stays as it is and the
 * dependency helper finds the userinfo.
 *
 * @param url URL that may contain a username and a password.
 *
 * @returns URL without the userinfo component.
 */
export const sanitizeUrl = (url: string): string => {
    if (!url.includes('@')) {
        return url;
    }

    const sanitizedUrl = stripUrlCredentials(url);

    if (sanitizedUrl !== url) {
        return sanitizedUrl;
    }

    if (SCHEME_WITH_SLASHES_REGEXP.test(url)) {
        // The scheme-less fallback handles a value such as
        // `user:pass@example.org`, which has no slash after the colon. A value
        // with one keeps the result the dependency helper produced. Without
        // this guard the fallback rewrites a real URL whose path or query
        // happens to contain `name:value@`.
        return sanitizedUrl;
    }

    const offsets = getUserinfoStartOffsets(url);

    for (let index = 0; index < offsets.length; index += 1) {
        const sanitizedValue = sanitizeUserinfoAt(url, offsets[index]);

        if (sanitizedValue !== undefined) {
            return sanitizedValue;
        }
    }

    return sanitizedUrl;
};

/**
 * Removes credentials from a whitespace-separated token of a text.
 *
 * A directive can quote a URL, and the quotes belong to the directive rather
 * than to the URL, so they stay when the userinfo is removed.
 *
 * @param token Token of a text.
 *
 * @returns Token without credentials.
 */
const sanitizeToken = (token: string): string => {
    const openingQuote = /^["']/.exec(token)?.[0] ?? '';
    const closingQuote = openingQuote !== '' && token.length > 1 && token.endsWith(openingQuote)
        ? openingQuote
        : '';
    const url = token.slice(openingQuote.length, token.length - closingQuote.length);

    return `${openingQuote}${sanitizeUrl(url)}${closingQuote}`;
};

/**
 * Matches a scheme-less userinfo component whose password contains
 * whitespace, for example `user:pa ss@example.org/filter.txt`.
 *
 * The dependency helper handles whitespace in a password only for a URL with
 * a scheme. A scheme-less value is split on whitespace before the sanitizer
 * sees the whole component, so the token with the colon has no at sign and the
 * token with the at sign has no colon. This pass runs on the text before the
 * split.
 *
 * The match is conservative: the colon must be followed by a non-space
 * character, and the text after the at sign must look like a host, so a colon
 * in prose, for example `Error: something happened at user@example.org`, is
 * not treated as userinfo. A dotted host, `localhost`, a single-label host
 * with a path, query, or fragment, and a port or IPv6 literal are accepted, as
 * in the dependency helper.
 *
 * A path prefix, for example `sub/`, `./`, or `/`, is captured and kept, so
 * the redaction matches the token-wise scheme-less fallback. A value that
 * starts with a scheme and two slashes does not match: the prefix group can
 * consume only the first slash, and the username cannot start with the
 * second one. This keeps a real URL's `name:value@` path or query intact.
 */
const SCHEME_LESS_USERINFO_WITH_SPACE_REGEXP = new RegExp(
    String.raw`(?<![^\s"'(<])((?:/)?(?:[^/\\\s@]+/)*)([^\s/\\@:]+):(?=\S)[^\s/\\]*?\s[^\s/\\]*@`
    + String.raw`(?=[^\s/\\?#:]*[.:]|localhost(?:[/\\?#]|$)|[^\s/\\?#:.]+(?:[/\\?#]|$))`,
    'gi',
);

/**
 * Removes a scheme-less userinfo component whose password contains whitespace.
 *
 * @param text Text that may contain a scheme-less URL with credentials.
 *
 * @returns Text without the scheme-less userinfo components.
 */
const sanitizeSchemeLessUserinfo = (text: string): string => text.replace(
    SCHEME_LESS_USERINFO_WITH_SPACE_REGEXP,
    '$1',
);

/**
 * Removes credentials from every whitespace-separated token of a text.
 *
 * A message can contain a command line, a directive line, or a dependency
 * error, and the dependency helper finds the userinfo only in a URL that has a
 * scheme or starts with `//`. The helper therefore runs on the whole text
 * first, which keeps a password that contains a space, and then on each token,
 * which covers a scheme-less form that follows a path prefix. A scheme-less
 * password with a space is removed before the split, because the split would
 * separate the colon from the at sign. The whitespace, including line breaks,
 * is kept.
 *
 * @param text Text that may contain URLs with credentials.
 *
 * @returns Text without credentials.
 */
export const sanitizeText = (text: string): string => sanitizeSchemeLessUserinfo(stripUrlCredentials(text))
    .split(/(\s+)/)
    .map((part) => (part.trim() === '' ? part : sanitizeToken(part)))
    .join('');

/**
 * Checks that a value is a plain object.
 *
 * @param value Value to check.
 *
 * @returns `true` if the value is a plain object.
 */
const isPlainObject = (value: unknown): value is Record<string, unknown> => {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);

    return prototype === Object.prototype || prototype === null;
};

/**
 * Removes credentials from an error message, stack, own enumerable
 * properties, and cause.
 *
 * The console prints these properties when it inspects an error, so the
 * `stdout`, `stderr`, and `output` properties of an `execFileSync` error must
 * not keep the userinfo component. Plain objects and arrays are redacted
 * recursively, and a `seen` set stops on cycles.
 *
 * @param value Value to sanitize.
 * @param seen Objects that are already processed.
 *
 * @returns Sanitized value.
 */
const sanitizeErrorValue = (value: unknown, seen: WeakSet<object>): unknown => {
    if (typeof value === 'string') {
        return sanitizeText(value);
    }

    if (typeof value !== 'object' || value === null || seen.has(value)) {
        return value;
    }

    seen.add(value);

    if (value instanceof Error) {
        value.message = sanitizeText(value.message);
        if (value.stack) {
            value.stack = sanitizeText(value.stack);
        }

        const properties = value as unknown as Record<string, unknown>;
        Object.keys(value).forEach((property) => {
            properties[property] = sanitizeErrorValue(properties[property], seen);
        });

        if (value.cause !== undefined) {
            value.cause = sanitizeErrorValue(value.cause, seen);
        }

        return value;
    }

    if (Array.isArray(value)) {
        value.forEach((element, index) => {
            value[index] = sanitizeErrorValue(element, seen);
        });

        return value;
    }

    if (isPlainObject(value)) {
        Object.keys(value).forEach((property) => {
            value[property] = sanitizeErrorValue(value[property], seen);
        });

        return value;
    }

    return value;
};

/**
 * Removes URL credentials from an error message, stack, and properties.
 *
 * A failed `execFileSync` call includes the full `curl` command line in the
 * error text, so the error can contain the URL with credentials. A dependency
 * error can contain a scheme-less form. Strings inside the properties are
 * sanitized too, but a non-`Error` value is returned unchanged: `execFileSync`
 * throws only `Error` instances.
 *
 * @param error Error to sanitize.
 *
 * @returns Sanitized error or the original value when it is not an `Error`.
 */
export const sanitizeError = (error: unknown): unknown => (error instanceof Error
    ? sanitizeErrorValue(error, new WeakSet())
    : error);

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
