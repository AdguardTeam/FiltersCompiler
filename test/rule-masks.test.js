import {
    describe,
    it,
    expect,
} from 'vitest';

import {
    NOT_OPTIMIZED_HINT,
    filterWithHints,
    hasHint,
    isHint,
} from '../src/main/rule/rule-masks';

describe('isHint', () => {
    it('Accepts a canonical hint line', () => {
        expect(isHint('!+ PLATFORM(ios)')).toBe(true);
        expect(isHint('!+ NOT_OPTIMIZED')).toBe(true);
    });

    it('Accepts hints without the separator space', () => {
        expect(isHint('!+NOT_CONVERT')).toBe(true);
        expect(isHint('!+\tNOT_CONVERT')).toBe(true);
    });

    it('Rejects non-hint lines', () => {
        expect(isHint('! comment')).toBe(false);
        expect(isHint('||example.com^')).toBe(false);
    });

    it('Rejects empty values', () => {
        expect(isHint('')).toBe(false);
        expect(isHint(null)).toBe(false);
        expect(isHint(undefined)).toBe(false);
    });
});

describe('hasHint', () => {
    it('Finds a token in a hint line', () => {
        expect(hasHint('!+ PLATFORM(ios)', 'PLATFORM(ios)')).toBe(true);
        expect(hasHint('!+ PLATFORM(ios) NOT_OPTIMIZED', NOT_OPTIMIZED_HINT)).toBe(true);
    });

    it('Returns false when the token is absent', () => {
        expect(hasHint('!+ PLATFORM(ios)', NOT_OPTIMIZED_HINT)).toBe(false);
        expect(hasHint('||example.com^', NOT_OPTIMIZED_HINT)).toBe(false);
        expect(hasHint(null, NOT_OPTIMIZED_HINT)).toBe(false);
    });
});

describe('filterWithHints', () => {
    it('Drops hints together with the rule they modify', () => {
        const lines = ['!+ PLATFORM(ios)', '||a.com^', '||b.com^'];
        const result = filterWithHints(lines, (line) => line !== '||a.com^');
        expect(result).toEqual(['||b.com^']);
    });

    it('Keeps hints attached to retained rules', () => {
        const lines = ['!+ PLATFORM(ios)', '||a.com^'];
        expect(filterWithHints(lines, () => true)).toEqual(lines);
    });

    it('Drops every hint of a run with the dropped rule', () => {
        const lines = ['!+ PLATFORM(ios)', '!+ NOT_OPTIMIZED', '||a.com^', '||b.com^'];
        const result = filterWithHints(lines, (line) => line !== '||a.com^');
        expect(result).toEqual(['||b.com^']);
    });

    it('Drops a hint without the separator space with its rule', () => {
        const lines = ['!+PLATFORM(ios)', '||a.com^', '||b.com^'];
        const result = filterWithHints(lines, (line) => line !== '||a.com^');
        expect(result).toEqual(['||b.com^']);
    });

    it('Keeps trailing hints that modify nothing', () => {
        const lines = ['||a.com^', '!+ PLATFORM(ios)'];
        expect(filterWithHints(lines, () => true)).toEqual(lines);
    });
});
