import {
    describe,
    it,
    expect,
    vi,
} from 'vitest';

import { cleanupAndOptimizeRules, cleanupRules } from '../src/main/platforms/filter';
import { platformsConfig } from '../src/main/platforms-config';

// Mock log to hide error messages
vi.mock('../src/main/utils/log');

describe('platforms filter', () => {
    it('Test hints', () => {
        const config = {
            'platform': 'test',
            'path': 'hints',
            'configuration': {
                'removeRulePatterns': false,
                'ignoreRuleHints': false,
            },
        };

        const before = [
            '! Comment',
            'example.com',
            '!+ PLATFORM(test, windows)',
            'included_platform',
            '!+ NOT_PLATFORM( windows, test )',
            'excluded_platform',
            '!+ PLATFORM(test) NOT_PLATFORM(windows)',
            'included_platform_2',
            '!+ NOT_OPTIMIZED',
            'not_optimized',
            '!+ INVALID_HINT',
            'invalid_hint',
        ];

        const after = cleanupRules(before, config, 0);

        expect(after).toBeDefined();
        expect(after).toHaveLength(10);

        expect(after.indexOf('example.com')).toBeGreaterThanOrEqual(0);
        expect(after.indexOf('included_platform')).toBeGreaterThanOrEqual(0);
        expect(after.indexOf('excluded_platform')).toBeLessThan(0);
        expect(after.indexOf('included_platform_2')).toBeGreaterThanOrEqual(0);
        expect(after.indexOf('not_optimized')).toBeGreaterThanOrEqual(0);
        expect(after.indexOf('invalid_hint')).toBeGreaterThanOrEqual(0);
    });

    it('Test whether corelibs hint alias items match the adguard_corelibs directive', () => {
        const rules = [
            '!+ PLATFORM(corelibs)',
            'corelibs only',
            '!+ NOT_PLATFORM(corelibs)',
            'not corelibs',
        ];
        const clean = (platform) => cleanupRules(rules, {
            platform,
            path: platform,
            configuration: { removeRulePatterns: false, ignoreRuleHints: false },
        }, 0);

        const configs = Object.values(platformsConfig);
        const corelibsPlatforms = [...new Set(
            configs.filter((config) => config.defines.adguard_corelibs).map((config) => config.platform),
        )];
        const nonCorelibsPlatforms = configs.map((config) => config.platform)
            .filter((platform) => !corelibsPlatforms.includes(platform));

        expect(corelibsPlatforms.toSorted()).toEqual(['android', 'cli', 'mac', 'windows']);

        corelibsPlatforms.forEach((platform) => {
            expect(clean(platform)).toEqual(['!+ PLATFORM(corelibs)', 'corelibs only']);
        });
        nonCorelibsPlatforms.forEach((platform) => {
            expect(clean(platform)).toEqual(['!+ NOT_PLATFORM(corelibs)', 'not corelibs']);
        });
    });

    it('Test multiple NOT_PLATFORM clauses with different orderings', () => {
        const rule = 'rule';
        const clean = (hint, platform) => cleanupRules([hint, rule], {
            platform,
            path: platform,
            configuration: { removeRulePatterns: false, ignoreRuleHints: false },
        }, 0);

        const ordered = '!+ NOT_PLATFORM(windows) NOT_PLATFORM(android)';
        const reversed = '!+ NOT_PLATFORM(android) NOT_PLATFORM(windows)';

        [ordered, reversed].forEach((hint) => {
            expect(clean(hint, 'windows')).toEqual([]);
            expect(clean(hint, 'android')).toEqual([]);
            expect(clean(hint, 'mac')).toEqual([hint, rule]);
        });

        const aliased = '!+ NOT_PLATFORM(corelibs) NOT_PLATFORM(ios)';

        expect(clean(aliased, 'windows')).toEqual([]);
        expect(clean(aliased, 'ios')).toEqual([]);
        expect(clean(aliased, 'ext_ff')).toEqual([aliased, rule]);
    });

    it('Test tab-separated hint clauses', () => {
        const rule = 'rule';
        const clean = (hint, platform) => cleanupRules([hint, rule], {
            platform,
            path: platform,
            configuration: { removeRulePatterns: false, ignoreRuleHints: false },
        }, 0);

        const notPlatformHint = '!+ NOT_PLATFORM(windows)\tNOT_PLATFORM(android)';

        expect(clean(notPlatformHint, 'windows')).toEqual([]);
        expect(clean(notPlatformHint, 'android')).toEqual([]);
        expect(clean(notPlatformHint, 'mac')).toEqual([notPlatformHint, rule]);

        const platformHint = '!+ PLATFORM(windows)\tPLATFORM(android)';

        expect(clean(platformHint, 'windows')).toEqual([platformHint, rule]);
        expect(clean(platformHint, 'android')).toEqual([platformHint, rule]);
        expect(clean(platformHint, 'mac')).toEqual([]);
    });

    it('Test Object.prototype names in platform hints are handled safely', () => {
        const rule = 'rule';
        const clean = (hint) => cleanupRules([hint, rule], {
            platform: 'test',
            path: 'test',
            configuration: { removeRulePatterns: false, ignoreRuleHints: false },
        }, 0);

        ['constructor', 'toString', '__proto__'].forEach((name) => {
            expect(() => clean(`!+ PLATFORM(${name})`)).not.toThrow();
            expect(() => clean(`!+ NOT_PLATFORM(${name})`)).not.toThrow();
            expect(clean(`!+ PLATFORM(${name})`)).toEqual([]);
            expect(clean(`!+ NOT_PLATFORM(${name})`)).toEqual([`!+ NOT_PLATFORM(${name})`, rule]);
        });
    });

    it('Test optimization hints', () => {
        const config = {
            'platform': 'test',
            'path': 'hints',
            'configuration': {
                'removeRulePatterns': false,
                'ignoreRuleHints': false,
            },
        };

        const optimizationConfig = {
            'groups': [
                {
                    'config': {
                        'type': 'WHITELIST',
                        'scope': 'DOMAIN',
                        'hits': 1,
                    },
                    'rules': {
                        'optimized.com': 0,
                        'other.com': 4,
                        'not_optimized': 1,
                    },
                },
                {
                    'config': {
                        'type': 'ELEMHIDE',
                        'scope': 'DOMAIN',
                        'hits': 70,
                    },
                    'rules': {
                        '###optimized': 0,
                        '###rule2': 4,
                        '###rule3': 1,
                    },
                },
            ],
            'percent': 10,
            'minPercent': 5,
            'maxPercent': 71,
        };

        // TODO: Check optimization percent

        const before = [
            '! Comment',
            'example.com',
            'optimized.com',
            '###optimized',
            '!+ NOT_OPTIMIZED',
            'not_optimized',
            '!#safari_cb_affinity(general)',
            'some.affinity.com#@#.ad-zone',
            '!',
            '!#safari_cb_affinity',
        ];

        const after = cleanupAndOptimizeRules(before, config, optimizationConfig, 0);

        expect(after).toBeDefined();
        expect(after).toHaveLength(6);

        expect(after.indexOf('! Comment')).toBeLessThan(0);
        expect(after.indexOf('example.com')).toBeGreaterThanOrEqual(0);
        expect(after.indexOf('optimized.com')).toBeLessThan(0);
        expect(after.indexOf('###optimized')).toBeLessThan(0);
        expect(after.indexOf('not_optimized')).toBeGreaterThanOrEqual(0);
        expect(after.indexOf('!#safari_cb_affinity(general)')).toBeGreaterThanOrEqual(0);
        expect(after.indexOf('some.affinity.com#@#.ad-zone')).toBeGreaterThanOrEqual(0);
        expect(after.indexOf('!#safari_cb_affinity')).toBeGreaterThanOrEqual(0);
    });

    it('Test remove rule patterns', () => {
        const config = {
            'platform': 'test',
            'path': 'hints',
            'configuration': {
                'removeRulePatterns': [
                    '\\[-ext-',
                    ':has\\(',
                    ':matches-property\\(',
                    '\\$stealth',
                    '\\$content',
                    ',content(,|$)',
                    // regexp domain modifier values
                    '\\$domain=\/',
                    ',$domain=\/',
                    '\\$(.*,)?hls=',
                    '\\$(.*,)?jsonprune=',
                    '\\$(.*,)?referrerpolicy=',
                    // https://github.com/AdguardTeam/FiltersRegistry/issues/731
                    '^((?!#%#).)*\\$\\$|\\$\\@\\$"',
                    '\\$removeparam',
                    ',removeparam',
                    '\\$removeheader',
                    ',removeheader',
                    '\\$all',
                ],
                'ignoreRuleHints': false,
            },
        };

        const notMatchRules = [
            '! Comment',
            'example.com',
            'example.com,content-examples.com###ad3',
            '||example.org^$domain=example.com',
            '@@||example.org^$domain=example.com,elemhide',
            'apkpure.com#%#//scriptlet("set-constant", "$$.analytics.send", "noopFunc")',
        ];
        const matchRules = [
            '@@||example.com$stealth',
            'javarchive.com##.sidebar_list > .widget_text:has(a[title = "ads"])',
            "aranzulla.it##body > div[id][class][-ext-has=\"a[href^='/locked-no-script.php']\"]",
            'example.org#?#div:matches-property(/__reactFiber/.return.return.memoizedProps.ad)',
            '@@||example.net^$content',
            '@@||example.com^$content,elemhide,jsinject',
            '@@||example.com^$elemhide,content,jsinject',
            '||video.twimg.com/ext_tw_video/*/*.m3u8$domain=/^i[a-z]*\.strmrdr[a-z]+\..*/',
            '@@||video.twimg.com/ext_tw_video/*/*.m3u8$domain=/^i[a-z]*\.strmrdr[a-z]+\..*/',
            '||dai.google.com/ondemand/hls/content/*.m3u8$hls=/redirector\.googlevideo\.com\/,domain=sbs.com.au',
            '||pluto.tv/*/session.json$jsonprune=\$..[adBreak\, adBreaks]',
            '||example.com^$referrerpolicy=origin',
            '||example.org^$xmlhttprequest,removeparam=param',
            '@@||example.org^$all',
            '||example.org^$xmlhttprequest,removeheader=location',
        ];

        const before = [
            ...notMatchRules,
            ...matchRules,
        ];

        const after = cleanupRules(before, config, 0);

        expect(after).toBeDefined();
        expect(after).toEqual(notMatchRules);
    });

    it('Test remove urltransform modifier patterns', () => {
        const config = {
            'platform': 'test',
            'path': 'hints',
            'configuration': {
                'removeRulePatterns': [
                    '\\$(?!#|(path|domain)=.*]|.*removeparam=).*urltransform(,|=|$)',
                ],
                'ignoreRuleHints': false,
            },
        };

        const notMatchRules = [
            '! Comment',
            'example.com',
            'example.com,content-examples.com###ad3',
            'example.com##.sidebar_list > .widget_text:has(a[title = "urltransform"])',
            '@@||example.com^$elemhide,content,jsinject',
            '||example.com/link/urltransform/path^',
            '||example.com^$domain=example.com',
            // `$removeparam=urltransform` should not be treated as `$urltransform`
            '||example.com^$removeparam=urltransform',
        ];
        const matchRules = [
            '||example.com^$urltransform=/firstpath/secondpath/',
            '@@||example.com^$urltransform=/firstpath/secondpath/',
            '||example.com^$third-party,urltransform=/firstpath/secondpath/',
        ];

        const before = [
            ...notMatchRules,
            ...matchRules,
        ];

        const after = cleanupRules(before, config, 0);

        expect(after).toBeDefined();
        expect(after).toEqual(notMatchRules);
    });

    it('Test remove generic CSS rule patterns', () => {
        const config = {
            'platform': 'test',
            'path': 'hints',
            'configuration': {
                'removeRulePatterns': [
                    '^#\\$#',
                ],
                'ignoreRuleHints': false,
            },
        };

        const notMatchRules = [
            'example.com',
            'example.com###ad3',
            '||example.org^$domain=example.com',
            '@@||example.org^$domain=example.com,elemhide',
            'apkpure.com#%#//scriptlet("set-constant", "$$.analytics.send", "noopFunc")',
            'example.com#$#.advert { display: none !important; }',
            'example.com#$#.cookie { position: absolute !important; left: -9999px !important; }',
        ];
        const matchRules = [
            '#$#div[class="adsbygoogle"][id="ad-detector"] { display: block !important; }',
            '#$#.adsbygoogle[style] { position: absolute !important; left: -9999px !important; }',
            '#$#.pub_728x90.text-ad.textAd.text_ad.text_ads.text-ads.text-ad-links { display: block !important; }',
        ];

        const before = [
            ...notMatchRules,
            ...matchRules,
        ];

        const after = cleanupRules(before, config, 0);

        expect(after).toBeDefined();
        expect(after).toEqual(notMatchRules);
    });

    it('Test remove CSS rule patterns', () => {
        const config = {
            'platform': 'test',
            'path': 'hints',
            'configuration': {
                'removeRulePatterns': [
                    '#\\$#',
                    '#@\\$#',
                ],
                'ignoreRuleHints': false,
            },
        };

        const notMatchRules = [
            'example.com',
            'example.com###ad3',
            '||example.org^$domain=example.com',
            '@@||example.org^$domain=example.com,elemhide',
            'apkpure.com#%#//scriptlet("set-constant", "$$.analytics.send", "noopFunc")',
        ];
        const matchRules = [
            'example.com#@$#.ads { display: none !important; }',
            'example.com#$#.advert { display: none !important; }',
            'example.com#$#.cookie { position: absolute !important; left: -9999px !important; }',
            '#$#div[class="adsbygoogle"][id="ad-detector"] { display: block !important; }',
            '#$#.adsbygoogle[style] { position: absolute !important; left: -9999px !important; }',
            '#$#.pub_728x90.text-ad.textAd.text_ad.text_ads.text-ads.text-ad-links { display: block !important; }',
        ];

        const before = [
            ...notMatchRules,
            ...matchRules,
        ];

        const after = cleanupRules(before, config, 0);

        expect(after).toBeDefined();
        expect(after).toEqual(notMatchRules);
    });

    it('Test removing `redirect-rule=` modifier', () => {
        const config = {
            'platform': 'test',
            'path': 'hints',
            'configuration': {
                'removeRulePatterns': [
                    '\\$redirect-rule=',
                    ',redirect-rule=',
                ],
                'ignoreRuleHints': false,
            },
        };

        const notMatchRules = [
            '! Comment',
            'example.com',
            'example.com,content-examples.com###ad3',
            '@@||example.com^$elemhide,content,jsinject',
            '@@||example.com^$elemhide,jsinject,content',
            '@@||content.com$stealth',
            'example.com##.sidebar_list > .widget_text:has(a[title = "content"])',
            '||dai.google.com/ondemand/hls/content/*.m3u8$hls=/redirector\.googlevideo\.com\/,domain=sbs.com.au',
        ];
        const matchRules = [
            '||example.com/script.json$xmlhttprequest,redirect-rule=noopjson',
            '||example.com/script.js$script,redirect-rule=noopjs',
            '*$redirect-rule=noopjs,xmlhttprequest,domain=example.com',
        ];

        const before = [
            ...notMatchRules,
            ...matchRules,
        ];

        const after = cleanupRules(before, config, 0);

        expect(after).toBeDefined();
        expect(after).toEqual(notMatchRules);
    });

    it('Test removing of single content modifier', () => {
        const config = {
            'platform': 'test',
            'path': 'hints',
            'configuration': {
                'removeRulePatterns': [
                    '\\$content$',
                ],
                'ignoreRuleHints': false,
            },
        };

        const notMatchRules = [
            '! Comment',
            'example.com',
            'example.com,content-examples.com###ad3',
            '@@||example.com^$content,elemhide,jsinject',
            '@@||example.com^$elemhide,content,jsinject',
            '@@||example.com^$elemhide,jsinject,content',
            '@@||content.com$stealth',
            'example.com##.sidebar_list > .widget_text:has(a[title = "content"])',
            '||dai.google.com/ondemand/hls/content/*.m3u8$hls=/redirector\.googlevideo\.com\/,domain=sbs.com.au',
        ];
        const matchRules = [
            '@@||example.com^$content',
        ];

        const before = [
            ...notMatchRules,
            ...matchRules,
        ];

        const after = cleanupRules(before, config, 0);

        expect(after).toBeDefined();
        expect(after).toEqual(notMatchRules);
    });

    it('Allowlist basic rules with important for ubo', () => {
        const config = {
            'platform': 'test',
            'path': 'hints',
            'configuration': {
                'removeRulePatterns': [
                    '@@.*?(\\$|,)important',
                ],
                'ignoreRuleHints': false,
            },
        };

        const notMatchRules = [
            '! Comment',
            'example.com',
            '@@||important.com^$document',
            'example.com###.ad,.important',
            '||example.com^$important',
        ];
        const matchRules = [
            '@@||example.com^$important',
            '@@example.com^$script,important',
            '@@||example.com^$important',
            '@@||example.com^$css,important',
        ];

        const before = [
            ...notMatchRules,
            ...matchRules,
        ];

        const after = cleanupRules(before, config, 0);

        expect(after).toBeDefined();
        expect(after).toEqual(notMatchRules);
    });
});
