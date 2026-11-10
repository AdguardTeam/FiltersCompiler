import { describe, it, expect } from 'vitest';

import { platformsConfig } from '../src/main/platforms-config.js';

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
    describe('apps_corelibs', () => {
        it.each(CORELIBS_PLATFORMS)(
            'defines for %s, which support CoreLibs',
            (name) => {
                expect(platformsConfig[name].defines.apps_corelibs).toBe(true);
            },
        );

        it.each(Object.keys(platformsConfig).filter((name) => !CORELIBS_PLATFORMS.includes(name)))(
            'does not define for %s, which do not support CoreLibs',
            (name) => {
                expect(platformsConfig[name].defines.apps_corelibs).toBeUndefined();
            },
        );
    });
});
