const filter = require('../main/platforms/filter.js');

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
            'some.affinity.ru#@#.ad-zone',
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
        expect(after.indexOf('some.affinity.ru#@#.ad-zone')).toBeGreaterThanOrEqual(0);
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
                ],
                'ignoreRuleHints': false,
            },
        };

        const before = [
            '! Comment',
            'example.com',
            'example.com$stealth',
            'javarchive.com##.sidebar_list > .widget_text:has(a[title = "ads"])',
            "aranzulla.it##body > div[id][class][-ext-has=\"a[href^='/locked-no-script.php']\"]",
        ];

        const after = filter.cleanupRules(before, config, 0);

        expect(after).toBeDefined();
        expect(after).toHaveLength(2);

        expect(after.indexOf('! Comment')).toBeGreaterThanOrEqual(0);
        expect(after.indexOf('example.com')).toBeGreaterThanOrEqual(0);
    });

    it('Test NOT_OPTIMIZE hints for multiple rules', () => {
        const rules = [
            '||test.com^$script,third-party',
            '!+ NOT_OPTIMIZED PLATFORM(android)',
            '||spublicidad.net^',
            '||swi-adserver.com^$third-party',
            '!+ NOT_OPTIMIZED',
            '||templates.buscape.com^$third-party',
            'example.org#@##antiadblock',
            '!+ NOT_OPTIMIZED_START',
            '||tiozao.net^$third-party',
            '!+ NOT_PLATFORM(ext_ff)',
            '||todoanimes.com^$script,third-party',
            '||tracking.fsjmp.com^$third-party',
            '!+ NOT_OPTIMIZED_END',
            '||tutonovip.com^$third-party',
            'daemon-hentai.com#@#.publicite',
            '!+ NOT_OPTIMIZED_START PLATFORM(ext_chrome)',
            'daemon-hentai.com#%#//scriptlet("abort-on-property-read", "gothamBatAdblock")',
            '! https://github.com/AdguardTeam/AdguardFilters/issues/101140',
            'elespanol.com##.container > .homeNormalNoMobile',
            '!+ NOT_OPTIMIZED_END',
            'hentai.com##.public',
            '!+ PLATFORM(mac)',
            'rapifutbol.com##div[style="width:300px;"]',
        ];

        const expected = [
            '||test.com^$script,third-party',
            '!+ NOT_OPTIMIZED PLATFORM(android)',
            '||spublicidad.net^',
            '||swi-adserver.com^$third-party',
            '!+ NOT_OPTIMIZED',
            '||templates.buscape.com^$third-party',
            'example.org#@##antiadblock',
            '!+ NOT_OPTIMIZED',
            '||tiozao.net^$third-party',
            '!+ NOT_PLATFORM(ext_ff) NOT_OPTIMIZED',
            '||todoanimes.com^$script,third-party',
            '!+ NOT_OPTIMIZED',
            '||tracking.fsjmp.com^$third-party',
            '||tutonovip.com^$third-party',
            'daemon-hentai.com#@#.publicite',
            '!+ PLATFORM(ext_chrome) NOT_OPTIMIZED',
            'daemon-hentai.com#%#//scriptlet("abort-on-property-read", "gothamBatAdblock")',
            '!+ NOT_OPTIMIZED',
            '! https://github.com/AdguardTeam/AdguardFilters/issues/101140',
            '!+ NOT_OPTIMIZED',
            'elespanol.com##.container > .homeNormalNoMobile',
            'hentai.com##.public',
            '!+ PLATFORM(mac)',
            'rapifutbol.com##div[style="width:300px;"]',
        ];

        const result = filter.resolveMultipleNotOptimizedHints(rules, 10);

        expect(result).toBeDefined();
        expect(result).toHaveLength(24);
        expect(result).toEqual(expected);
    });

    it('Test bad usage of NOT_OPTIMIZE hints for multiple rules', () => {
        let rules = [
            'example.org#@##antiadblock',
            '!+ NOT_OPTIMIZED_START',
            '||tiozao.net^$third-party',
            '||tracking.fsjmp.com^$third-party',
            '!+ NOT_OPTIMIZED_END',
            '||tutonovip.com^$third-party',
            '!+ NOT_OPTIMIZED_START',
            'daemon-hentai.com#%#//scriptlet("abort-on-property-read", "gothamBatAdblock")',
        ];

        expect(() => filter.resolveMultipleNotOptimizedHints(rules, 10))
            .toThrow('Error validating NOT_OPTIMIZED multiple hints in filter 10');

        rules = [
            'example.org#@##antiadblock',
            '!+ NOT_OPTIMIZED_START',
            '||tiozao.net^$third-party',
            '!+ NOT_OPTIMIZED_START',
            '||tracking.fsjmp.com^$third-party',
            '!+ NOT_OPTIMIZED_END',
            '||tutonovip.com^$third-party',
            '!+ NOT_OPTIMIZED_END',
        ];

        expect(() => filter.resolveMultipleNotOptimizedHints(rules, 10))
            .toThrow('Error validating NOT_OPTIMIZED multiple hints in filter 10');

        rules = [
            'example.org#@##antiadblock',
            '!+ NOT_OPTIMIZED_END',
            '||tiozao.net^$third-party',
            '!+ NOT_OPTIMIZED_START',
            '||tracking.fsjmp.com^$third-party',
        ];

        expect(() => filter.resolveMultipleNotOptimizedHints(rules, 10))
            .toThrow('Error validating NOT_OPTIMIZED multiple hints in filter 10');
    });
});
