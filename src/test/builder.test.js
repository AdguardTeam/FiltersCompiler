/* eslint-disable max-len */
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const optimization = require('../main/optimization.js');
const builder = require('../main/builder.js');

// Mock log to hide error messages
jest.mock('../main/utils/log');

const readFile = (path) => {
    try {
        return fs.readFile(path, { encoding: 'utf-8' });
    } catch (e) {
        return null;
    }
};

describe('Test builder', () => {
    it('Works', async () => {
        optimization.disableOptimization();

        expect(builder).toBeTruthy();

        const filtersDir = path.join(__dirname, './resources/filters');
        const logFile = path.join(__dirname, './resources/log.txt');
        const reportFile = path.join(__dirname, './resources/report.txt');
        const platformsPath = path.join(__dirname, './resources/platforms');
        const platformsConfigFile = path.join(__dirname, './resources/platforms.json');

        await builder.build(filtersDir, logFile, reportFile, platformsPath, platformsConfigFile);

        let revision = await readFile(path.join(filtersDir, 'filter_3_Test', 'revision.json'));

        expect(revision).toBeTruthy();

        revision = JSON.parse(revision);
        expect(revision.version).toBeTruthy();
        expect(revision.timeUpdated).toBeTruthy();

        const filterText = (await readFile(path.join(filtersDir, 'filter_3_Test', 'filter.txt'))).trim();
        expect(filterText).toBeTruthy();

        let filterLines = filterText.split(os.EOL);
        expect(filterLines.length).toBe(23);

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

        let filterContent = await readFile(path.join(__dirname, 'resources/platforms/test', 'filters', '5.txt'));
        filterLines = filterContent.split('\r\n');
        expect(filterLines.length).toBe(52);

        expect(filterLines.includes('||adsnet.com/*/700x350.gif$domain=example.com')).toBeTruthy();
        expect(filterLines.includes('example.com##+js(set-constant, ads, false)')).toBeTruthy();
        expect(filterLines.includes('test.com##+js(abort-on-property-read, adsShown)')).toBeTruthy();
        expect(filterLines.includes('example.com##+js(disable-newtab-links)')).toBeTruthy();
        expect(filterLines.includes('test.com#@#+js(abort-on-property-read, some.prop)')).toBeTruthy();
        expect(filterLines.includes('||www.ynet.co.il^$important,websocket,~third-party,domain=www.ynet.co.il')).toBeTruthy();
        expect(filterLines.includes('example.com$$script[tag-content="12313"][max-length="262144"]')).toBeTruthy();
        expect(filterLines.includes('rybnik.com.pl##^iframe[name]:not([class]):not([id]):not([src])[style="display:none"]')).toBeFalsy();
        expect(filterLines.includes('test.com#%#AG_setConstant("ads", "false");')).toBeFalsy();
        expect(filterLines.includes('test.com#@%#Object.defineProperty(window, \'abcde\', { get: function() { return []; } });')).toBeFalsy();
        expect(filterLines.includes('||example.com/api/v1/ad/*/json$replace=/html/abcd\\,/i')).toBeFalsy();
        expect(filterLines.includes('||adsnet.com/*/700x350.gif$domain=example.com')).toBeTruthy();
        expect(filterLines.includes('||example.com/banner$image,redirect=3x2.png')).toBeTruthy();
        expect(filterLines.includes('||test.com^$script,redirect=noop.js')).toBeTruthy();
        expect(filterLines.includes('||example.com/*.mp4$media,redirect=noop-1s.mp4')).toBeTruthy();

        filterContent = await readFile(path.join(__dirname, 'resources/platforms/test2', 'filters', '5.txt'));
        filterLines = filterContent.split('\r\n');
        expect(filterLines.length).toBe(52);

        expect(filterLines.includes('test.com#%#//scriptlet(\'abp-abort-on-property-read\', \'adsShown\')')).toBeTruthy();
        expect(filterLines.includes('example.com#@%#//scriptlet(\'abp-abort-on-property-write\', \'adblock.check\')')).toBeTruthy();
        expect(filterLines.includes('test.com#@%#//scriptlet(\'ubo-abort-on-property-read.js\', \'some.prop\')')).toBeTruthy();
        expect(filterLines.includes('example.com#%#//scriptlet(\'ubo-disable-newtab-links.js\')')).toBeTruthy();
        expect(filterLines.includes('example.com#%#//scriptlet(\'ubo-set-constant.js\', \'ads\', \'false\')')).toBeTruthy();
        expect(filterLines.includes('example.com$$script[tag-content="12313"][max-length="262144"]')).toBeTruthy();
        expect(filterLines.includes('||www.ynet.co.il^$important,websocket,~third-party,domain=www.ynet.co.il')).toBeTruthy();
        expect(filterLines.includes('||example.com/banner$image,redirect=3x2-transparent.png')).toBeTruthy();
        expect(filterLines.includes('||test.com^$script,redirect=noopjs')).toBeTruthy();
        expect(filterLines.includes('||example.com/*.mp4$media,redirect=noopmp4-1s')).toBeTruthy();

        filterContent = await readFile(path.join(__dirname, 'resources/platforms/ios', 'filters', '5.txt'));
        filterLines = filterContent.split('\r\n');
        expect(filterLines.length).toBe(47);

        expect(filterLines.includes('||example.com/images/*.mp4')).toBeTruthy();
        expect(filterLines.includes('test.com,mp4upload.com###overlay')).toBeTruthy();

        expect(filterLines.includes('||example.com/test/$media,mp4,domain=test.com')).toBeFalsy();
        expect(filterLines.includes('||test.com/cams/video_file/*.mp4$media,mp4')).toBeFalsy();
        expect(filterLines.includes('||example.com/test/$media,redirect=noopmp4-1s,domain=test.com')).toBeFalsy();
        expect(filterLines.includes('||test.com/cams/video_file/*.mp4$media,redirect=noopmp4-1s')).toBeFalsy();
        expect(filterLines.includes('||test.com/res/js/*.js$replace=/\\"OK\\/banners/\\"OK\\/banners__\\//')).toBeFalsy();
        expect(filterLines.includes('||example.com^$~script,~stylesheet,~xmlhttprequest,replace=/popunder_url/popunder_url_/')).toBeFalsy();
        expect(filterLines.includes('||test.com/Forums2008/JS/replaceLinks.js')).toBeTruthy();
        expect(filterLines.includes('@@||test.com^$generichide,app=iexplore.exe')).toBeFalsy();
        expect(filterLines.includes('example.com##div.grid_1[class$="app"]')).toBeTruthy();
        expect(filterLines.indexOf('||app-test.com^$third-party')).toBeTruthy();
    });

    it('Builds lists', async () => {
        optimization.disableOptimization();
        expect(builder).toBeTruthy();

        const filtersDir = path.join(__dirname, './resources/filters');
        const logFile = path.join(__dirname, './resources/log.txt');
        const reportFile = path.join(__dirname, './resources/report.txt');

        await builder.build(filtersDir, logFile, reportFile, null, null, null, [2, 3]);

        let revision = await readFile(path.join(filtersDir, 'filter_2_English', 'revision.json'));
        expect(revision).toBeTruthy();

        await builder.build(filtersDir, logFile, reportFile, null, null, null, null, [3, 4]);

        revision = await readFile(path.join(filtersDir, 'filter_2_English', 'revision.json'));
        expect(revision).toBeTruthy();

        await builder.build(filtersDir, logFile, reportFile, null, null, null, [2, 3], [3, 4]);

        revision = await readFile(path.join(filtersDir, 'filter_2_English', 'revision.json'));
        expect(revision).toBeTruthy();
    });

    it('Builds platforms', async () => {
        optimization.disableOptimization();

        const filtersDir = path.join(__dirname, './resources/filters');
        const logFile = path.join(__dirname, './resources/log_platforms.txt');
        const reportFile = path.join(__dirname, './resources/report_platforms.txt');
        const platforms = path.join(__dirname, './resources/platforms');
        const platformsConfig = path.join(__dirname, './resources/platforms.json');
        await builder.build(filtersDir, logFile, reportFile, null, platforms, platformsConfig);

        const filterText = await readFile(path.join(filtersDir, 'filter_3_Test', 'filter.txt'));
        expect(filterText).toBeTruthy();

        let filtersMetadata = await readFile(path.join(platforms, 'test', 'filters.json'));
        expect(filtersMetadata).toBeTruthy();
        filtersMetadata = JSON.parse(filtersMetadata);
        expect(filtersMetadata.filters).toBeTruthy();
        expect(filtersMetadata.filters[0]).toBeTruthy();
        expect(filtersMetadata.filters[0].filterId).toBe(2);
        expect(filtersMetadata.filters[0].name).toBe('AdGuard Base filter');
        expect(filtersMetadata.filters[0].description).toBe('EasyList + AdGuard English filter. This filter is necessary for quality ad blocking.');
        expect(filtersMetadata.filters[0].timeAdded).toBeTruthy();
        expect(filtersMetadata.filters[0].homepage).toBe('https://easylist.adblockplus.org/');
        expect(filtersMetadata.filters[0].expires).toBe(172800);
        expect(filtersMetadata.filters[0].displayNumber).toBe(101);
        expect(filtersMetadata.filters[0].groupId).toBe(2);
        expect(filtersMetadata.filters[0].subscriptionUrl).toBe('https://filters.adtidy.org/test/filters/2.txt');
        expect(filtersMetadata.filters[0].version).toBeTruthy();
        expect(filtersMetadata.filters[0].timeUpdated).toBeTruthy();
        expect(/\d\d-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d\d\d/.test(filtersMetadata.filters[0].timeUpdated)).toBeTruthy();
        expect(filtersMetadata.filters[0].languages.length).toBe(2);
        expect(filtersMetadata.filters[0].languages[0]).toBe('en');
        expect(filtersMetadata.filters[0].languages[1]).toBe('pl');
        expect(filtersMetadata.filters[0].tags.length).toBe(4);
        expect(filtersMetadata.filters[0].tags[0]).toBe(1);
        expect(filtersMetadata.filters[0].trustLevel).toBe('full');

        // Obsolete Filter test
        expect(filtersMetadata.filters.some((filter) => filter.filterId === 6)).toBeFalsy();
        expect(filtersMetadata.filters.some((filter) => filter.name === 'Obsolete Test Filter')).toBeFalsy();

        let filtersI18nMetadata = await readFile(path.join(platforms, 'test', 'filters_i18n.json'));
        expect(filtersI18nMetadata).toBeTruthy();
        filtersI18nMetadata = JSON.parse(filtersI18nMetadata);
        const filtersI18nMetadataFilters = Object.keys(filtersI18nMetadata.filters);

        // Obsolete Filter test
        expect(filtersI18nMetadataFilters.some((filter) => filter === '6')).toBeFalsy();

        const localScriptRules = await readFile(path.join(platforms, 'test', 'local_script_rules.txt'));
        expect(localScriptRules).toBeFalsy();
        const localScriptRulesLines = localScriptRules.split('\r\n');
        expect(localScriptRulesLines.indexOf('test_domain#%#testScript();') === -1).toBeTruthy();

        let localScriptRulesJson = await readFile(path.join(platforms, 'test', 'local_script_rules.json'));
        expect(localScriptRulesJson).toBeTruthy();
        localScriptRulesJson = JSON.parse(localScriptRulesJson);
        expect(localScriptRulesJson.comment).toBeTruthy();
        expect(localScriptRulesJson.rules).toBeTruthy();

        let filterContent = await readFile(path.join(platforms, 'test', 'filters', '2.txt'));
        expect(filterContent).toBeTruthy();

        let filterLines = filterContent.split('\r\n');
        expect(filterLines.length).toBe(40);

        expect(filterLines[2]).toBe('! Title: AdGuard Base filter + EasyList');
        expect(filterLines.indexOf('![Adblock Plus 2.0]') >= 0).toBeTruthy();
        expect(filterLines.indexOf('test-common-rule.com') >= 0).toBeTruthy();
        expect(filterLines.indexOf('test-common-1-rule.com') >= 0).toBeTruthy();
        expect(filterLines.indexOf('! some common rules could be places here') >= 0).toBeTruthy();
        expect(filterLines.indexOf('~nigma.ru,google.com$$div[id=\"ad_text\"][wildcard=\"*teasernet*tararar*\"]') >= 0).toBeTruthy();
        expect(filterLines.indexOf('excluded_platform') >= 0).toBeTruthy();
        expect(filterLines.indexOf('test_domain#%#testScript();') === -1).toBeTruthy();
        expect(filterLines.indexOf('!+ NOT_OPTIMIZED') >= 0).toBeTruthy();
        expect(filterLines.indexOf('test-common-2-rule.com') >= 0).toBeTruthy();
        expect(filterLines.indexOf('test.com#%#var isadblock=1;') === -1).toBeTruthy();
        expect(filterLines.indexOf('example.com#%#AG_onLoad(function() { AG_removeElementBySelector(\'span[class="intexta"]\'); });') === -1).toBeTruthy();
        expect(filterLines.indexOf('test.com##+js(abort-on-property-read, Object.prototype.getBanner)') >= 0).toBeTruthy();

        filterContent = await readFile(path.join(platforms, 'test', 'filters', '2_optimized.txt'));
        expect(filterContent).toBeTruthy();
        filterLines = filterContent.split('\r\n');
        expect(filterLines.length).toBe(26);
        expect(filterLines[2]).toBe('! Title: AdGuard Base filter + EasyList (Optimized)');

        filterContent = await readFile(path.join(platforms, 'test', 'filters', '2_without_easylist.txt'));
        expect(filterContent).toBeTruthy();
        filterLines = filterContent.split('\r\n');
        expect(filterLines.length).toBe(28);
        expect(filterLines[2]).toBe('! Title: AdGuard Base filter');

        filterContent = await readFile(path.join(platforms, 'config/test', 'filters', '2.txt'));
        expect(filterContent).toBeTruthy();

        filterLines = filterContent.split('\r\n');
        expect(filterLines.length).toBe(27);

        expect(filterLines.indexOf('test-common-rule.com') >= 0).toBeTruthy();
        expect(filterLines.indexOf('test-common-1-rule.com') >= 0).toBeFalsy();
        expect(filterLines.indexOf('! some common rules could be places here') >= 0).toBeFalsy();
        expect(filterLines.indexOf('~nigma.ru,google.com$$div[id=\"ad_text\"][wildcard=\"*teasernet*tararar*\"]') >= 0).toBeFalsy();
        expect(filterLines.indexOf('excluded_platform') >= 0).toBeTruthy();
        expect(filterLines.indexOf('test_domain#%#testScript();') >= 0).toBeTruthy();


        filterContent = await readFile(path.join(platforms, 'hints', 'filters', '2.txt'));
        expect(filterContent).toBeTruthy();

        filterLines = filterContent.split('\r\n');
        expect(filterLines.length).toBe(39);

        expect(filterLines.indexOf('test-common-rule.com') >= 0).toBeTruthy();
        expect(filterLines.indexOf('test-common-1-rule.com') >= 0).toBeTruthy();
        expect(filterLines.indexOf('! some common rules could be places here') >= 0).toBeTruthy();
        expect(filterLines.indexOf('~nigma.ru,google.com$$div[id=\"ad_text\"][wildcard=\"*teasernet*tararar*\"]') >= 0).toBeTruthy();
        expect(filterLines.indexOf('excluded_platform') >= 0).toBeTruthy();
        expect(filterLines.indexOf('test_domain#%#testScript();') >= 0).toBeTruthy();

        // Check MAC platform
        let filtersMetadataMAC = await readFile(path.join(platforms, 'mac', 'filters.json'));
        expect(filtersMetadataMAC).toBeTruthy();
        filtersMetadataMAC = JSON.parse(filtersMetadataMAC);
        expect(Object.keys(filtersMetadataMAC).length).toEqual(2);

        expect(filtersMetadataMAC.groups).toBeTruthy();
        const group = filtersMetadataMAC.groups[0];
        expect(group).toBeTruthy();
        expect(Object.keys(group).length).toBe(3);
        expect(group.groupId).toBe(1);
        expect(group.groupName).toBe('Adguard Filters');
        expect(group.displayNumber).toBe(1);

        expect(filtersMetadataMAC.tags).toBe(undefined);

        expect(filtersMetadataMAC.filters).toBeTruthy();
        const englishFilter = filtersMetadataMAC.filters[0];
        expect(englishFilter).toBeTruthy();
        expect(Object.keys(englishFilter).length).toBe(11);

        expect(englishFilter.filterId).toBe(2);
        expect(englishFilter.name).toBe('AdGuard Base filter');
        expect(englishFilter.description).toBe('EasyList + AdGuard English filter. This filter is necessary for quality ad blocking.');
        expect(englishFilter.timeAdded).toBe(undefined);
        expect(englishFilter.homepage).toBe('https://easylist.adblockplus.org/');
        expect(englishFilter.expires).toBe(172800);
        expect(englishFilter.displayNumber).toBe(101);
        expect(englishFilter.groupId).toBe(2);
        expect(englishFilter.subscriptionUrl).toBe('https://filters.adtidy.org/mac/filters/2.txt');
        expect(englishFilter.version).toBeTruthy();
        expect(englishFilter.timeUpdated).toBeTruthy();
        expect(englishFilter.languages.length).toBe(2);
        expect(englishFilter.languages[0]).toBe('en');
        expect(englishFilter.languages[1]).toBe('pl');
        expect(englishFilter.tags).toBe(undefined);
        expect(englishFilter.trustLevel).toBe(undefined);

        let filtersI18nMetadataMAC = await readFile(path.join(platforms, 'mac', 'filters_i18n.json'));
        expect(filtersI18nMetadataMAC).toBeTruthy();
        filtersI18nMetadataMAC = JSON.parse(filtersI18nMetadataMAC);
        expect(filtersI18nMetadataMAC).toBeTruthy();

        expect(Object.keys(filtersI18nMetadataMAC).length).toBe(2);
        expect(filtersMetadataMAC.groups).toBeTruthy();
        expect(filtersMetadataMAC.tags).toBe(undefined);
        expect(filtersMetadataMAC.filters).toBeTruthy();

        // Check conditions
        expect(filterLines.indexOf('!#if adguard') >= 0).toBeFalsy();
        expect(filterLines.indexOf('!#endif') >= 0).toBeFalsy();
        expect(filterLines.indexOf('if_not_adguard_rule') >= 0).toBeFalsy();
        expect(filterLines.indexOf('if_adguard_included_rule') >= 0).toBeTruthy();
        expect(filterLines.indexOf('if_adguard_rule') >= 0).toBeTruthy();

        // wrong condition
        expect(filterLines.indexOf('wrong_condition') >= 0).toBeFalsy();

        // Check includes
        expect(filterLines.indexOf('!#include') >= 0).toBeFalsy();

        // platform specify includes
        filterContent = await readFile(path.join(platforms, 'mac', 'filters', '4_optimized.txt'));
        expect(filterContent).toBeTruthy();

        filterLines = filterContent.split('\r\n');
        expect(filterLines.length).toEqual(13);
        expect(filterLines.indexOf('if_mac_included_rule') < 0).toBeTruthy();

        // do not remove directives while stripped comment. `directives_not_stripped` rule should not remain
        expect(filterLines.indexOf('directives_not_stripped') >= 0).toBeFalsy();

        // Check condition directives for platforms
        filterContent = await readFile(path.join(platforms, 'test', 'filters', '4.txt'));
        expect(filterContent).toBeTruthy();

        filterLines = filterContent.split('\r\n');
        expect(filterLines.length).toBe(23);
        expect(filterLines[2].startsWith('! Title:')).toBeTruthy();
        expect(filterLines[2].endsWith('(Optimized)')).toBeFalsy();
        expect(filterLines.indexOf('if_not_ublock') < 0).toBeTruthy();

        filterContent = await readFile(path.join(platforms, 'test', 'filters', '4_optimized.txt'));
        expect(filterContent).toBeTruthy();

        filterLines = filterContent.split('\r\n');
        expect(filterLines.length).toBe(13);
        expect(filterLines[2].startsWith('! Title:')).toBeTruthy();
        expect(filterLines[2].endsWith('(Optimized)')).toBeTruthy();
        expect(filterLines.indexOf('if_not_ublock') < 0).toBeTruthy();

        filterContent = await readFile(path.join(platforms, 'mac', 'filters', '5.txt'));
        expect(filterContent).toBeTruthy();

        filterLines = filterContent.split('\r\n');
        expect(filterLines.length).toBe(51);

        expect(filterLines.indexOf('||example.com^$script,redirect=noopjs') >= 0).toBeTruthy();
        expect(filterLines.indexOf('||example.com/banner$image,redirect=1x1-transparent.gif') >= 0).toBeTruthy();
    });
});
