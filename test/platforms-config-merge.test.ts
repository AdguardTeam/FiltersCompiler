import { describe, it, expect } from 'vitest';

import {
    PlatformsConfigError,
    mergePlatformsConfig,
    platformsConfig,
} from '../src/main/platforms-config';
import type { PlatformsConfig, PlatformsConfigPatch } from '../src/main/platforms-config';

const asPatch = (value: unknown): PlatformsConfigPatch => value as PlatformsConfigPatch;

const expectConfigError = (patch: unknown, path: string, message?: string): void => {
    try {
        mergePlatformsConfig(platformsConfig, asPatch(patch));
    } catch (error) {
        expect(error).toBeInstanceOf(PlatformsConfigError);
        expect((error as PlatformsConfigError).path).toBe(path);
        if (message !== undefined) {
            expect((error as Error).message).toContain(message);
        }
        return;
    }

    throw new Error('Expected mergePlatformsConfig to throw');
};

describe('mergePlatformsConfig', () => {
    it('returns an equal, new, frozen config for an empty patch', () => {
        const merged = mergePlatformsConfig(platformsConfig, {});

        expect(merged).toEqual(platformsConfig);
        expect(merged).not.toBe(platformsConfig);
        expect(Object.isFrozen(merged)).toBe(true);
    });

    it('inherits absent fields and overrides present fields', () => {
        const merged = mergePlatformsConfig(platformsConfig, { IOS: { expires: '1 hour' } });

        expect(merged.IOS.expires).toBe('1 hour');
        expect(merged.IOS.platform).toBe(platformsConfig.IOS.platform);
        expect(merged.IOS.path).toBe(platformsConfig.IOS.path);
        expect(merged.IOS.configuration).toEqual(platformsConfig.IOS.configuration);
        expect(merged.IOS.defines).toEqual(platformsConfig.IOS.defines);
    });

    it('replaces an array instead of appending to it', () => {
        const merged = mergePlatformsConfig(platformsConfig, {
            EXTENSION_UBLOCK: { configuration: { removeRulePatterns: ['^zzz-'] } },
        });

        expect(merged.EXTENSION_UBLOCK.configuration.removeRulePatterns).toEqual(['^zzz-']);
    });

    it('copies a replaced array', () => {
        const removeRulePatterns = ['^zzz-'];
        const merged = mergePlatformsConfig(platformsConfig, {
            EXTENSION_UBLOCK: { configuration: { removeRulePatterns } },
        });
        expect(merged.EXTENSION_UBLOCK.configuration.removeRulePatterns).not.toBe(removeRulePatterns);

        removeRulePatterns.push('^other-');
        expect(merged.EXTENSION_UBLOCK.configuration.removeRulePatterns).toEqual(['^zzz-']);
    });

    it('treats false removeRulePatterns as absent', () => {
        const merged = mergePlatformsConfig(platformsConfig, {
            WINDOWS: { configuration: { removeRulePatterns: false } },
        });

        expect('removeRulePatterns' in merged.WINDOWS.configuration).toBe(false);
    });

    it('copies RegExp removeRulePatterns entries', () => {
        const pattern = /^zzz-/g;
        const merged = mergePlatformsConfig(platformsConfig, {
            WINDOWS: { configuration: { removeRulePatterns: [pattern] } },
        });

        const patterns = merged.WINDOWS.configuration.removeRulePatterns;
        expect(patterns).toHaveLength(1);
        expect(patterns?.[0]).toBeInstanceOf(RegExp);
        expect(patterns?.[0]).not.toBe(pattern);
        expect(Object.isFrozen(pattern)).toBe(false);
    });

    it('deletes fields with null', () => {
        const merged = mergePlatformsConfig(platformsConfig, {
            MAC_V3: { expires: null },
            WINDOWS: {
                configuration: { ignoreRuleHints: null },
                defines: { adguard: null },
            },
        });

        expect('expires' in merged.MAC_V3).toBe(false);
        expect('ignoreRuleHints' in merged.WINDOWS.configuration).toBe(false);
        expect('adguard' in merged.WINDOWS.defines).toBe(false);
        expect(merged.WINDOWS.defines.adguard_app_windows).toBe(true);
    });

    it('keeps false as a value', () => {
        const merged = mergePlatformsConfig(platformsConfig, {
            WINDOWS: { configuration: { ignoreRuleHints: false } },
        });

        expect(merged.WINDOWS.configuration.ignoreRuleHints).toBe(false);
    });

    it('inherits undefined fields', () => {
        const empty = mergePlatformsConfig(platformsConfig, {});

        expect(mergePlatformsConfig(platformsConfig, { IOS: undefined })).toEqual(empty);
        expect(mergePlatformsConfig(platformsConfig, { IOS: { expires: undefined } })).toEqual(empty);
        expect(mergePlatformsConfig(platformsConfig, {
            IOS: { configuration: { removeRulePatterns: undefined } },
        })).toEqual(empty);
        expect(mergePlatformsConfig(platformsConfig, {
            IOS: { defines: { adguard: undefined } },
        })).toEqual(empty);
    });

    it('merges defines key by key and accepts new names', () => {
        const merged = mergePlatformsConfig(platformsConfig, {
            WINDOWS: { defines: { my_new_flag: true } },
        });

        expect(merged.WINDOWS.defines.my_new_flag).toBe(true);
        expect(merged.WINDOWS.defines.adguard).toBe(true);
    });

    it('adds a complete platform on a supported family', () => {
        const entry = {
            platform: 'ext_safari',
            path: 'extension/safari-new',
            configuration: { removeRulePatterns: ['^zzz-'] },
            defines: { adguard: true },
        };
        const merged = mergePlatformsConfig(platformsConfig, { NEW_SAFARI: entry });

        expect(merged.NEW_SAFARI).toEqual(entry);
        expect(Object.keys(merged)).toHaveLength(Object.keys(platformsConfig).length + 1);
        expect(Object.isFrozen(merged.NEW_SAFARI)).toBe(true);
    });

    it('rejects an incomplete new platform', () => {
        expectConfigError({ EXTENSION_UBLOCKK: {} }, 'patch.EXTENSION_UBLOCKK');
    });

    it('rejects a new platform with an undefined required field', () => {
        expectConfigError(
            {
                NEW: {
                    platform: 'ext_safari',
                    path: 'p',
                    configuration: {},
                    defines: undefined,
                },
            },
            'patch.NEW',
            'a new platform requires',
        );
    });

    it('rejects an unknown entry field', () => {
        expectConfigError({ WINDOWS: { configuratoin: {} } }, 'patch.WINDOWS.configuratoin');
    });

    it('rejects an unknown configuration field', () => {
        expectConfigError(
            { WINDOWS: { configuration: { removeRulePattern: [] } } },
            'patch.WINDOWS.configuration.removeRulePattern',
        );
    });

    it('rejects wrong types', () => {
        expectConfigError({ WINDOWS: null }, 'patch.WINDOWS');
        expectConfigError(
            { WINDOWS: { configuration: { removeRulePatterns: '^x' } } },
            'patch.WINDOWS.configuration.removeRulePatterns',
        );
        expectConfigError(
            { WINDOWS: { configuration: { ignoreRuleHints: 'no' } } },
            'patch.WINDOWS.configuration.ignoreRuleHints',
        );
        expectConfigError(
            { WINDOWS: { defines: { flag: 'yes' } } },
            'patch.WINDOWS.defines.flag',
        );
    });

    it('rejects clearing a required field', () => {
        expectConfigError({ WINDOWS: { platform: null } }, 'patch.WINDOWS.platform');
        expectConfigError({ WINDOWS: { path: null } }, 'patch.WINDOWS.path');
        expectConfigError({ WINDOWS: { configuration: null } }, 'patch.WINDOWS.configuration');
        expectConfigError({ WINDOWS: { defines: null } }, 'patch.WINDOWS.defines');
    });

    it('rejects an invalid regular expression', () => {
        expectConfigError(
            { WINDOWS: { configuration: { removeRulePatterns: ['('] } } },
            'patch.WINDOWS.configuration.removeRulePatterns[0]',
        );
        expectConfigError(
            { WINDOWS: { configuration: { replacements: [{ from: '(', to: '' }] } } },
            'patch.WINDOWS.configuration.replacements[0].from',
        );
    });

    it('rejects an unsupported platform family', () => {
        expectConfigError(
            {
                NEW: {
                    platform: 'ext_safary',
                    path: 'new',
                    configuration: {},
                    defines: {},
                },
            },
            'patch.NEW.platform',
        );
    });

    it('rejects a non-plain object patch entry', () => {
        expectConfigError({ IOS: new Date() }, 'patch.IOS');
        expectConfigError(
            { WINDOWS: { configuration: new Map([['adbHeader', 'X']]) } },
            'patch.WINDOWS.configuration',
        );
        expectConfigError(
            {
                NEWKEY: Object.create({
                    platform: 'ext_safari',
                    path: 'new/safari',
                    configuration: {},
                    defines: {},
                }),
            },
            'patch.NEWKEY',
        );
    });

    it('rejects a duplicate platform path', () => {
        expectConfigError(
            {
                NEW: {
                    platform: 'ext_safari',
                    path: 'windows',
                    configuration: {},
                    defines: {},
                },
            },
            'patch.NEW.path',
        );
        expectConfigError({ IOS: { path: 'windows' } }, 'patch.IOS.path');
        expectConfigError({ WINDOWS: { path: 'ios' } }, 'patch.WINDOWS.path');
    });

    it('rejects a duplicate path when a platform key is empty', () => {
        expectConfigError({
            '': {
                platform: 'ext_safari',
                path: 'shared',
                configuration: {},
                defines: {},
            },
            NEW: {
                platform: 'ext_safari',
                path: 'shared',
                configuration: {},
                defines: {},
            },
        }, 'patch.NEW.path');
    });

    it('reports a duplicate base path at the base entry', () => {
        const base: PlatformsConfig = {
            A: {
                platform: 'windows',
                path: 'same',
                configuration: {},
                defines: {},
            },
            B: {
                platform: 'windows',
                path: 'same',
                configuration: {},
                defines: {},
            },
        };

        expect(() => mergePlatformsConfig(base, {})).toThrow(/base\.A\.path/);
    });

    it('rejects a path that collides case-insensitively', () => {
        expectConfigError(
            {
                NEW: {
                    platform: 'ext_safari',
                    path: 'IOS',
                    configuration: {},
                    defines: {},
                },
            },
            'patch.NEW.path',
        );
    });

    it('names the patch that supplies the colliding path', () => {
        expectConfigError(
            { WINDOWS: { path: 'ios' }, IOS: { expires: '1 hour' } },
            'patch.WINDOWS.path',
        );
    });

    it('normalizes a platform path before the uniqueness check', () => {
        expectConfigError(
            {
                NEW: {
                    platform: 'ext_safari',
                    path: './windows',
                    configuration: {},
                    defines: {},
                },
            },
            'patch.NEW.path',
        );
        expectConfigError(
            {
                NEW: {
                    platform: 'ext_safari',
                    path: 'windows/',
                    configuration: {},
                    defines: {},
                },
            },
            'patch.NEW.path',
        );
        expectConfigError(
            {
                NEW: {
                    platform: 'ext_safari',
                    path: 'windows/../ios',
                    configuration: {},
                    defines: {},
                },
            },
            'patch.NEW.path',
        );
    });

    it('rejects an unsafe platform path', () => {
        expectConfigError(
            {
                NEW: {
                    platform: 'ext_safari',
                    path: '../out',
                    configuration: {},
                    defines: {},
                },
            },
            'patch.NEW.path',
        );
        expectConfigError(
            {
                NEW: {
                    platform: 'ext_safari',
                    path: '/abs',
                    configuration: {},
                    defines: {},
                },
            },
            'patch.NEW.path',
        );
        expectConfigError(
            {
                NEW: {
                    platform: 'ext_safari',
                    path: 'a\\b',
                    configuration: {},
                    defines: {},
                },
            },
            'patch.NEW.path',
        );
        expectConfigError(
            {
                NEW: {
                    platform: 'ext_safari',
                    path: 'C:/tmp/evil',
                    configuration: {},
                    defines: {},
                },
            },
            'patch.NEW.path',
        );
    });

    it('rejects a path Windows cannot represent', () => {
        ['mac.', 'mac ', 'a<b', 'con', 'con.txt'].forEach((badPath) => {
            expectConfigError(
                {
                    NEW: {
                        platform: 'ext_safari',
                        path: badPath,
                        configuration: {},
                        defines: {},
                    },
                },
                'patch.NEW.path',
            );
        });
    });

    it('rejects a legacy directory in another case', () => {
        expectConfigError(
            {
                NEW: {
                    platform: 'ext_safari',
                    path: 'x/MAC',
                    configuration: {},
                    defines: {},
                },
            },
            'patch.NEW.path',
        );
    });

    it('stores a normalized platform path', () => {
        const merged = mergePlatformsConfig(platformsConfig, {
            NEW: {
                platform: 'ext_safari',
                path: './new/dir',
                configuration: {},
                defines: {},
            },
        });

        expect(merged.NEW.path).toBe('new/dir');
    });

    it('rejects a path change for a legacy platform', () => {
        expectConfigError({ MAC: { path: 'mac_new' } }, 'patch.MAC.path');
        expectConfigError({ MAC_V2: { path: 'mac_v2_new' } }, 'patch.MAC_V2.path');
    });

    it('allows patching every legacy field except the path', () => {
        const merged = mergePlatformsConfig(platformsConfig, {
            MAC: {
                platform: 'windows',
                expires: '1 hour',
                configuration: {
                    removeRulePatterns: [],
                    ignoreRuleHints: true,
                },
                defines: { patched: true },
            },
        });

        expect(merged.MAC.platform).toBe('windows');
        expect(merged.MAC.expires).toBe('1 hour');
        expect(merged.MAC.configuration.removeRulePatterns).toEqual([]);
        expect(merged.MAC.configuration.ignoreRuleHints).toBe(true);
        expect(merged.MAC.defines.patched).toBe(true);
        expect(merged.MAC.path).toBe(platformsConfig.MAC.path);

        const mergedV2 = mergePlatformsConfig(platformsConfig, { MAC_V2: { platform: 'windows' } });

        expect(mergedV2.MAC_V2.platform).toBe('windows');
        expect(mergedV2.MAC_V2.path).toBe(platformsConfig.MAC_V2.path);
    });

    it('allows adding a legacy platform at its legacy directory', () => {
        const base: PlatformsConfig = {
            X: {
                platform: 'mac',
                path: 'x',
                configuration: {},
                defines: {},
            },
        };

        const merged = mergePlatformsConfig(base, {
            MAC: {
                platform: 'mac',
                path: 'mac',
                configuration: {},
                defines: {},
            },
            MAC_V2: {
                platform: 'mac',
                path: 'mac_v2',
                configuration: {},
                defines: {},
            },
        });

        expect(merged.MAC.path).toBe('mac');
        expect(merged.MAC_V2.path).toBe('mac_v2');
    });

    it('rejects adding a legacy platform at another directory', () => {
        const base: PlatformsConfig = {
            X: {
                platform: 'mac',
                path: 'x',
                configuration: {},
                defines: {},
            },
        };

        expect(() => mergePlatformsConfig(base, {
            MAC: {
                platform: 'mac',
                path: 'mymac',
                configuration: {},
                defines: {},
            },
        })).toThrow(/patch\.MAC\.path/);
    });

    it('rejects a platform path that ends with a legacy directory', () => {
        expectConfigError({
            NEW: {
                platform: 'ext_safari',
                path: 'extension/mac',
                configuration: {},
                defines: {},
            },
        }, 'patch.NEW.path');
        expectConfigError({ WINDOWS: { path: 'x/mac_v2' } }, 'patch.WINDOWS.path');
    });

    it('compares a legacy base path after normalization', () => {
        const base: PlatformsConfig = {
            MAC: {
                platform: 'mac',
                path: 'mac/',
                configuration: {},
                defines: {},
            },
        };

        expect(() => mergePlatformsConfig(base, {})).not.toThrow();
    });

    it('does not change the base or the patch', () => {
        const patch: PlatformsConfigPatch = {
            IOS: { expires: '1 hour' },
            WINDOWS: { configuration: { removeRulePatterns: ['^x'] } },
        };
        const baseBefore = JSON.stringify(platformsConfig);
        const patchBefore = JSON.stringify(patch);

        mergePlatformsConfig(platformsConfig, patch);

        expect(JSON.stringify(platformsConfig)).toBe(baseBefore);
        expect(JSON.stringify(patch)).toBe(patchBefore);
    });

    it('does not freeze the caller base', () => {
        const base: PlatformsConfig = {
            X: {
                platform: 'windows',
                path: 'x',
                configuration: {
                    removeRulePatterns: ['^x'],
                    replacements: [{ from: 'a', to: 'b' }],
                },
                defines: { adguard: true },
            },
        };

        const merged = mergePlatformsConfig(base, {});

        expect(Object.isFrozen(base.X)).toBe(false);
        expect(Object.isFrozen(base.X.configuration)).toBe(false);
        expect(Object.isFrozen(base.X.configuration.removeRulePatterns)).toBe(false);
        expect(Object.isFrozen(base.X.configuration.replacements)).toBe(false);
        expect(Object.isFrozen(base.X.defines)).toBe(false);
        expect(Object.isFrozen(merged.X)).toBe(true);
        expect(merged.X).not.toBe(base.X);
    });

    it('returns a frozen result', () => {
        const merged = mergePlatformsConfig(platformsConfig, {});

        expect(() => {
            // @ts-expect-error the merged config is readonly
            merged.WINDOWS.path = 'other';
        }).toThrow(TypeError);

        const patterns = merged.MAC.configuration.removeRulePatterns;
        expect(patterns).toBeDefined();
        expect(() => {
            // @ts-expect-error the merged arrays are readonly
            patterns?.push('^x');
        }).toThrow(TypeError);
    });

    it('accepts a full mirror patch', () => {
        expect(() => mergePlatformsConfig(platformsConfig, asPatch({ ...platformsConfig }))).not.toThrow();
    });

    it('does not write to Object.prototype for a patch named toString', () => {
        const merged = mergePlatformsConfig(platformsConfig, asPatch({
            toString: {
                platform: 'ext_ublock',
                path: 'new/ublock',
                configuration: {},
                defines: {},
            },
        }));

        expect(Object.hasOwn(merged, 'toString')).toBe(true);
        const descriptor = Object.getOwnPropertyDescriptor(merged, 'toString');
        expect(descriptor?.value).toMatchObject({ platform: 'ext_ublock', path: 'new/ublock' });
        expect(Object.prototype).not.toHaveProperty('toString.platform');
    });

    it('rejects a __proto__ base key from JSON', () => {
        const base = JSON.parse(
            '{"__proto__":{"platform":"ext_safari","path":"new/safari","configuration":{},"defines":{}}}',
        ) as PlatformsConfig;

        expect(() => mergePlatformsConfig(base, {})).toThrow(/base\.__proto__/);
        expect(Object.prototype).not.toHaveProperty('platform');
    });

    it('normalizes a base path', () => {
        const base: PlatformsConfig = {
            X: {
                platform: 'windows',
                path: './x/',
                configuration: {},
                defines: {},
            },
        };

        const merged = mergePlatformsConfig(base, {});

        expect(merged.X.path).toBe('x');
        expect(base.X.path).toBe('./x/');
    });

    it('normalizes base paths before the duplicate check', () => {
        const base: PlatformsConfig = {
            A: {
                platform: 'windows',
                path: './x/',
                configuration: {},
                defines: {},
            },
            B: {
                platform: 'windows',
                path: 'x',
                configuration: {},
                defines: {},
            },
        };

        expect(() => mergePlatformsConfig(base, {})).toThrow(/A\.path/);
    });

    it('rejects a __proto__ patch key from JSON', () => {
        const patch = JSON.parse(
            '{"__proto__":{"platform":"ext_safari","path":"new/safari","configuration":{},"defines":{}}}',
        );

        expectConfigError(patch, 'patch.__proto__');
        expect(Object.prototype).not.toHaveProperty('platform');
    });

    it('rejects a __proto__ defines key from JSON', () => {
        const patch = JSON.parse('{"WINDOWS":{"defines":{"__proto__":true}}}');

        expectConfigError(patch, 'patch.WINDOWS.defines.__proto__');
        expect(Object.prototype).not.toHaveProperty('adguard');
    });
});
