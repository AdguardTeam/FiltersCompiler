import {
    describe,
    it,
    expect,
    vi,
} from 'vitest';
import { Version } from '../src/main/utils/version';

// Mock log to hide error messages
vi.mock('../src/main/utils/log');

describe('version', () => {
    describe('parse', () => {
        it('parses valid version string', () => {
            expect(Version.parse('1.2.3.4')).toEqual([1, 2, 3, 4]);
        });

        it('treats NaN segments as 0', () => {
            expect(Version.parse('1.abc.3')).toEqual([1, 0, 3]);
        });

        it('clamps negative segments to 0', () => {
            expect(Version.parse('1.-5.3')).toEqual([1, 0, 3]);
        });

        it('handles null input', () => {
            expect(Version.parse(null)).toEqual([0]);
        });

        it('handles undefined input', () => {
            expect(Version.parse(undefined)).toEqual([0]);
        });

        it('handles empty string', () => {
            expect(Version.parse('')).toEqual([0]);
        });
    });

    describe('increment', () => {
        it('increments version correctly', () => {
            let v = Version.increment('0.0.0.0');
            expect(v).toBe('0.0.0.1');

            v = Version.increment('0.0.1.99');
            expect(v).toBe('0.0.2.0');

            v = Version.increment('99.99.99.99');
            expect(v).toBe('100.0.0.0');
        });
    });
});
