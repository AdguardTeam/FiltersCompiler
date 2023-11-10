/* eslint-disable max-len */
const path = require('path');
const fs = require('fs').promises;
const { existsSync } = require('fs');

const optimization = require('../main/optimization');
const builder = require('../main/builder');

// Mock log to hide error messages
jest.mock('../main/utils/log');

const readFile = (path) => {
    try {
        return fs.readFile(path, { encoding: 'utf-8' });
    } catch (e) {
        return null;
    }
};

const filtersDir = path.join(__dirname, './resources/filters');
const badFiltersDir = path.join(__dirname, './resources/bad-filters/');
const logFile = path.join(__dirname, './resources/log.txt');
const reportFile = path.join(__dirname, './resources/report.txt');
const platformsDir = path.join(__dirname, './resources/platforms');
const platformsConfigFile = path.join(__dirname, './resources/platforms.json');

const getPlatformsConfig = async () => {
    const platformsConfig = await readFile(platformsConfigFile);
    return JSON.parse(platformsConfig);
};

optimization.disableOptimization();

describe('Test builder', () => {
    beforeAll(async () => {
        expect(builder).toBeTruthy();
        const platformsConfig = await getPlatformsConfig();
        await builder.build(filtersDir, logFile, reportFile, platformsDir, platformsConfig);
    });

    describe('Works', () => {
        it('revision', async () => {
            const revisionContent = await readFile(path.join(filtersDir, 'filter_3_Test', 'revision.json'));
            expect(revisionContent).toBeTruthy();

            const revision = JSON.parse(revisionContent);
            expect(revision.version).toBeTruthy();
            expect(revision.timeUpdated).toBeTruthy();
        });

        describe('Testing addModifiers function', () => {
            it('Should filter "platforms/mac" with "10.txt"', async () => {
                // Read the content of the file and split it into lines
                const filterContent = await readFile(path.join(platformsDir, 'mac', 'filters', '10.txt'));
                const filterLines = filterContent.split(/\r?\n/);
                expect(filterLines.length).toEqual(14);
                // Ensure that the file is not empty
                expect(filterContent).toBeTruthy();
                const filterRules = filterLines.filter((line) => line.length > 0 && !line.startsWith('!'));
                // Check that each line ends with '$image'
                filterRules.forEach((line) => {
                    expect(line.endsWith('$image')).toBeTruthy();
                    expect(line).not.toBe(null);
                });
            });

            it('Should filter "platforms/ios" with "10.txt"', async () => {
                const filterContent = await readFile(path.join(platformsDir, 'ios', 'filters', '10.txt'));
                const filterLines = filterContent.split(/\r?\n/);
                expect(filterLines.length).toEqual(26);
                // Ensure that the file is not empty
                expect(filterContent).toBeTruthy();
                // Filter rules without comments
                const filterRules = filterLines.filter((line) => line.length > 0 && !line.startsWith('!'));
                // Ensure that each line ends with '$image,script'
                filterRules.forEach((line) => {
                    expect(line.endsWith('$image,script')).toBeTruthy();
                    expect(line).not.toBe(null);
                });
                // Check that the number of hints is equal to the number of rules
                const filterHints = filterLines.filter((line) => line === '!+ NOT_OPTIMIZED');
                expect(filterRules.length).toEqual(filterHints.length);
            });

            it('Should filter "platforms/edge" with "10.txt"', async () => {
                const filterContent = await readFile(path.join(platformsDir, 'edge', 'filters', '10.txt'));
                const filterLines = filterContent.split(/\r?\n/);
                expect(filterLines.length).toEqual(19);
                // Ensure that the file is not empty
                expect(filterContent).toBeTruthy();
                const filterRules = filterLines.filter((line) => line.length > 0 && !line.startsWith('!'));
                // Ensure that each line ends with '$redirect=nooptext,important'
                filterRules.forEach((line) => {
                    expect(line.endsWith('$redirect=nooptext,important')).toBeTruthy();
                    expect(line).not.toBe(null);
                });
                // Check that the number of hints is equal to the number of rules
                const filterHints = filterLines.filter((line) => line === '!+ NOT_OPTIMIZED');
                expect(filterRules.length).toEqual(filterHints.length);
            });
        });

        it('filter 3 test', async () => {
            const filterContent = (await readFile(path.join(filtersDir, 'filter_3_Test', 'filter.txt'))).trim();
            expect(filterContent).toBeTruthy();

            const filterLines = filterContent.split(/\r?\n/);
            expect(filterLines.length).toEqual(23);

            // Common include
            expect(filterLines.includes('! some common rules could be places here')).toBeTruthy();
            expect(filterLines.includes('test-common-rule.com')).toBeTruthy();
            expect(filterLines.includes('test-common-rule.com$xmlhttprequest')).toBeTruthy();
            expect(filterLines.includes('example.com#$#h1 { background-color: blue !important }')).toBeTruthy();

            // Check replace version comment
            expect(filterLines.includes('! Version: 11.9090.19.19')).toBeFalsy();
            expect(filterLines.includes('! OriginalVersion: 11.9090.19.19')).toBeTruthy();

            // Common_1 include
            expect(filterLines.includes('test-common-1-rule.com')).toBeTruthy();

            // Exclude_1
            expect(filterLines.includes('test-common-1-rule.com$xmlhttprequest')).toBeFalsy();

            // Strip comments
            expect(filterLines.includes('! some common rules could be places here, but comment are stripped')).toBeFalsy();

            // Exclude
            expect(filterLines.includes('||test.com^')).toBeTruthy();
            expect(filterLines.includes('#%#test.com^$third-party')).toBeFalsy();
            expect(filterLines.includes('||test.com^$third-party')).toBeFalsy();
            expect(filterLines.includes('||test.com^$replace=')).toBeFalsy();
            expect(filterLines.includes('regularexpressionexcluded')).toBeFalsy();
            expect(filterLines.includes('regularexpression_not_excluded')).toBeTruthy();
        });

        it('platforms/test filters 5.txt', async () => {
            const filterContent = await readFile(path.join(__dirname, 'resources/platforms/test', 'filters', '5.txt'));
            const filterLines = filterContent.split(/\r?\n/);
            expect(filterLines.length).toEqual(54);

            const presentRules = [
                '||adsnet.com/*/700x350.gif$domain=example.com',
                'example.com##+js(set-constant, ads, false)',
                'test.com##+js(abort-on-property-read, adsShown)',
                'example.com##+js(disable-newtab-links)',
                'test.com#@#+js(abort-on-property-read, some.prop)',
                '||www.ynet.co.il^$important,websocket,~third-party,domain=www.ynet.co.il',
                'example.com$$script[tag-content="12313"][max-length="262144"]',
                '||adsnet.com/*/700x350.gif$domain=example.com',
                '||example.com/banner$image,redirect=3x2.png',
                '||test.com^$script,redirect=noop.js',
                '||example.com/*.mp4$media,redirect=noop-1s.mp4',
                '||example.com^$script,redirect-rule=noop.js',
            ];
            presentRules.forEach((rule) => {
                expect(filterLines.includes(rule)).toBeTruthy();
            });

            const absentRules = [
                'rybnik.com.pl##^iframe[name]:not([class]):not([id]):not([src])[style="display:none"]',
                'test.com#%#AG_setConstant("ads", "false");',
                'test.com#@%#Object.defineProperty(window, \'abcde\', { get: function() { return []; } });',
                '||example.com/api/v1/ad/*/json$replace=/html/abcd\\,/i',
                'example.com#%#//scriptlet(\'trusted-set-local-storage-item\', \'iName\', \'iValue\')',
                'example.com#%#//scriptlet("trusted-set-cookie", "cName", "cValue")',
            ];
            absentRules.forEach((rule) => {
                expect(filterLines.includes(rule)).toBeFalsy();
            });
        });

        it('platforms/test2 filters 5.txt', async () => {
            const filterContent = await readFile(path.join(__dirname, 'resources/platforms/test2', 'filters', '5.txt'));
            const filterLines = filterContent.split(/\r?\n/);
            expect(filterLines.length).toEqual(54);

            const presentRules = [
                'test.com#%#//scriptlet(\'abp-abort-on-property-read\', \'adsShown\')',
                'example.com#@%#//scriptlet(\'abp-abort-on-property-write\', \'adblock.check\')',
                'test.com#@%#//scriptlet(\'ubo-abort-on-property-read.js\', \'some.prop\')',
                'example.com#%#//scriptlet(\'ubo-disable-newtab-links.js\')',
                'example.com#%#//scriptlet(\'ubo-set-constant.js\', \'ads\', \'false\')',
                'example.com$$script[tag-content="12313"][max-length="262144"]',
                '||www.ynet.co.il^$important,websocket,~third-party,domain=www.ynet.co.il',
                '||example.com/banner$image,redirect=3x2-transparent.png',
                '||test.com^$script,redirect=noopjs',
                '||example.com/*.mp4$media,redirect=noopmp4-1s',
                '||example.com^$script,redirect-rule=noopjs',
            ];
            presentRules.forEach((rule) => {
                expect(filterLines.includes(rule)).toBeTruthy();
            });

            const absentRules = [
                'example.com#%#//scriptlet(\'trusted-set-local-storage-item\', \'iName\', \'iValue\')',
                'example.com#%#//scriptlet("trusted-set-cookie", "cName", "cValue")',
            ];
            absentRules.forEach((rule) => {
                expect(filterLines.includes(rule)).toBeFalsy();
            });
        });

        it('platforms/ios filters 5.txt', async () => {
            const filterContent = await readFile(path.join(__dirname, 'resources/platforms/ios', 'filters', '5.txt'));
            const filterLines = filterContent.split(/\r?\n/);
            expect(filterLines.length).toEqual(42);

            const presentRules = [
                '||example.com/images/*.mp4',
                'test.com,mp4upload.com###overlay',
                '||test.com/Forums2008/JS/replaceLinks.js',
                'example.com##div.grid_1[class$="app"]',
                '||app-test.com^$third-party',
            ];
            presentRules.forEach((rule) => {
                expect(filterLines.includes(rule)).toBeTruthy();
            });
            const absentRules = [
                '||example.com/test/$media,mp4,domain=test.com',
                '||test.com/cams/video_file/*.mp4$media,mp4',
                '||example.com/test/$media,redirect=noopmp4-1s,domain=test.com',
                '||test.com/cams/video_file/*.mp4$media,redirect=noopmp4-1s',
                '||example.com^$script,redirect-rule=noopjs',
                '||test.com/res/js/*.js$replace=/\\"OK\\/banners/\\"OK\\/banners__\\//',
                '||example.com^$~script,~stylesheet,~xmlhttprequest,replace=/popunder_url/popunder_url_/',
                '@@||test.com^$generichide,app=iexplore.exe',
            ];
            absentRules.forEach((rule) => {
                expect(filterLines.includes(rule)).toBeFalsy();
            });
        });

        it('platforms tests', async () => {
            const filterText = await readFile(path.join(filtersDir, 'filter_3_Test', 'filter.txt'));
            expect(filterText).toBeTruthy();
        });

        it('platform/test filters.json', async () => {
            const filtersMetadataContent = await readFile(path.join(platformsDir, 'test', 'filters.json'));
            expect(filtersMetadataContent).toBeTruthy();

            const filtersMetadata = JSON.parse(filtersMetadataContent);
            expect(filtersMetadata.filters).toBeTruthy();
            expect(filtersMetadata.filters[0]).toBeTruthy();
            expect(filtersMetadata.filters[0].filterId).toEqual(2);
            expect(filtersMetadata.filters[0].name).toEqual('AdGuard Base filter');
            expect(filtersMetadata.filters[0].description).toEqual('EasyList + AdGuard English filter. This filter is necessary for quality ad blocking.');
            expect(filtersMetadata.filters[0].timeAdded).toBeTruthy();
            expect(filtersMetadata.filters[0].homepage).toEqual('https://easylist.adblockplus.org/');
            expect(filtersMetadata.filters[0].expires).toEqual(172800);
            expect(filtersMetadata.filters[0].displayNumber).toEqual(101);
            expect(filtersMetadata.filters[0].groupId).toEqual(2);
            expect(filtersMetadata.filters[0].subscriptionUrl).toEqual('https://filters.adtidy.org/test/filters/2.txt');
            expect(filtersMetadata.filters[0].version).toBeTruthy();
            expect(filtersMetadata.filters[0].timeUpdated).toBeTruthy();
            expect(/\d\d-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d\d\d/.test(filtersMetadata.filters[0].timeUpdated)).toBeTruthy();
            expect(filtersMetadata.filters[0].languages.length).toEqual(2);
            expect(filtersMetadata.filters[0].languages[0]).toEqual('en');
            expect(filtersMetadata.filters[0].languages[1]).toEqual('pl');
            expect(filtersMetadata.filters[0].tags.length).toEqual(4);
            expect(filtersMetadata.filters[0].tags[0]).toEqual(1);
            expect(filtersMetadata.filters[0].trustLevel).toEqual('full');

            // Obsolete Filter test
            expect(filtersMetadata.filters.some((filter) => filter.filterId === 6)).toBeFalsy();
            expect(filtersMetadata.filters.some((filter) => filter.name === 'Obsolete Test Filter')).toBeFalsy();
        });

        it('platform/test filters_i18n.json', async () => {
            const filtersI18nMetadataContent = await readFile(path.join(platformsDir, 'test', 'filters_i18n.json'));
            expect(filtersI18nMetadataContent).toBeTruthy();

            const filtersI18nMetadata = JSON.parse(filtersI18nMetadataContent);
            const filtersI18nMetadataFilterIds = Object.keys(filtersI18nMetadata.filters);

            // Obsolete Filter test
            expect(filtersI18nMetadataFilterIds.some((id) => id === '6')).toBeFalsy();
        });

        it('platform/test local_script_rules.txt', async () => {
            const localScriptRulesContent = await readFile(path.join(platformsDir, 'test', 'local_script_rules.txt'));
            expect(localScriptRulesContent).toBeFalsy();

            const localScriptRulesLines = localScriptRulesContent.split('\r\n');
            expect(localScriptRulesLines.includes('test_domain#%#testScript();')).toBeFalsy();
        });

        it('platform/test local_script_rules.json', async () => {
            const localScriptRulesJsonContent = await readFile(path.join(platformsDir, 'test', 'local_script_rules.json'));
            expect(localScriptRulesJsonContent).toBeTruthy();

            const localScriptRulesJson = JSON.parse(localScriptRulesJsonContent);
            expect(localScriptRulesJson.comment).toBeTruthy();
            expect(localScriptRulesJson.rules).toBeTruthy();
        });

        it('platform/test filters 2.txt', async () => {
            const filterContent = await readFile(path.join(platformsDir, 'test', 'filters', '2.txt'));
            expect(filterContent).toBeTruthy();

            const filterLines = filterContent.split(/\r?\n/);
            expect(filterLines.length).toEqual(50);
            expect(filterLines[2]).toEqual('! Title: AdGuard Base filter + EasyList');

            const presentLines = [
                '![Adblock Plus 2.0]',
                'test-common-rule.com',
                'test-common-1-rule.com',
                '! some common rules could be places here',
                '~nigma.ru,google.com$$div[id=\"ad_text\"][wildcard=\"*teasernet*tararar*\"]',
                'excluded_platform',
                '!+ NOT_OPTIMIZED',
                'test-common-2-rule.com',
                'test.com##+js(abort-on-property-read, Object.prototype.getBanner)',
            ];
            presentLines.forEach((rule) => {
                expect(filterLines.includes(rule)).toBeTruthy();
            });

            const absentLines = [
                'test_domain#%#testScript();',
                'test.com#%#var isadblock=1;',
                'example.com#%#AG_onLoad(function() { AG_removeElementBySelector(\'span[class="intexta"]\'); });',
                // $webrtc is deprecated
                '||example.com^$webrtc,domain=example.org',
            ];
            absentLines.forEach((rule) => {
                expect(filterLines.includes(rule)).toBeFalsy();
            });
        });

        it('platform/test filters 2_optimized.txt', async () => {
            const filterContent = await readFile(path.join(platformsDir, 'test', 'filters', '2_optimized.txt'));
            expect(filterContent).toBeTruthy();

            const filterLines = filterContent.split(/\r?\n/);
            expect(filterLines.length).toEqual(34);
            expect(filterLines[2]).toEqual('! Title: AdGuard Base filter + EasyList (Optimized)');

            // $webrtc is deprecated
            expect(filterLines.includes('||example.com^$webrtc,domain=example.org')).toBeFalsy();
        });

        it('platform/test filters 2_without_easylist.txt', async () => {
            const filterContent = await readFile(path.join(platformsDir, 'test', 'filters', '2_without_easylist.txt'));
            expect(filterContent).toBeTruthy();

            const filterLines = filterContent.split(/\r?\n/);
            expect(filterLines.length).toEqual(28);
            expect(filterLines[2]).toEqual('! Title: AdGuard Base filter');
        });

        it('platforms/config/test filters 2.txt', async () => {
            const filterContent = await readFile(path.join(platformsDir, 'config/test', 'filters', '2.txt'));
            expect(filterContent).toBeTruthy();

            const filterLines = filterContent.split(/\r?\n/);
            expect(filterLines.length).toEqual(37);

            const presentLines = [
                'test-common-rule.com',
                'excluded_platform',
                'test_domain#%#testScript();',
                // 'trusted-' scriptlets should be included in full trust level filters
                'example.com#%#//scriptlet(\'trusted-set-local-storage-item\', \'iName\', \'iValue\')',
                'example.com#%#//scriptlet("trusted-set-cookie", "cName", "cValue")',
            ];
            presentLines.forEach((rule) => {
                expect(filterLines.includes(rule)).toBeTruthy();
            });

            const absentLines = [
                'test-common-1-rule.com',
                '! some common rules could be places here',
                '~nigma.ru,google.com$$div[id=\"ad_text\"][wildcard=\"*teasernet*tararar*\"]',
                // $webrtc is deprecated
                '||example.com^$webrtc,domain=example.org',
            ];
            absentLines.forEach((rule) => {
                expect(filterLines.includes(rule)).toBeFalsy();
            });
        });

        it('platforms/hints filters 2.txt', async () => {
            const filterContent = await readFile(path.join(platformsDir, 'hints', 'filters', '2.txt'));
            expect(filterContent).toBeTruthy();

            const filterLines = filterContent.split(/\r?\n/);
            expect(filterLines.length).toEqual(51);

            const presentLines = [
                'test-common-rule.com',
                'test-common-1-rule.com',
                '! some common rules could be places here',
                '~nigma.ru,google.com$$div[id=\"ad_text\"][wildcard=\"*teasernet*tararar*\"]',
                'excluded_platform',
                'test_domain#%#testScript();',
            ];
            presentLines.forEach((rule) => {
                expect(filterLines.includes(rule)).toBeTruthy();
            });

            const absentLines = [
                // $webrtc is deprecated
                '||example.com^$webrtc,domain=example.org',
            ];
            absentLines.forEach((rule) => {
                expect(filterLines.includes(rule)).toBeFalsy();
            });
        });

        it('platforms/ios filters 2.txt', async () => {
            const filterContent = await readFile(path.join(platformsDir, 'ios', 'filters', '2.txt'));
            expect(filterContent).toBeTruthy();

            const filterLines = filterContent.split(/\r?\n/);
            expect(filterLines.length).toEqual(52);

            const presentLines = [
                'test.com#%#var isadblock=1;',
                'test.com#%#//scriptlet(\'ubo-abort-on-property-read.js\', \'Object.prototype.getBanner\')',
                'example.net#$?#.main-content { margin-top: 0!important; }',
                'test.com#@$?#.banner { padding: 0!important; }',
                'example.net#?#.banner:matches-css(width: 360px)',
                'test.com#@?#.banner:matches-css(height: 200px)',
            ];
            presentLines.forEach((rule) => {
                expect(filterLines.includes(rule)).toBeTruthy();
            });

            const absentLines = [
                '||example.org^$cookie=test',
                '@@||example.com^$stealth',
                '||example.com^$webrtc,domain=example.org',
                '||example.org^$csp=frame-src \'none\'',
            ];
            absentLines.forEach((rule) => {
                expect(filterLines.includes(rule)).toBeFalsy();
            });
        });

        describe('check MAC platform', () => {
            it('platform/mac filters.json', async () => {
                const macFiltersMetadataContent = await readFile(path.join(platformsDir, 'mac', 'filters.json'));
                expect(macFiltersMetadataContent).toBeTruthy();
                const macFiltersMetadata = JSON.parse(macFiltersMetadataContent);
                expect(Object.keys(macFiltersMetadata).length).toEqual(2);

                expect(macFiltersMetadata.filters).toBeTruthy();
                expect(macFiltersMetadata.groups).toBeTruthy();
                expect(macFiltersMetadata.tags).toEqual(undefined);

                const group = macFiltersMetadata.groups[0];
                expect(group).toBeTruthy();
                expect(Object.keys(group).length).toEqual(3);
                expect(group.groupId).toEqual(1);
                expect(group.groupName).toEqual('Adguard Filters');
                expect(group.displayNumber).toEqual(1);

                const englishFilter = macFiltersMetadata.filters[0];
                expect(englishFilter).toBeTruthy();
                expect(Object.keys(englishFilter).length).toEqual(11);
                expect(englishFilter.filterId).toEqual(2);
                expect(englishFilter.name).toEqual('AdGuard Base filter');
                expect(englishFilter.description).toEqual('EasyList + AdGuard English filter. This filter is necessary for quality ad blocking.');
                expect(englishFilter.timeAdded).toEqual(undefined);
                expect(englishFilter.homepage).toEqual('https://easylist.adblockplus.org/');
                expect(englishFilter.expires).toEqual(172800);
                expect(englishFilter.displayNumber).toEqual(101);
                expect(englishFilter.groupId).toEqual(2);
                expect(englishFilter.subscriptionUrl).toEqual('https://filters.adtidy.org/mac/filters/2.txt');
                expect(englishFilter.version).toBeTruthy();
                expect(englishFilter.timeUpdated).toBeTruthy();
                expect(englishFilter.languages.length).toEqual(2);
                expect(englishFilter.languages[0]).toEqual('en');
                expect(englishFilter.languages[1]).toEqual('pl');
                expect(englishFilter.tags).toEqual(undefined);
                expect(englishFilter.trustLevel).toEqual(undefined);
            });

            it('platform/mac filters_i18n.json', async () => {
                const macFiltersI18nMetadataContent = await readFile(path.join(platformsDir, 'mac', 'filters_i18n.json'));
                expect(macFiltersI18nMetadataContent).toBeTruthy();

                const macFiltersI18nMetadata = JSON.parse(macFiltersI18nMetadataContent);
                expect(macFiltersI18nMetadata).toBeTruthy();
                expect(Object.keys(macFiltersI18nMetadata).length).toEqual(2);
            });

            it('platform/mac filters 2.txt', async () => {
                const filterContent = await readFile(path.join(platformsDir, 'mac', 'filters', '2.txt'));
                expect(filterContent).toBeTruthy();

                const filterLines = filterContent.split(/\r?\n/);

                // Check conditions
                expect(filterLines.includes('!#if adguard')).toBeFalsy();
                expect(filterLines.includes('!#endif')).toBeFalsy();
                expect(filterLines.includes('if_not_adguard_rule')).toBeFalsy();
                expect(filterLines.includes('if_adguard_included_rule')).toBeTruthy();
                expect(filterLines.includes('if_adguard_rule')).toBeTruthy();

                // wrong condition
                expect(filterLines.includes('wrong_condition')).toBeFalsy();

                // Check includes
                expect(filterLines.includes('!#include')).toBeFalsy();
            });

            it('platform/mac filters 4_optimized.txt', async () => {
                // platform specify includes
                const filterContent = await readFile(path.join(platformsDir, 'mac', 'filters', '4_optimized.txt'));
                expect(filterContent).toBeTruthy();

                const filterLines = filterContent.split(/\r?\n/);
                expect(filterLines.length).toEqual(14);

                expect(filterLines.includes('if_mac_included_rule')).toBeTruthy();
            });
        });

        describe('condition directives for platforms', () => {
            it('platform/test filters 4.txt', async () => {
                const filterContent = await readFile(path.join(platformsDir, 'test', 'filters', '4.txt'));
                expect(filterContent).toBeTruthy();

                const filterLines = filterContent.split(/\r?\n/);
                expect(filterLines.length).toEqual(22);
                expect(filterLines[2].startsWith('! Title:')).toBeTruthy();
                expect(filterLines[2].endsWith('(Optimized)')).toBeFalsy();

                // due to `!#if (!ublock)` directive
                // in src/test/resources/filters/filter_4_Directives/template.txt
                expect(filterLines.includes('if_not_ublock')).toBeFalsy();
            });

            it('platform/test filters 4_optimized.txt', async () => {
                const filterContent = await readFile(path.join(platformsDir, 'test', 'filters', '4_optimized.txt'));
                expect(filterContent).toBeTruthy();

                const filterLines = filterContent.split(/\r?\n/);
                expect(filterLines.length).toEqual(12);

                expect(filterLines[2].startsWith('! Title:')).toBeTruthy();
                expect(filterLines[2].endsWith('(Optimized)')).toBeTruthy();
                expect(filterLines.includes('if_not_ublock')).toBeFalsy();
            });

            it('platform/mac filters 5.txt', async () => {
                const filterContent = await readFile(path.join(platformsDir, 'mac', 'filters', '5.txt'));
                expect(filterContent).toBeTruthy();

                const filterLines = filterContent.split(/\r?\n/);
                expect(filterLines.length).toEqual(53);
                expect(filterLines.includes('||example.com^$script,redirect=noopjs')).toBeTruthy();
                expect(filterLines.includes('||example.com/banner$image,redirect=1x1-transparent.gif')).toBeTruthy();
            });

            it('platform/edge filters4.txt', async () => {
                const filterContent = await readFile(path.join(platformsDir, 'edge', 'filters', '4.txt'));
                expect(filterContent).toBeTruthy();

                const filterLines = filterContent.split(/\r?\n/);
                expect(filterLines.length).toEqual(23);
                expect(filterLines.includes('if_edge_chromium')).toBeTruthy();
            });

            it('filters4.txt - if with else branch', async () => {
                const ifContent = await readFile(path.join(platformsDir, 'ios', 'filters', '4.txt'));
                expect(ifContent).toBeTruthy();

                const ifLines = ifContent.split(/\r?\n/);
                expect(ifLines.length).toEqual(24);
                expect(ifLines.includes('ios_rule')).toBeTruthy();
                expect(ifLines.includes('non_ios_rule')).toBeFalsy();

                const elseContent = await readFile(path.join(platformsDir, 'mac', 'filters', '4.txt'));
                expect(elseContent).toBeTruthy();

                const elseLines = elseContent.split(/\r?\n/);
                expect(elseLines.length).toEqual(24);
                expect(elseLines.includes('ios_rule')).toBeFalsy();
                expect(elseLines.includes('non_ios_rule')).toBeTruthy();
            });
        });

        describe('platformsIncluded directive', () => {
            it('platform/test', async () => {
                // check if Directives Filter was built for test platform and metadata added to it's filters.json
                const fullFilterContent = existsSync(path.join(platformsDir, 'test', 'filters', '4.txt'));
                expect(fullFilterContent).toBeTruthy();
                const optimizedFilterContent = existsSync(path.join(platformsDir, 'test', 'filters', '4_optimized.txt'));
                expect(optimizedFilterContent).toBeTruthy();

                const metadataContent = await readFile(path.join(platformsDir, 'test', 'filters.json'));
                const metadata = JSON.parse(metadataContent);
                expect(metadata).toBeTruthy();
                expect(metadata.filters.some((f) => f.filterId === 4)).toBeTruthy();
            });

            it('platform/mac', async () => {
                // check if Directives Filter was built for mac platform and metadata added to it's filters.json
                const fullFilterContent = existsSync(path.join(platformsDir, 'mac', 'filters', '4.txt'));
                expect(fullFilterContent).toBeTruthy();
                const optimizedFilterContent = existsSync(path.join(platformsDir, 'mac', 'filters', '4_optimized.txt'));
                expect(optimizedFilterContent).toBeTruthy();

                const metadataContent = await readFile(path.join(platformsDir, 'mac', 'filters.json'));
                const metadata = JSON.parse(metadataContent);
                expect(metadata).toBeTruthy();
                expect(metadata.filters.some((f) => f.filterId === 4)).toBeTruthy();
            });

            it('platform/ios', async () => {
                // check if Directives Filter was NOT built for ios platform and metadata was NOT added to it's filters.json
                const fullFilterContent = existsSync(path.join(platformsDir, 'ios', 'filters', '4.txt'));
                expect(fullFilterContent).toBeTruthy();
                const optimizedFilterContent = existsSync(path.join(platformsDir, 'ios', 'filters', '4_optimized.txt'));
                expect(optimizedFilterContent).toBeTruthy();

                const metadataContent = await readFile(path.join(platformsDir, 'ios', 'filters.json'));
                const metadata = JSON.parse(metadataContent);
                expect(metadata).toBeTruthy();
                expect(metadata.filters.some((f) => f.filterId === 4)).toBeFalsy();
            });

            it('platform/test2', async () => {
                // check if Directives Filter was NOT built for test2 platform and metadata was NOT added to it's filters.json
                const fullFilterContent = existsSync(path.join(platformsDir, 'test2', 'filters', '4.txt'));
                expect(fullFilterContent).toBeTruthy();
                const optimizedFilterContent = existsSync(path.join(platformsDir, 'test2', 'filters', '4_optimized.txt'));
                expect(optimizedFilterContent).toBeTruthy();

                const metadataContent = await readFile(path.join(platformsDir, 'test2', 'filters.json'));
                const metadata = JSON.parse(metadataContent);
                expect(metadata).toBeTruthy();
                expect(metadata.filters.some((f) => f.filterId === 4)).toBeFalsy();
            });
        });

        describe('platformsExcluded directive', () => {
            it('platform/mac', async () => {
                // check if Test Filter was NOT built for mac platform and metadata was NOT added to it's filters.json
                const fullFilterContent = existsSync(path.join(platformsDir, 'mac', 'filters', '3.txt'));
                expect(fullFilterContent).toBeTruthy();
                const optimizedFilterContent = existsSync(path.join(platformsDir, 'mac', 'filters', '3_optimized.txt'));
                expect(optimizedFilterContent).toBeTruthy();

                const metadataContent = await readFile(path.join(platformsDir, 'mac', 'filters.json'));
                const metadata = JSON.parse(metadataContent);
                expect(metadata).toBeTruthy();
                expect(metadata.filters.some((f) => f.filterId === 3)).toBeFalsy();
            });

            it('platform/ios', async () => {
                // check if Test Filter was built for ios platform and metadata added to it's filters.json
                const fullFilterContent = existsSync(path.join(platformsDir, 'ios', 'filters', '3.txt'));
                expect(fullFilterContent).toBeTruthy();
                const optimizedFilterContent = existsSync(path.join(platformsDir, 'ios', 'filters', '3_optimized.txt'));
                expect(optimizedFilterContent).toBeTruthy();

                const metadataContent = await readFile(path.join(platformsDir, 'ios', 'filters.json'));
                const metadata = JSON.parse(metadataContent);
                expect(metadata).toBeTruthy();
                expect(metadata.filters.some((f) => f.filterId === 3)).toBeTruthy();
            });
        });

        describe('both platformsIncluded and platformsExcluded directives', () => {
            // Test Platforms Filter should be built only for mac and chromium platforms only
            // check src/test/resources/filters/filter_7_Platforms/metadata.json for details
            it('platform/mac', async () => {
                const fullFilterContent = existsSync(path.join(platformsDir, 'mac', 'filters', '7.txt'));
                expect(fullFilterContent).toBeTruthy();
                const optimizedFilterContent = existsSync(path.join(platformsDir, 'mac', 'filters', '7_optimized.txt'));
                expect(optimizedFilterContent).toBeTruthy();

                const metadataContent = await readFile(path.join(platformsDir, 'mac', 'filters.json'));
                const metadata = JSON.parse(metadataContent);
                expect(metadata).toBeTruthy();
                expect(metadata.filters.some((f) => f.filterId === 7)).toBeTruthy();
            });

            it('platform/test2', async () => {
                // chromium path is test2, it is specified in src/test/resources/platforms.json
                const fullFilterContent = existsSync(path.join(platformsDir, 'test2', 'filters', '7.txt'));
                expect(fullFilterContent).toBeTruthy();
                const optimizedFilterContent = existsSync(path.join(platformsDir, 'test2', 'filters', '7_optimized.txt'));
                expect(optimizedFilterContent).toBeTruthy();

                const metadataContent = await readFile(path.join(platformsDir, 'test2', 'filters.json'));
                const metadata = JSON.parse(metadataContent);
                expect(metadata).toBeTruthy();
                expect(metadata.filters.some((f) => f.filterId === 7)).toBeTruthy();
            });

            it('platform/ios', async () => {
                // ios is specified in platformsIncluded
                // but it is also specified in platformsExcluded, so no build for ios
                const fullFilterContent = existsSync(path.join(platformsDir, 'ios', 'filters', '7.txt'));
                expect(fullFilterContent).toBeTruthy();
                const optimizedFilterContent = existsSync(path.join(platformsDir, 'ios', 'filters', '7_optimized.txt'));
                expect(optimizedFilterContent).toBeTruthy();

                const metadataContent = await readFile(path.join(platformsDir, 'ios', 'filters.json'));
                const metadata = JSON.parse(metadataContent);
                expect(metadata).toBeTruthy();
                expect(metadata.filters.some((f) => f.filterId === 7)).toBeFalsy();
            });

            it('platform/test', async () => {
                const fullFilterContent = existsSync(path.join(platformsDir, 'test', 'filters', '7.txt'));
                expect(fullFilterContent).toBeTruthy();
                const optimizedFilterContent = existsSync(path.join(platformsDir, 'test', 'filters', '7_optimized.txt'));
                expect(optimizedFilterContent).toBeTruthy();

                const metadataContent = await readFile(path.join(platformsDir, 'test', 'filters.json'));
                const metadata = JSON.parse(metadataContent);
                expect(metadata).toBeTruthy();
                expect(metadata.filters.some((f) => f.filterId === 7)).toBeFalsy();
            });
        });

        describe('hint PLATFORM inside of !#safari_cb_affinity directive', () => {
            it('platform/ios', async () => {
                const filterContent = await readFile(path.join(platformsDir, 'ios', 'filters', '7.txt'));
                expect(filterContent).toBeTruthy();

                const filterLines = filterContent.split(/\r?\n/);
                expect(filterLines.includes('||example1.org')).toBeTruthy();
                expect(filterLines.includes('||example2.org')).toBeTruthy();
            });

            it('platform/mac', async () => {
                const filterContent = await readFile(path.join(platformsDir, 'mac', 'filters', '7.txt'));
                expect(filterContent).toBeTruthy();

                const filterLines = filterContent.split(/\r?\n/);
                expect(filterLines.includes('||example1.org')).toBeTruthy();
                expect(filterLines.includes('||example2.org')).toBeFalsy();
            });
        });

        it('removing scriptlet rules in local_script_rules.json', async () => {
            // test removing scriptlet rules in local_script_rules.json for chrome browser extension
            const localScriptRulesJsonContent = await readFile(path.join(platformsDir, 'chromium', 'local_script_rules.json'));
            expect(localScriptRulesJsonContent).toBeTruthy();

            const localScriptRulesData = JSON.parse(localScriptRulesJsonContent);
            expect(localScriptRulesData.rules).toBeTruthy();
            expect(localScriptRulesData.rules.some((rule) => rule.script.startsWith('//scriptlet'))).toBeFalsy();
        });

        it('applying replacements', async () => {
            const filterContent = await readFile(path.join(platformsDir, 'replacements', 'filters', '2.txt'));
            expect(filterContent).toBeTruthy();

            const filterLines = filterContent.split(/\r?\n/);
            expect(filterLines.includes('||stringtoreplace^')).toBeFalsy();
            expect(filterLines.includes('||replacementstring^')).toBeTruthy();
        });
    });

    it('Builds lists', async () => {
        await builder.build(filtersDir, logFile, reportFile, null, {}, null, [2, 3]);
        let revision = await readFile(path.join(filtersDir, 'filter_2_English', 'revision.json'));
        expect(revision).toBeTruthy();

        await builder.build(filtersDir, logFile, reportFile, null, {}, null, null, [3, 4]);
        revision = await readFile(path.join(filtersDir, 'filter_2_English', 'revision.json'));
        expect(revision).toBeTruthy();

        await builder.build(filtersDir, logFile, reportFile, null, {}, null, [2, 3], [3, 4]);
        revision = await readFile(path.join(filtersDir, 'filter_2_English', 'revision.json'));
        expect(revision).toBeTruthy();
    });

    it('Validate affinity directives', async () => {
        await expect(
            builder.build(badFiltersDir, null, null, platformsDir, platformsConfigFile, [8])
        ).rejects.toThrow('Error validating !#safari_cb_affinity directive in filter 8');
    });

    it('Resolve bad include inside condition', async () => {
        await expect(
            builder.build(badFiltersDir, null, null, platformsDir, platformsConfigFile, [9])
        ).rejects.toThrow(/^ENOENT: no such file or directory, open.*non-existing-file\.txt.*$/);
    });

    it('filters.js and filters_i18n.js as copies of the json files', async () => {
        const filtersJson = await readFile(path.join(platformsDir, 'test', 'filters.json'));
        const filtersJs = await readFile(path.join(platformsDir, 'test', 'filters.js'));
        expect(filtersJson).toEqual(filtersJs);

        const filtersI18nJson = await readFile(path.join(platformsDir, 'test', 'filters_i18n.json'));
        const filtersI18nJs = await readFile(path.join(platformsDir, 'test', 'filters_i18n.js'));
        expect(filtersI18nJson).toEqual(filtersI18nJs);
    });
});
