import { describe, it, expect } from 'vitest';

import { platformsConfig } from '../src/main/platforms-config.js';

describe('production platformsConfig defines', () => {
    describe('cap_html_filtering', () => {
        it.each(['WINDOWS', 'MAC_V2', 'MAC_V3', 'ANDROID', 'CLI'])(
            'defines for %s, which support HTML filtering rules',
            (name) => {
                expect(platformsConfig[name].defines.cap_html_filtering).toBe(true);
            },
        );

        it.each(['MAC', 'IOS', 'EXTENSION_CHROMIUM', 'EXTENSION_FIREFOX', 'EXTENSION_SAFARI'])(
            'does not define for %s, which do not support HTML filtering rules',
            (name) => {
                expect(platformsConfig[name].defines.cap_html_filtering).toBeUndefined();
            },
        );
    });
});
