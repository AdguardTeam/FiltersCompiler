import {
    describe,
    it,
    expect,
} from 'vitest';

import { stripUrlCredentials } from '@adguard/filters-downloader';

import {
    sanitizeError,
    sanitizeText,
    sanitizeUrl,
} from '../src/main/utils/webutils';

// The compiler relies on these guarantees of the dependency, so the test
// pins them when the dependency is updated.
describe('stripUrlCredentials', () => {
    it('removes a username and a password', () => {
        expect(stripUrlCredentials('https://user:pass@example.org/filter.txt'))
            .toBe('https://example.org/filter.txt');
    });

    it('removes a username without a password', () => {
        expect(stripUrlCredentials('https://user@example.org/filter.txt'))
            .toBe('https://example.org/filter.txt');
    });

    it('removes a percent-encoded password', () => {
        expect(stripUrlCredentials('https://user:p%40ss@example.org/filter.txt'))
            .toBe('https://example.org/filter.txt');
    });

    it('keeps @ characters in the path, query, and fragment', () => {
        const url = 'https://example.org/path@name?query=user@name#fragment@name';

        expect(stripUrlCredentials(url)).toBe(url);
    });

    it('keeps a relative path unchanged', () => {
        expect(stripUrlCredentials('./filters/common.txt')).toBe('./filters/common.txt');
    });

    it('removes credentials from malformed input', () => {
        // The dependency removes the userinfo even when the rest of the value
        // is not a valid URL. A leak is worse than an incomplete URL in a log.
        expect(stripUrlCredentials('https://user:pass@')).toBe('https://');
        // A port outside the valid range makes `new URL()` throw, and a space
        // in the host is not valid either. The helper must not return the
        // original value, because that value is the one that produces the
        // download error being debugged.
        expect(stripUrlCredentials('https://user:pass@example.org:99999/f.txt'))
            .toBe('https://example.org:99999/f.txt');
        expect(stripUrlCredentials('https://user:pass@exa mple.org/f.txt'))
            .toBe('https://exa mple.org/f.txt');
    });

    it('keeps a URL without credentials unchanged', () => {
        const url = 'https://example.org/filter.txt';

        expect(stripUrlCredentials(url)).toBe(url);
    });
});

describe('stripUrlCredentials in text', () => {
    it('removes credentials from an include directive line', () => {
        const line = '@include "https://user:pass@example.org/filter.txt" /ignoreTrustLevel';

        expect(stripUrlCredentials(line))
            .toBe('@include "https://example.org/filter.txt" /ignoreTrustLevel');
    });

    it('removes credentials from a curl error message', () => {
        const message = 'Command failed: curl --fail --silent -L https://user:pass@example.org/filter.txt';

        expect(stripUrlCredentials(message))
            .toBe('Command failed: curl --fail --silent -L https://example.org/filter.txt');
    });

    it('keeps @ characters outside the userinfo component', () => {
        const text = 'Included https://example.org/path@name?query=user@name#fragment@name';

        expect(stripUrlCredentials(text)).toBe(text);
    });
});

describe('sanitizeUrl', () => {
    it('removes credentials from a scheme-less url', () => {
        // `@include` treats a value with a colon as an external url, so a
        // scheme-less credential form reaches the compiler log.
        expect(sanitizeUrl('user:pass@example.org/filter.txt'))
            .toBe('example.org/filter.txt');
    });

    it('removes credentials from a scheme-less url with a port', () => {
        expect(sanitizeUrl('user:pass@127.0.0.1:8080/filter.txt'))
            .toBe('127.0.0.1:8080/filter.txt');
    });

    it('removes a whole scheme-less userinfo component', () => {
        expect(sanitizeUrl('user:pass@')).toBe('');
    });

    it('keeps a local path with an at sign unchanged', () => {
        expect(sanitizeUrl('filters/user@example.txt')).toBe('filters/user@example.txt');
    });

    it('keeps a windows path with an at sign unchanged', () => {
        expect(sanitizeUrl('C:\\filters\\user@example.txt')).toBe('C:\\filters\\user@example.txt');
    });

    it('removes credentials from a url with a scheme', () => {
        expect(sanitizeUrl('https://user:pass@example.org/filter.txt'))
            .toBe('https://example.org/filter.txt');
    });

    it('keeps a url with a scheme and a colon in the path', () => {
        // The scheme-less fallback must not rewrite a real URL whose path
        // contains `name:value@`. The sanitized value is logged and put into
        // the error, so it must name the URL that was requested.
        expect(sanitizeUrl('https://example.org/2024:12@v/f.txt'))
            .toBe('https://example.org/2024:12@v/f.txt');
    });

    it('keeps a url with a scheme and a colon in the query', () => {
        expect(sanitizeUrl('https://example.org/filter.txt?email=user:pass@example.com'))
            .toBe('https://example.org/filter.txt?email=user:pass@example.com');
    });

    it.each([
        {
            name: 'a relative path',
            url: './user:pass@example.org/filter.txt',
            expected: './example.org/filter.txt',
        },
        {
            name: 'an absolute path',
            url: '/user:pass@example.org/filter.txt',
            expected: '/example.org/filter.txt',
        },
        {
            name: 'a path prefix',
            url: 'sub/user:pass@example.org/f.txt',
            expected: 'sub/example.org/f.txt',
        },
    ])('removes credentials from a scheme-less url after $name', ({ url, expected }) => {
        // `@include` treats any value with a colon as an external url, so a
        // path prefix does not stop the scheme-less credential form from
        // reaching the rejection error.
        expect(sanitizeUrl(url)).toBe(expected);
    });
});

describe('sanitizeText', () => {
    it('removes a scheme-less credential form and keeps the line breaks', () => {
        const text = [
            "Failed to resolve the include directive '!#include adg-user:pass@example.org/missing.txt'",
            "URL: '/filters'",
            "\tENOENT: no such file or directory, open '/filters/adg-user:pass@example.org/missing.txt'",
        ].join('\n');

        expect(sanitizeText(text)).toBe([
            "Failed to resolve the include directive '!#include example.org/missing.txt'",
            "URL: '/filters'",
            "\tENOENT: no such file or directory, open '/filters/example.org/missing.txt'",
        ].join('\n'));
    });

    it('removes a url with a scheme and a password that contains a space', () => {
        expect(sanitizeText('Downloading http://user:pa ss@example.org/f.txt now'))
            .toBe('Downloading http://example.org/f.txt now');
    });

    it('removes a scheme-less password that contains a space', () => {
        // The token-wise pass cannot see this form: the colon and the at sign
        // are in different whitespace-separated tokens.
        expect(sanitizeText('! Redirect: adg-user:pa ss@example.org/next.txt'))
            .toBe('! Redirect: example.org/next.txt');
    });

    it.each([
        {
            name: 'a relative path prefix',
            text: '! Redirect: sub/adg-user:pa ss@example.org/next.txt',
            expected: '! Redirect: sub/example.org/next.txt',
        },
        {
            name: 'a dot path prefix',
            text: '! Redirect: ./adg-user:pa ss@example.org/next.txt',
            expected: '! Redirect: ./example.org/next.txt',
        },
        {
            name: 'an absolute path prefix',
            text: "ENOENT: '/filters/adg-user:pa ss@example.org/x.txt'",
            expected: "ENOENT: '/filters/example.org/x.txt'",
        },
    ])('removes a scheme-less password with a space after $name', ({ text, expected }) => {
        expect(sanitizeText(text)).toBe(expected);
    });

    it('keeps a colon in prose before an email address', () => {
        expect(sanitizeText('Error: something happened at user@example.org'))
            .toBe('Error: something happened at user@example.org');
    });

    it('removes credentials from a quoted directive line', () => {
        expect(sanitizeText("Failed to resolve the include directive '!#include \"user:pass@example.org/x.txt\"'"))
            .toBe("Failed to resolve the include directive '!#include \"example.org/x.txt\"'");
    });

    it('keeps a text without credentials unchanged', () => {
        expect(sanitizeText('Applying inclusion from: ./local.txt'))
            .toBe('Applying inclusion from: ./local.txt');
    });
});

describe('sanitizeError', () => {
    it('removes credentials from own enumerable properties', () => {
        // The console prints these properties when it inspects an error, so a
        // `curl` failure would expose the URL from `stderr`, `stdout`, or
        // `output` even though the message and the stack are sanitized.
        const error = new Error('Command failed: curl https://user:pass@example.org/f.txt');
        Object.assign(error, {
            stderr: 'curl https://user:pass@example.org/f.txt',
            stdout: ['https://user:pass@example.org/f.txt'],
            output: [{ text: 'https://user:pass@example.org/f.txt' }],
            status: 22,
        });

        sanitizeError(error);

        const properties = error as unknown as Record<string, unknown>;

        expect(error.message).toBe('Command failed: curl https://example.org/f.txt');
        expect(properties.stderr).toBe('curl https://example.org/f.txt');
        expect(properties.stdout).toEqual(['https://example.org/f.txt']);
        expect(properties.output).toEqual([{ text: 'https://example.org/f.txt' }]);
        expect(properties.status).toBe(22);
    });

    it('removes credentials from a cause error', () => {
        const cause = new Error('cause https://user:pass@example.org/f.txt');
        const error = new Error('outer', { cause });

        sanitizeError(error);

        expect((error.cause as Error).message)
            .toBe('cause https://example.org/f.txt');
    });
});
