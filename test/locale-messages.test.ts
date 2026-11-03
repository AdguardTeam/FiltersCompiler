import {
    describe,
    it,
    expect,
} from 'vitest';

import { parseLocaleMessages } from '../src/main/utils/locale-messages';

const LOCALE_PATH = '/locales/en/filters.json';

describe('locale message parser', () => {
    it('parses name and description keyed by entity id', () => {
        expect(parseLocaleMessages([
            { 'filter.25.name': 'Filter 25', 'filter.25.description': 'Filter 25 description' },
            { 'filter.26.name': 'Filter 26' },
        ], 'filter', LOCALE_PATH)).toEqual({
            25: { name: 'Filter 25', description: 'Filter 25 description' },
            26: { name: 'Filter 26' },
        });
    });

    it('ignores malformed keys and keys of other entity kinds', () => {
        expect(parseLocaleMessages([
            { 'filter.1.name': 'Filter 1', 'filter.1.old.name': 'Obsolete' },
            { 'filter..name': 'Broken' },
            { 'group.1.name': 'Other kind' },
        ], 'filter', LOCALE_PATH)).toEqual({
            1: { name: 'Filter 1' },
        });
    });

    it('returns an empty object when the locale file is missing', () => {
        expect(parseLocaleMessages(null, 'filter', LOCALE_PATH)).toEqual({});
    });

    it('names the locale file when the contents are not an array', () => {
        const messages = { 'filter.1.name': 'Filter 1' };

        expect(() => parseLocaleMessages(messages, 'filter', LOCALE_PATH)).toThrow(
            new TypeError(`Locale file ${LOCALE_PATH} must contain an array of message objects`),
        );
    });
});
