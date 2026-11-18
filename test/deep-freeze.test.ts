import { describe, it, expect } from 'vitest';

import { deepFreeze } from '../src/main/utils/deep-freeze';

describe('deepFreeze', () => {
    it('returns the same reference and freezes nested objects and arrays', () => {
        const value = {
            name: 'test',
            nested: { count: 1 },
            list: [{ id: 1 }, ['a']],
        };

        const frozen = deepFreeze(value);

        expect(frozen).toBe(value);
        expect(Object.isFrozen(frozen)).toBe(true);
        expect(Object.isFrozen(frozen.nested)).toBe(true);
        expect(Object.isFrozen(frozen.list)).toBe(true);
        expect(Object.isFrozen(frozen.list[0])).toBe(true);
        expect(Object.isFrozen(frozen.list[1])).toBe(true);
    });

    it('freezes an array root and its items', () => {
        const value = [{ id: 1 }, { id: 2 }];

        const frozen = deepFreeze(value);

        expect(frozen).toBe(value);
        expect(Object.isFrozen(frozen)).toBe(true);
        expect(Object.isFrozen(frozen[0])).toBe(true);
    });

    it('does not change the values', () => {
        const value = {
            count: 1,
            nested: { enabled: true },
            list: ['a', 'b'],
        };
        const snapshot = JSON.stringify(value);

        deepFreeze(value);

        expect(JSON.stringify(value)).toBe(snapshot);
    });

    it('accepts primitives and null', () => {
        expect(deepFreeze(1)).toBe(1);
        expect(deepFreeze('text')).toBe('text');
        expect(deepFreeze(true)).toBe(true);
        expect(deepFreeze(null)).toBeNull();
        expect(deepFreeze(undefined)).toBeUndefined();
    });

    it('returns a deeply readonly type and rejects runtime changes', () => {
        const frozen = deepFreeze({
            nested: { value: 1 },
            list: ['a'],
        });

        expect(frozen.nested.value).toBe(1);
        expect(() => {
            // @ts-expect-error the result is deeply readonly
            frozen.nested.value = 2;
        }).toThrow(TypeError);
        expect(() => {
            // @ts-expect-error the result is deeply readonly
            frozen.list.push('b');
        }).toThrow(TypeError);
    });

    it('keeps an already frozen object usable', () => {
        const value = Object.freeze({ nested: Object.freeze({ value: 1 }) });

        expect(deepFreeze(value)).toBe(value);
        expect(Object.isFrozen(value)).toBe(true);
        expect(Object.isFrozen(value.nested)).toBe(true);
    });

    it('does not freeze function values', () => {
        const fn = () => 1;
        const value = { fn };

        deepFreeze(value);

        expect(value.fn).toBe(fn);
        expect(Object.isFrozen(fn)).toBe(false);
    });
});
