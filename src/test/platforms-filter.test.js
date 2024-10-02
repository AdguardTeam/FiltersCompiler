const filter = require('../main/platforms/filter');

// Mock log to hide error messages
jest.mock('../main/utils/log');

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

        const after = filter.cleanupRules(before, config, 0);

        expect(after).toBeDefined();
        expect(after).toHaveLength(10);

        expect(after.indexOf('example.com')).toBeGreaterThanOrEqual(0);
        expect(after.indexOf('included_platform')).toBeGreaterThanOrEqual(0);
        expect(after.indexOf('excluded_platform')).toBeLessThan(0);
        expect(after.indexOf('included_platform_2')).toBeGreaterThanOrEqual(0);
        expect(after.indexOf('not_optimized')).toBeGreaterThanOrEqual(0);
        expect(after.indexOf('invalid_hint')).toBeGreaterThanOrEqual(0);
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

        const after = filter.cleanupAndOptimizeRules(before, config, optimizationConfig, 0);

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

        const after = filter.cleanupRules(before, config, 0);

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

        const after = filter.cleanupRules(before, config, 0);

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

        const after = filter.cleanupRules(before, config, 0);

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

        const after = filter.cleanupRules(before, config, 0);

        expect(after).toBeDefined();
        expect(after).toEqual(notMatchRules);
    });
});
