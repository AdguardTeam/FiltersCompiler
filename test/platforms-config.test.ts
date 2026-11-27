import { describe, it, expect } from 'vitest';

import { platformConfigPatterns, platformsConfig } from '../src/main/platforms-config.js';
import type { PlatformEntry } from '../src/main/platforms-config.js';

const HTML_FILTERING_PLATFORMS = ['WINDOWS', 'MAC_V2', 'MAC_V3', 'ANDROID', 'CLI', 'EXTENSION_FIREFOX'];
const CORELIBS_PLATFORMS = ['WINDOWS', 'MAC_V2', 'MAC_V3', 'ANDROID', 'CLI'];

describe('production platformsConfig defines', () => {
    describe('cap_html_filtering', () => {
        it.each(HTML_FILTERING_PLATFORMS)(
            'defines for %s, which support HTML filtering rules',
            (name) => {
                expect(platformsConfig[name].defines.cap_html_filtering).toBe(true);
            },
        );

        it.each(Object.keys(platformsConfig).filter((name) => !HTML_FILTERING_PLATFORMS.includes(name)))(
            'does not define for %s, which do not support HTML filtering rules',
            (name) => {
                expect(platformsConfig[name].defines.cap_html_filtering).toBeUndefined();
            },
        );
    });
    describe('adguard_corelibs', () => {
        it.each(CORELIBS_PLATFORMS)(
            'defines for %s, which support CoreLibs',
            (name) => {
                expect(platformsConfig[name].defines.adguard_corelibs).toBe(true);
            },
        );

        it.each(Object.keys(platformsConfig).filter((name) => !CORELIBS_PLATFORMS.includes(name)))(
            'does not define for %s, which do not support CoreLibs',
            (name) => {
                expect(platformsConfig[name].defines.adguard_corelibs).toBeUndefined();
            },
        );
    });
});

describe('production platformsConfig immutability', () => {
    it('keeps every entry assignable to PlatformEntry', () => {
        const takeEntry = (entry: PlatformEntry): string => entry.path;

        Object.values(platformsConfig).forEach((entry) => {
            expect(takeEntry(entry)).toBe(entry.path);
        });
    });

    it('freezes the root, entries, configuration, and defines', () => {
        expect(Object.isFrozen(platformsConfig)).toBe(true);
        Object.values(platformsConfig).forEach((entry) => {
            expect(Object.isFrozen(entry)).toBe(true);
            expect(Object.isFrozen(entry.configuration)).toBe(true);
            expect(Object.isFrozen(entry.defines)).toBe(true);
        });
    });

    it('rejects an entry override', () => {
        expect(() => {
            // @ts-expect-error the exported defaults are readonly
            platformsConfig.WINDOWS.path = 'other';
        }).toThrow(TypeError);
    });
});

describe('platformConfigPatterns', () => {
    it('registers every pattern group as a frozen array of strings', () => {
        expect(Object.isFrozen(platformConfigPatterns)).toBe(true);
        Object.entries(platformConfigPatterns).forEach(([name, patterns]) => {
            expect(name).toMatch(/_PATTERNS$/);
            expect(Array.isArray(patterns)).toBe(true);
            expect(Object.isFrozen(patterns)).toBe(true);
            patterns.forEach((pattern) => {
                expect(typeof pattern).toBe('string');
            });
        });
    });

    it('contains every default removeRulePatterns entry', () => {
        const groups = Object.values(platformConfigPatterns).flat();
        Object.values(platformsConfig).forEach((entry) => {
            (entry.configuration.removeRulePatterns ?? []).forEach((pattern) => {
                expect(groups).toContain(pattern);
            });
        });
    });

    it.each(['EXTENSION_SAFARI', 'IOS', 'EXTENSION_ANDROID_CONTENT_BLOCKER', 'EXTENSION_UBLOCK'])(
        'removes $urltransform rules for %s',
        (name) => {
            const patterns = platformsConfig[name].configuration.removeRulePatterns ?? [];
            const matches = patterns.some((pattern) => new RegExp(pattern).test('||example.com^$urltransform=/a/b/'));
            expect(matches).toBe(true);
        },
    );
});
