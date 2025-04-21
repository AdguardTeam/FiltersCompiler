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

        // remove platformsDir if it exists
        if (existsSync(platformsDir)) {
            await fs.rmdir(platformsDir, { recursive: true });
        }

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

        describe('optimizeDomainBlockingRules options of include directive', () => {
            it('Should filter "platforms/mac" with "12.txt"', async () => {
                // Read the content of the file and split it into lines
                const filterContent = await readFile(path.join(platformsDir, 'mac', 'filters', '12.txt'));
                const filterLines = filterContent.split(/\r?\n/);
                expect(filterLines.length).toEqual(21);
                // Ensure that the file is not empty
                expect(filterContent).toBeTruthy();
                const filterRules = filterLines.filter((line) => line.length > 0 && !line.startsWith('!'));
                const presentRules = [
                    '||met.vgwort.de^$script',
                    '||0031.lookinews.com^$script',
                    '||0021.lookinews.com^$script',
                    '||1.lookinews.com^$script',
                    '||0051.lookinews.com^$script',
                    '||0071.lookinews.com^$script',
                    '||4189.freshalldaynews.com^$script',
                    '||9.freshalldaynews.com^$script',
                    '||4179.freshalldaynews.com^$script',
                    '||39.freshalldaynews.com^$script',
                    '||pl02.owen.prolitteris.ch^$script',
                    '||intense.vgwort.de^$script',
                ];
                presentRules.forEach((rule) => {
                    expect(filterRules.includes(rule)).toBeTruthy();
                });
            });

            it('Should filter "platforms/ios" with "12.txt"', async () => {
                const filterContent = await readFile(path.join(platformsDir, 'ios', 'filters', '12.txt'));
                const filterLines = filterContent.split(/\r?\n/);
                expect(filterLines.length).toEqual(22);
                // Ensure that the file is not empty
                expect(filterContent).toBeTruthy();
                // Filter rules without comments
                const filterRules = filterLines.filter((line) => line.length > 0 && !line.startsWith('!'));
                const presentRules = [
                    '||0031.lookinews.com^',
                    '||0051.lookinews.com^',
                    '||0021.lookinews.com^',
                    '||0071.lookinews.com^',
                    '||1.lookinews.com^',
                    '||39.freshalldaynews.com^',
                    '||4179.freshalldaynews.com^',
                    '||4189.freshalldaynews.com^',
                    '||9.freshalldaynews.com^',
                    '||intense.vgwort.de^',
                    '||met.vgwort.de^',
                    '||pl02.owen.prolitteris.ch^',
                ];
                presentRules.forEach((rule) => {
                    expect(filterRules.includes(rule)).toBeTruthy();
                });
            });

            it('Should filter "platforms/edge" with "12.txt"', async () => {
                const filterContent = await readFile(path.join(platformsDir, 'edge', 'filters', '12.txt'));
                const filterLines = filterContent.split(/\r?\n/);
                expect(filterLines.length).toEqual(33);
                // Ensure that the file is not empty
                expect(filterContent).toBeTruthy();
                const filterRules = filterLines.filter((line) => line.length > 0 && !line.startsWith('!'));
                const presentRules = [
                    '||0031.lookinews.com^',
                    '||0051.lookinews.com^',
                    '||0021.lookinews.com^',
                    '||0071.lookinews.com^',
                    '||1.lookinews.com^',
                    '||39.freshalldaynews.com^',
                    '||4179.freshalldaynews.com^',
                    '||4189.freshalldaynews.com^',
                    '||9.freshalldaynews.com^',
                    '||intense.vgwort.de^',
                    '||met.vgwort.de^',
                    '||pl02.owen.prolitteris.ch^',
                ];
                presentRules.forEach((rule) => {
                    expect(filterRules.includes(rule)).toBeTruthy();
                });
                // Check that the number of hints is equal to the number of rules
                const filterHints = filterLines.filter((line) => line === '!+ NOT_OPTIMIZED');
                expect(filterRules.length).toEqual(filterHints.length);
            });
        });

        describe('addModifiers options of include directive', () => {
            it('Should filter "platforms/mac" with "10.txt"', async () => {
                // Read the content of the file and split it into lines
                const filterContent = await readFile(path.join(platformsDir, 'mac', 'filters', '10.txt'));
                const filterLines = filterContent.split(/\r?\n/);
                expect(filterLines.length).toEqual(17);
                // Ensure that the file is not empty
                expect(filterContent).toBeTruthy();
                const filterRules = filterLines.filter((line) => line.length > 0 && !line.startsWith('!'));
                // Check that each line ends with '$image'
                const presentRules = [
                    'a155e09a56.reuters.tv$image',
                    'albany.townsquarenewsletters.com$image',
                    'alerts.dmgt.com$image',
                    'aremedia.e.aremedia.com.au$image',
                    'auto.scissorsscotch.com$image',
                    'track.domain.com$image',
                    'criteo.com$image,script',
                    'go.pardot.com$all,image',
                ];
                // Check that the specified modifier isn't added to lines that already have it.
                presentRules.forEach((rule) => {
                    expect(filterRules.includes(rule)).toBeTruthy();
                });
            });

            it('Should filter "platforms/ios" with "10.txt"', async () => {
                const filterContent = await readFile(path.join(platformsDir, 'ios', 'filters', '10.txt'));
                const filterLines = filterContent.split(/\r?\n/);
                expect(filterLines.length).toEqual(34);
                // Ensure that the file is not empty
                expect(filterContent).toBeTruthy();
                // Filter rules without comments
                const filterRules = filterLines.filter((line) => line.length > 0 && !line.startsWith('!'));
                // Ensure that each line ends with '$image,script'
                const presentRules = [
                    'a155e09a56.reuters.tv$image,script',
                    'albany.townsquarenewsletters.com$image,script',
                    'alerts.dmgt.com$image,script',
                    'aremedia.e.aremedia.com.au$image,script',
                    'auto.scissorsscotch.com$image,script',
                    'track.domain.com$image,script',
                    'criteo.com$image,script',
                    'go.pardot.com$all,image,script',
                ];
                presentRules.forEach((rule) => {
                    expect(filterRules.includes(rule)).toBeTruthy();
                });
                // Check that the number of hints is equal to the number of rules
                const filterHints = filterLines.filter((line) => line === '!+ NOT_OPTIMIZED');
                expect(filterRules.length).toEqual(filterHints.length);
            });

            it('Should filter "platforms/edge" with "10.txt"', async () => {
                const filterContent = await readFile(path.join(platformsDir, 'edge', 'filters', '10.txt'));
                const filterLines = filterContent.split(/\r?\n/);
                expect(filterLines.length).toEqual(25);
                // Ensure that the file is not empty
                expect(filterContent).toBeTruthy();
                const filterRules = filterLines.filter((line) => line.length > 0 && !line.startsWith('!'));
                const presentRules = [
                    'a155e09a56.reuters.tv$all',
                    'albany.townsquarenewsletters.com$all',
                    'alerts.dmgt.com$all',
                    'aremedia.e.aremedia.com.au$all',
                    'auto.scissorsscotch.com$all',
                    'track.domain.com$image,all',
                    'criteo.com$image,script,all',
                    'go.pardot.com$all',
                ];
                presentRules.forEach((rule) => {
                    expect(filterRules.includes(rule)).toBeTruthy();
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
            expect(filterLines.length).toEqual(55);

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
                "test.com#@%#Object.defineProperty(window, 'abcde', { get: function() { return []; } });",
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
            expect(filterLines.length).toEqual(55);

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
            expect(filtersMetadata.filters[0].downloadUrl).toEqual('https://filters.adtidy.org/test/filters/2.txt');
            // expires value parsed from the filter metadata
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

            // Deprecated
            filtersMetadata.filters.forEach((filter) => {
                expect(filter.deprecated).toBe(filter.filterId === 2);
            });

            // Obsolete Filter test
            expect(filtersMetadata.filters.some((filter) => filter.filterId === 6)).toBeFalsy();
            expect(filtersMetadata.filters.some((filter) => filter.name === 'Obsolete Test Filter')).toBeFalsy();

            expect(filtersMetadata.groups).toBeTruthy();
            expect(filtersMetadata.groups[0]).toBeTruthy();
            expect(filtersMetadata.groups[0].groupId).toEqual(1);
            expect(filtersMetadata.groups[0].groupName).toEqual('Adguard Filters');
            expect(filtersMetadata.groups[0].groupDescription).toEqual('Adguard Filters description');
            expect(filtersMetadata.groups[0].displayNumber).toEqual(1);
        });

        it('platform/test filters_i18n.json', async () => {
            const filtersI18nMetadataContent = await readFile(path.join(platformsDir, 'test', 'filters_i18n.json'));
            expect(filtersI18nMetadataContent).toBeTruthy();

            const filtersI18nMetadata = JSON.parse(filtersI18nMetadataContent);
            const filtersI18nMetadataFilterIds = Object.keys(filtersI18nMetadata.filters);

            // Obsolete Filter test
            expect(filtersI18nMetadataFilterIds.some((id) => id === '6')).toBeFalsy();

            expect(filtersI18nMetadata.groups).toBeTruthy();
            const i18nGroup = filtersI18nMetadata.groups['1'];
            expect(i18nGroup).toBeTruthy();
            const enGroup = i18nGroup['en'];
            expect(enGroup).toBeTruthy();
            expect(enGroup.name).toEqual('Adguard Filters');
            expect(enGroup.description).toEqual('Adguard Filters description');
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
            // directory 'test' is used for 'ext_ublock' platform;
            // see src/test/resources/platforms.json
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
                '~example.com,google.com$$div[id=\"ad_text\"][wildcard=\"*teasernet*tararar*\"]',
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
                'example.org#@%#navigator.getBattery = undefined;',
                'example.com#%#AG_onLoad(function() { AG_removeElementBySelector(\'span[class="intexta"]\'); });',
                // $webrtc is deprecated
                '||example.com^$webrtc,domain=example.org',
            ];
            absentLines.forEach((rule) => {
                expect(filterLines.includes(rule)).toBeFalsy();
            });
        });

        it('platform/test filters 2_optimized.txt', async () => {
            // directory 'test' is used for 'ext_ublock' platform;
            // see src/test/resources/platforms.json
            const filterContent = await readFile(path.join(platformsDir, 'test', 'filters', '2_optimized.txt'));
            expect(filterContent).toBeTruthy();

            const filterLines = filterContent.split(/\r?\n/);
            expect(filterLines.length).toEqual(34);
            expect(filterLines[2]).toEqual('! Title: AdGuard Base filter + EasyList (Optimized)');

            // $webrtc is deprecated
            expect(filterLines.includes('||example.com^$webrtc,domain=example.org')).toBeFalsy();

            // script `#%#` rules and script exception `#%@#` rules should be excluded for ext_ublock platform
            // see excludeScriptRules() in generator.js
            expect(filterLines.includes('test.com#%#var isadblock=1;')).toBeFalsy();
            // https://github.com/AdguardTeam/FiltersCompiler/issues/199
            expect(filterLines.includes('example.org#@%#navigator.getBattery = undefined;')).toBeFalsy();
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
            expect(filterLines.length).toEqual(38);

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
                '~example.com,google.com$$div[id=\"ad_text\"][wildcard=\"*teasernet*tararar*\"]',
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
            expect(filterLines.length).toEqual(52);

            const presentLines = [
                'test-common-rule.com',
                'test-common-1-rule.com',
                '! some common rules could be places here',
                '~example.com,google.com$$div[id=\"ad_text\"][wildcard=\"*teasernet*tararar*\"]',
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
            expect(filterLines.length).toEqual(53);

            // expires value in set from the filters metadata
            // if there is no 'expires' property in platform.json for the platform
            expect(filterLines.includes('! Expires: 2 days (update frequency)')).toBeTruthy();

            const presentLines = [
                'test_domain#%#testScript();',
                'test.com#%#var isadblock=1;',
                'example.org#@%#navigator.getBattery = undefined;',
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

        it('platforms/chromium-mv3 filters 2.txt', async () => {
            const filterContent = await readFile(path.join(platformsDir, 'chromium-mv3', 'filters', '2.txt'));
            expect(filterContent).toBeTruthy();

            const filterLines = filterContent.split(/\r?\n/);
            expect(filterLines.length).toEqual(56);

            // expires value in set from the filters metadata
            // if there is no 'expires' property in platform.json for the platform
            expect(filterLines.includes('! Expires: 2 days (update frequency)')).toBeTruthy();

            const presentLines = [
                'test_domain#%#testScript();',
                'test.com#%#var isadblock=1;',
                'example.org#@%#navigator.getBattery = undefined;',
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
                '||example.com^$script,redirect-rule=noopjs',
                '*$redirect-rule=noopjs,xmlhttprequest,domain=example.com',
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
                // no new field should be added to old 'mac' platform
                expect(group.groupDescription).toEqual(undefined);
                expect(group.displayNumber).toEqual(1);

                const englishFilter = macFiltersMetadata.filters[0];
                expect(englishFilter).toBeTruthy();
                expect(Object.keys(englishFilter).length).toEqual(11);
                expect(englishFilter.filterId).toEqual(2);
                expect(englishFilter.name).toEqual('AdGuard Base filter');
                expect(englishFilter.description).toEqual('EasyList + AdGuard English filter. This filter is necessary for quality ad blocking.');
                expect(englishFilter.timeAdded).toEqual(undefined);
                expect(englishFilter.homepage).toEqual('https://easylist.adblockplus.org/');
                // due to the override value set in the platforms.json for mac platform
                // the value is "12 hours" which is 43200 seconds
                expect(englishFilter.expires).toEqual(43200);
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

                expect(macFiltersI18nMetadata.filters).toBeTruthy();
                expect(macFiltersI18nMetadata.groups).toBeTruthy();
                expect(macFiltersI18nMetadata.tags).toEqual(undefined);

                const group = macFiltersI18nMetadata.groups['1'];
                expect(group).toBeTruthy();
                const enGroup = group.en;
                expect(enGroup).toBeTruthy();
                expect(enGroup.name).toEqual('Adguard Filters');
                // no new field should be added to old 'mac' platform
                expect(enGroup.description).toEqual(undefined);
            });

            it('platform/mac filters 2.txt', async () => {
                const filterContent = await readFile(path.join(platformsDir, 'mac', 'filters', '2.txt'));
                expect(filterContent).toBeTruthy();

                const filterLines = filterContent.split(/\r?\n/);

                // expires value can be overridden by platforms.json for specific platforms
                expect(filterLines.includes('! Expires: 12 hours (update frequency)')).toBeTruthy();

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

        describe('check MAC_V2 platform', () => {
            it('platform/mac_v2 filters.json', async () => {
                const macV2FiltersMetadataContent = await readFile(path.join(platformsDir, 'mac_v2', 'filters.json'));
                expect(macV2FiltersMetadataContent).toBeTruthy();
                const macV2FiltersMetadata = JSON.parse(macV2FiltersMetadataContent);
                expect(Object.keys(macV2FiltersMetadata).length).toEqual(3);

                expect(macV2FiltersMetadata.filters).toBeTruthy();
                expect(macV2FiltersMetadata.groups).toBeTruthy();
                // new field is added in MAC_V2 platform (not present in MAC platform)
                expect(macV2FiltersMetadata.tags).toBeTruthy();

                const group = macV2FiltersMetadata.groups[0];
                expect(group).toBeTruthy();
                // limited list of fields is expected: groupId, groupName, displayNumber
                expect(Object.keys(group).length).toEqual(3);
                expect(group.groupId).toEqual(1);
                expect(group.groupName).toEqual('Adguard Filters');
                expect(group.displayNumber).toEqual(1);
                // no new field should be added to old 'mac_v2' platform
                expect(group.groupDescription).toEqual(undefined);

                const englishFilter = macV2FiltersMetadata.filters[0];
                expect(englishFilter).toBeTruthy();
                // comparing to MAC platform, MAC_V2 platform has additional fields for filters
                expect(Object.keys(englishFilter).length).toEqual(16);
                expect(englishFilter.filterId).toEqual(2);
                expect(englishFilter.name).toEqual('AdGuard Base filter');
                expect(englishFilter.description).toEqual('EasyList + AdGuard English filter. This filter is necessary for quality ad blocking.');
                expect(englishFilter.homepage).toEqual('https://easylist.adblockplus.org/');
                // due to the override value set in the platforms.json for mac platform
                // the value is "12 hours" which is 43200 seconds
                expect(englishFilter.expires).toEqual(43200);
                expect(englishFilter.displayNumber).toEqual(101);
                expect(englishFilter.groupId).toEqual(2);
                expect(englishFilter.subscriptionUrl).toEqual('https://filters.adtidy.org/mac_v2/filters/2.txt');
                expect(englishFilter.version).toBeTruthy();
                expect(englishFilter.timeUpdated).toBeTruthy();
                expect(englishFilter.languages.length).toEqual(2);
                expect(englishFilter.languages[0]).toEqual('en');
                expect(englishFilter.languages[1]).toEqual('pl');
                // following fields are added in MAC_V2 platform (not present in MAC platform)
                expect(englishFilter.tags).toEqual([1, 7, 41, 10]);
                expect(englishFilter.timeAdded).toBeTruthy();
                expect(englishFilter.trustLevel).toEqual('full');
                expect(englishFilter.downloadUrl).toEqual('https://filters.adtidy.org/mac_v2/filters/2.txt');
                expect(englishFilter.deprecated).toEqual(true);
            });

            it('platform/mac_v2 filters_i18n.json', async () => {
                const macV2FiltersI18nMetadataContent = await readFile(path.join(platformsDir, 'mac_v2', 'filters_i18n.json'));
                expect(macV2FiltersI18nMetadataContent).toBeTruthy();

                const macV2FiltersI18nMetadata = JSON.parse(macV2FiltersI18nMetadataContent);
                expect(macV2FiltersI18nMetadata).toBeTruthy();
                expect(Object.keys(macV2FiltersI18nMetadata).length).toEqual(3);

                expect(macV2FiltersI18nMetadata.filters).toBeTruthy();
                expect(macV2FiltersI18nMetadata.groups).toBeTruthy();
                // new field is added in MAC_V2 platform (not present in MAC platform)
                expect(macV2FiltersI18nMetadata.tags).toBeTruthy();

                const group = macV2FiltersI18nMetadata.groups['1'];
                expect(group).toBeTruthy();
                const enGroup = group.en;
                expect(enGroup).toBeTruthy();
                expect(enGroup.name).toEqual('Adguard Filters');
                // group description in localized metadata should not break anything
                expect(enGroup.description).toEqual('Adguard Filters description');
            });

            it('platform/mac_v2 filters 2.txt', async () => {
                const filterContent = await readFile(path.join(platformsDir, 'mac_v2', 'filters', '2.txt'));
                expect(filterContent).toBeTruthy();

                const filterLines = filterContent.split(/\r?\n/);

                // expires value can be overridden by platforms.json for specific platforms
                expect(filterLines.includes('! Expires: 12 hours (update frequency)')).toBeTruthy();

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
                expect(filterLines.length).toEqual(54);
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

            it('filters4.txt - adguard_ext_chromium_mv3 constant for the if directive', async () => {
                const ifContent = await readFile(path.join(platformsDir, 'chromium-mv3', 'filters', '4.txt'));
                expect(ifContent).toBeTruthy();

                const ifLines = ifContent.split(/\r?\n/);
                expect(ifLines.length).toEqual(23);
                expect(ifLines.includes('chrome_mv3_specific_rule')).toBeTruthy();
                expect(ifLines.includes('ios_rule')).toBeFalsy();
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
                expect(metadata.filters.some((f) => f.filterId === 4)).toBeTruthy();

                const i18nMetadataContent = await readFile(path.join(platformsDir, 'ios', 'filters_i18n.json'));
                const i18nMetadata = JSON.parse(i18nMetadataContent);
                expect(i18nMetadata).toBeTruthy();
                const localizedFilterIds = Object.keys(i18nMetadata.filters);
                expect(localizedFilterIds.includes('4')).toBeTruthy();
            });

            it('platform/test2', async () => {
                // check if Directives Filter was NOT built for test2 platform and metadata was NOT added to it's filters.json
                const fullFilterContent = existsSync(path.join(platformsDir, 'test2', 'filters', '4.txt'));
                expect(fullFilterContent).toBeFalsy();
                const optimizedFilterContent = existsSync(path.join(platformsDir, 'test2', 'filters', '4_optimized.txt'));
                expect(optimizedFilterContent).toBeFalsy();

                const metadataContent = await readFile(path.join(platformsDir, 'test2', 'filters.json'));
                const metadata = JSON.parse(metadataContent);
                expect(metadata).toBeTruthy();
                expect(metadata.filters.some((f) => f.filterId === 4)).toBeFalsy();

                const i18nMetadataContent = await readFile(path.join(platformsDir, 'test2', 'filters_i18n.json'));
                const i18nMetadata = JSON.parse(i18nMetadataContent);
                expect(i18nMetadata).toBeTruthy();
                const localizedFilterIds = Object.keys(i18nMetadata.filters);
                expect(localizedFilterIds.includes('4')).toBeFalsy();
            });
        });

        describe('platformsExcluded directive', () => {
            it('platform/mac', async () => {
                // check if Test Filter was NOT built for mac platform and metadata was NOT added to it's filters.json
                const fullFilterContent = existsSync(path.join(platformsDir, 'mac', 'filters', '3.txt'));
                expect(fullFilterContent).toBeFalsy();
                const optimizedFilterContent = existsSync(path.join(platformsDir, 'mac', 'filters', '3_optimized.txt'));
                expect(optimizedFilterContent).toBeFalsy();

                const metadataContent = await readFile(path.join(platformsDir, 'mac', 'filters.json'));
                const metadata = JSON.parse(metadataContent);
                expect(metadata).toBeTruthy();
                expect(metadata.filters.some((f) => f.filterId === 2)).toBeTruthy();
                expect(metadata.filters.some((f) => f.filterId === 3)).toBeFalsy();

                // check the same for translations metadata
                const i18nMetadataContent = await readFile(path.join(platformsDir, 'mac', 'filters_i18n.json'));
                const i18nMetadata = JSON.parse(i18nMetadataContent);
                expect(i18nMetadata).toBeTruthy();
                const localizedFilterIds = Object.keys(i18nMetadata.filters);
                expect(localizedFilterIds.includes('2')).toBeTruthy();
                expect(localizedFilterIds.includes('3')).toBeFalsy();
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

        describe('!#safari_cb_affinity directive — check order of builder rules', () => {
            it('platform/ios', async () => {
                const filterContent = await readFile(path.join(platformsDir, 'ios', 'filters', '7.txt'));
                expect(filterContent).toBeTruthy();

                const filterLines = filterContent.split(/\r?\n/);

                const expectedSafariAffinityRules1 = [
                    '!#safari_cb_affinity(security)',
                    '||test3.com',
                    '!#safari_cb_affinity',
                ];
                expect(filterLines).toEqual(expect.arrayContaining(expectedSafariAffinityRules1));

                const expectedSafariAffinityRules2 = [
                    '!#safari_cb_affinity(advanced)',
                    '||test6.com/ads.js$domain=example.com',
                    "example.com#%#//scriptlet('set-constant', 'test123', '123')",
                    '!#safari_cb_affinity',
                ];
                expect(filterLines).toEqual(expect.arrayContaining(expectedSafariAffinityRules2));
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

        describe('hint NOT_VALIDATE', () => {
            it('platform/ios', async () => {
                const filterContent = await readFile(path.join(platformsDir, 'ios', 'filters', '7.txt'));
                expect(filterContent).toBeTruthy();

                const filterLines = filterContent.split(/\r?\n/);
                expect(filterLines.includes('||test.org^$newmodifier')).toBeTruthy();
                expect(filterLines.includes('||example.org^$newmodifier')).toBeFalsy();
                expect(filterLines.includes('||test.org^$unsupported')).toBeFalsy();
            });

            it('platform/mac', async () => {
                const filterContent = await readFile(path.join(platformsDir, 'mac', 'filters', '7.txt'));
                expect(filterContent).toBeTruthy();

                const filterLines = filterContent.split(/\r?\n/);
                expect(filterLines.includes('||test.org^$newmodifier')).toBeTruthy();
                expect(filterLines.includes('||example.org^$newmodifier')).toBeTruthy();
                expect(filterLines.includes('||foo.bar^$newmodifier')).toBeTruthy();
                expect(filterLines.includes('||test.org^$unsupported')).toBeFalsy();
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

        describe('ignoreTrustLevel options of include directive', () => {
            it('platforms/mac with filterId 11', async () => {
                const filterContent = await readFile(path.join(platformsDir, 'mac', 'filters', '11.txt'));
                expect(filterContent).toBeTruthy();

                const filterLines = filterContent.split(/\r?\n/);
                expect(filterLines.length).toEqual(19);

                const presentRules = [
                    // rules from included file:
                    'example.com#$#.additional { color: red; }',
                    '||example.com$replace=/"additional"/"__additional"/',
                    "example.com#%#AG_setConstant('additional1', '1');",
                    "example.com#%#//scriptlet('set-constant', 'additional2', '2')",
                    // rules from template.txt
                    // allowed for low trust level:
                    'example.com##.lowLevelBanner',
                    '||example.com/low/level/*.js^$script,third-party',
                ];
                presentRules.forEach((rule) => {
                    expect(filterLines.includes(rule)).toBeTruthy();
                });

                const absentRules = [
                    // rules from template.txt
                    // not allowed for low trust level:
                    'example.com#$#.template { color: red; }',
                    '||example.com$replace=/"template"/"__template"/',
                    "example.com#%#AG_setConstant('template1', '1');",
                    "example.com#%#//scriptlet('set-constant', 'template2', '2')",
                ];
                absentRules.forEach((rule) => {
                    expect(filterLines.includes(rule)).toBeFalsy();
                });
            });

            it('platforms/ios with filterId 11', async () => {
                const filterContent = await readFile(path.join(platformsDir, 'ios', 'filters', '11.txt'));
                expect(filterContent).toBeTruthy();

                const filterLines = filterContent.split(/\r?\n/);
                expect(filterLines.length).toEqual(16);

                const presentRules = [
                    // rules from template.txt
                    // allowed for low trust level:
                    'example.com##.lowLevelBanner',
                    '||example.com/low/level/*.js^$script,third-party',
                ];
                presentRules.forEach((rule) => {
                    expect(filterLines.includes(rule)).toBeTruthy();
                });

                const absentRules = [
                    // rules from included file:
                    'example.com#$#.additional { color: red; }',
                    '||example.com$replace=/"additional"/"__additional"/',
                    "example.com#%#AG_setConstant('additional1', '1');",
                    "example.com#%#//scriptlet('set-constant', 'additional2', '2')",
                    // rules from template.txt
                    // not allowed for low trust level:
                    'example.com#$#.template { color: red; }',
                    '||example.com$replace=/"template"/"__template"/',
                    "example.com#%#AG_setConstant('template1', '1');",
                    "example.com#%#//scriptlet('set-constant', 'template2', '2')",
                ];
                absentRules.forEach((rule) => {
                    expect(filterLines.includes(rule)).toBeFalsy();
                });
            });
        });

        it('remove Diff-Path header tag', async () => {
            const filterContent = await readFile(path.join(platformsDir, 'test', 'filters', '13.txt'));
            expect(filterContent).toBeTruthy();

            const filterLines = filterContent.split(/\r?\n/);
            expect(filterLines.length).toEqual(18);
            // make sure that the needed filter has been built
            expect(filterLines.includes('! Title: Remove Diff-Path Original list')).toBeTruthy();
            expect(filterLines.includes('example.com##.original_filter_with_diff_path')).toBeTruthy();
            // and there is no Diff-Path header tag
            expect(filterLines.includes('! Diff-Path: patches/20240814180433418.patch#test')).toBeFalsy();
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
            builder.build(badFiltersDir, null, null, platformsDir, platformsConfigFile, [8]),
        ).rejects.toThrow('Error validating !#safari_cb_affinity directive in filter 8');
    });

    it('Resolve bad include inside condition', async () => {
        const filterURL = path.join(badFiltersDir, 'filter_9_Includes');
        const fileURL = path.join(filterURL, 'non-existing-file.txt');
        const errorMessages = [
            "Failed to resolve the include directive '!#include non-existing-file.txt'",
            `URL: '${filterURL}'`,
            'Context:',
            '\t! License: http://creativecommons.org/licenses/by-sa/3.0/',
            '\t!',
            '\t!#if adguard',
            '\t!#include non-existing-file.txt',
            `\tError: ENOENT: no such file or directory, open '${fileURL}'`,
        ];
        await expect(
            builder.build(badFiltersDir, null, null, platformsDir, platformsConfigFile, [9]),
        ).rejects.toThrow(`${errorMessages.join('\n')}\n`);
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

describe('check include directive function', () => {
    describe('valid ignoreTrustLevel option -- same origin file', () => {
        const testCases = [
            {
                actual: '@include ./resources/filters/common.txt /ignoreTrustLevel',
                expectedShouldIgnore: true,
            },
            {
                actual: '@include ./resources/filters/common.txt /stripComments',
                expectedShouldIgnore: false,
            },
            {
                actual: '@include ./resources/filters/cname_trackers.txt /addModifiers="script,redirect=noopjs" /ignoreTrustLevel',
                expectedShouldIgnore: true,
            },
            {
                actual: '@include ./resources/filters/cname_trackers.txt /addModifiers="script,redirect=noopjs"',
                expectedShouldIgnore: false,
            },
        ];

        test.each(testCases)('$actual', async ({ actual, expectedShouldIgnore }) => {
            // const includedData = await builder.include(actual, [], path.dirname(__filename));
            const includedData = await builder.include(
                path.dirname(__filename),
                actual,
                [],
            );
            expect(includedData.shouldIgnoreTrustLevel).toEqual(expectedShouldIgnore);
        });
    });

    it('invalid ignoreTrustLevel option -- no same origin file', async () => {
        const fileUrl = 'https://raw.githubusercontent.com/AdguardTeam/AdguardFilters/master/ExperimentalFilter/sections/English/common_js.txt';
        const actual = `@include "${fileUrl}" /ignoreTrustLevel`;
        await expect(
            builder.include(path.dirname(__filename), actual, []),
        ).rejects.toThrow(/Trust level ignoring option is not supported for external includes/);
    });
});

describe('apply platformsExcluded directive during limited filters list build', () => {
    beforeAll(async () => {
        expect(builder).toBeTruthy();
        const platformsConfig = await getPlatformsConfig();

        // remove platformsDir if it exists
        if (existsSync(platformsDir)) {
            await fs.rmdir(platformsDir, { recursive: true });
        }

        const filtersToBuild = [2, 3];
        await builder.build(filtersDir, logFile, reportFile, platformsDir, platformsConfig, filtersToBuild);
    });

    // check that filter 2 and 4 are built for mac platform
    // but filter 3 should be excluded
    it('platform/mac', async () => {
        const platform = 'mac';
        const platformDirPath = path.join(platformsDir, platform);

        const filterContent2 = existsSync(path.join(platformDirPath, 'filters', '2.txt'));
        expect(filterContent2).toBeTruthy();
        const filterContent3 = existsSync(path.join(platformDirPath, 'filters', '3.txt'));
        expect(filterContent3).toBeFalsy();

        // check the same for the metadata
        const metadataContent = await readFile(path.join(platformDirPath, 'filters.json'));
        const metadata = JSON.parse(metadataContent);
        expect(metadata).toBeTruthy();
        expect(metadata.filters.some((f) => f.filterId === 2)).toBeTruthy();
        expect(metadata.filters.some((f) => f.filterId === 3)).toBeFalsy();

        // check the same for translations metadata
        const i18nMetadataContent = await readFile(path.join(platformDirPath, 'filters_i18n.json'));
        const i18nMetadata = JSON.parse(i18nMetadataContent);
        expect(i18nMetadata).toBeTruthy();
        const localizedFilterIds = Object.keys(i18nMetadata.filters);
        expect(localizedFilterIds.includes('2')).toBeTruthy();
        expect(localizedFilterIds.includes('3')).toBeFalsy();
    });

    // at the same time all filters should be built a platform which is not excluded
    it('platform/edge', async () => {
        const platform = 'edge';
        const platformDirPath = path.join(platformsDir, platform);

        const filterContent2 = existsSync(path.join(platformDirPath, 'filters', '2.txt'));
        expect(filterContent2).toBeTruthy();
        const filterContent3 = existsSync(path.join(platformDirPath, 'filters', '3.txt'));
        expect(filterContent3).toBeTruthy();

        // check the same for the metadata
        const metadataContent = await readFile(path.join(platformDirPath, 'filters.json'));
        const metadata = JSON.parse(metadataContent);
        expect(metadata).toBeTruthy();
        expect(metadata.filters.some((f) => f.filterId === 2)).toBeTruthy();
        expect(metadata.filters.some((f) => f.filterId === 3)).toBeTruthy();

        // check the same for translations metadata
        const i18nMetadataContent = await readFile(path.join(platformDirPath, 'filters_i18n.json'));
        const i18nMetadata = JSON.parse(i18nMetadataContent);
        expect(i18nMetadata).toBeTruthy();
        const localizedFilterIds = Object.keys(i18nMetadata.filters);
        expect(localizedFilterIds.includes('2')).toBeTruthy();
        expect(localizedFilterIds.includes('3')).toBeTruthy();
    });
});
