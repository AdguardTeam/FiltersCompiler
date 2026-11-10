import { URL } from 'node:url';

/**
 * Matches a URL with a userinfo component at the start of a string.
 *
 * The userinfo component ends at `@`. The authority ends at `/`, `\`, `?`,
 * or `#`, the same boundaries that the WHATWG URL parser uses.
 */
const URL_WITH_USERINFO = /^([a-z][a-z0-9+.-]*:\/\/|\/\/)([^/\\?#]*)@/i;

/**
 * Matches a URL with a userinfo component inside arbitrary text.
 */
const URL_WITH_USERINFO_IN_TEXT = /([a-z][a-z0-9+.-]*:\/\/|\/\/)([^/\s\\?#]*)@/gi;

/**
 * Removes the userinfo component from a URL.
 *
 * The helper removes the whole userinfo component, so both `user:pass@`
 * and `user@` are removed. The helper returns the input unchanged when the
 * URL has no userinfo component or when the sanitized value is not a valid
 * URL. It does not throw.
 *
 * The helper removes only the userinfo component of the authority. It keeps
 * `@` characters in the path, query, and fragment.
 *
 * @param url URL that may contain a username and a password.
 *
 * @returns URL without the userinfo component.
 */
export const stripUrlCredentials = (url: string): string => {
    const match = URL_WITH_USERINFO.exec(url);
    if (!match) {
        return url;
    }

    const sanitizedUrl = `${match[1]}${url.slice(match[0].length)}`;

    // `URL` cannot parse a protocol-relative URL without a base URL.
    const candidate = sanitizedUrl.startsWith('//') ? `http:${sanitizedUrl}` : sanitizedUrl;
    if (!URL.canParse(candidate)) {
        return url;
    }

    return sanitizedUrl;
};

/**
 * Removes the userinfo component from every URL in a text.
 *
 * Use this helper for a directive line or an error message that contains a
 * URL with credentials. The helper removes only the userinfo components. It
 * keeps the rest of the text intact.
 *
 * @param text Text that may contain URLs with credentials.
 *
 * @returns Text without the userinfo components.
 */
export const stripUrlCredentialsFromText = (text: string): string => (
    text.replace(URL_WITH_USERINFO_IN_TEXT, '$1')
);
