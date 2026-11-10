import {
    describe,
    it,
    expect,
} from 'vitest';

import { stripUrlCredentials, stripUrlCredentialsFromText } from '../src/main/utils/url';

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

    it('keeps malformed input unchanged', () => {
        expect(stripUrlCredentials('https://user:pass@')).toBe('https://user:pass@');
    });

    it('keeps a URL without credentials unchanged', () => {
        const url = 'https://example.org/filter.txt';

        expect(stripUrlCredentials(url)).toBe(url);
    });
});

describe('stripUrlCredentialsFromText', () => {
    it('removes credentials from an include directive line', () => {
        const line = '@include "https://user:pass@example.org/filter.txt" /ignoreTrustLevel';

        expect(stripUrlCredentialsFromText(line))
            .toBe('@include "https://example.org/filter.txt" /ignoreTrustLevel');
    });

    it('removes credentials from a curl error message', () => {
        const message = 'Command failed: curl --fail --silent -L https://user:pass@example.org/filter.txt';

        expect(stripUrlCredentialsFromText(message))
            .toBe('Command failed: curl --fail --silent -L https://example.org/filter.txt');
    });

    it('keeps @ characters outside the userinfo component', () => {
        const text = 'Included https://example.org/path@name?query=user@name#fragment@name';

        expect(stripUrlCredentialsFromText(text)).toBe(text);
    });
});
