import {
    describe,
    it,
    expect,
} from 'vitest';

import { stripUrlCredentials } from '@adguard/filters-downloader';

import { sanitizeText, sanitizeUrl } from '../src/main/utils/webutils';

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

    it('removes credentials from a quoted directive line', () => {
        expect(sanitizeText("Failed to resolve the include directive '!#include \"user:pass@example.org/x.txt\"'"))
            .toBe("Failed to resolve the include directive '!#include \"example.org/x.txt\"'");
    });

    it('keeps a text without credentials unchanged', () => {
        expect(sanitizeText('Applying inclusion from: ./local.txt'))
            .toBe('Applying inclusion from: ./local.txt');
    });
});
