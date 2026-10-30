import {
    describe,
    it,
    expect,
} from 'vitest';

import { parseLocaleMessages } from '../src/main/utils/locale-messages';

describe('locale message parser', () => {
    it('parses name and description keyed by entity id', () => {
        expect(parseLocaleMessages([
            { 'filter.25.name': 'Filter 25', 'filter.25.description': 'Filter 25 description' },
            { 'filter.26.name': 'Filter 26' },
        ], 'filter')).toEqual({
            25: { name: 'Filter 25', description: 'Filter 25 description' },
            26: { name: 'Filter 26' },
        });
    });

    it('ignores malformed keys and keys of other entity kinds', () => {
        expect(parseLocaleMessages([
            { 'filter.1.name': 'Filter 1', 'filter.1.old.name': 'Obsolete' },
            { 'filter..name': 'Broken' },
            { 'group.1.name': 'Other kind' },
        ], 'filter')).toEqual({
            1: { name: 'Filter 1' },
        });
    });

    it('returns an empty object when the locale file is missing', () => {
        expect(parseLocaleMessages(null, 'filter')).toEqual({});
    });

    it('throws when the locale file contents are not an array', () => {
        const messages = { 'filter.1.name': 'Filter 1' } as unknown as Record<string, string>[];

        expect(() => parseLocaleMessages(messages, 'filter')).toThrow(TypeError);
    });
});
