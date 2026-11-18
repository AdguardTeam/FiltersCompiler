import {
    describe,
    it,
    expect,
    beforeEach,
    vi,
} from 'vitest';

import { compile, PlatformsConfigError } from '../src/index';
import { build } from '../src/main/builder';
import { platformsConfig } from '../src/main/platforms-config';
import { logger } from '../src/main/utils/log';

vi.mock('../src/main/utils/log');
vi.mock('../src/main/builder', () => ({
    build: vi.fn().mockResolvedValue(undefined),
}));

describe('compile platforms config patch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('throws synchronously for an invalid patch', () => {
        expect(() => compile(
            '/nonexistent',
            undefined,
            undefined,
            null,
            [],
            [],
            { BAD: {} },
        )).toThrow(PlatformsConfigError);
    });

    it('passes the merged configuration to the build', async () => {
        await compile(
            '.',
            undefined,
            undefined,
            null,
            [],
            [],
            { EXTENSION_SAFARI: { configuration: { removeRulePatterns: ['^zzz-'] } } },
        );

        expect(build).toHaveBeenCalledTimes(1);
        const passed = vi.mocked(build).mock.calls[0][4];
        expect(passed.EXTENSION_SAFARI.configuration.removeRulePatterns).toEqual(['^zzz-']);
        expect(passed.IOS.configuration.removeRulePatterns).toEqual(
            platformsConfig.IOS.configuration.removeRulePatterns,
        );
    });

    it('ignores an undefined patch entry instead of crashing', async () => {
        await compile('.', undefined, undefined, null, [], [], {
            IOS: undefined,
            NEW_PLATFORM: undefined,
        });

        const passed = vi.mocked(build).mock.calls[0][4];

        expect(build).toHaveBeenCalledTimes(1);
        expect(passed.IOS).toEqual(platformsConfig.IOS);
        expect(passed).not.toHaveProperty('NEW_PLATFORM');
        expect(vi.mocked(logger.info).mock.calls.map(([message]) => message)).toEqual([
            'Using platforms configuration patch',
        ]);
    });

    it('logs whether a platform is patched or added', async () => {
        await compile('.', undefined, undefined, null, [], [], {
            IOS: { expires: '1 hour' },
            NEW_PLATFORM: {
                platform: 'ext_ublock',
                path: 'new/ublock',
                configuration: {},
                defines: {},
            },
        });

        expect(logger.info).toHaveBeenCalledWith('Using platforms configuration patch');
        expect(logger.info).toHaveBeenCalledWith('Patching platform IOS');
        expect(logger.info).toHaveBeenCalledWith('Adding platform NEW_PLATFORM (ext_ublock)');
    });

    it('passes a legacy platform patch to the build', async () => {
        await compile('.', undefined, undefined, null, [], [], {
            MAC: {
                expires: '1 hour',
                configuration: { ignoreRuleHints: true },
            },
        });

        const passed = vi.mocked(build).mock.calls[0][4];

        expect(passed.MAC.expires).toBe('1 hour');
        expect(passed.MAC.configuration.ignoreRuleHints).toBe(true);
        expect(passed.MAC.path).toBe(platformsConfig.MAC.path);
    });
});
