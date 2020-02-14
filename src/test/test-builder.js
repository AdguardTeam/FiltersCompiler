/* globals require, QUnit, __dirname */


const path = require('path');
const fs = require('fs');

QUnit.test("Test builder", async (assert) => {
    'use strict';

    const readFile = function (path) {
        try {
            return fs.readFileSync(path, {encoding: 'utf-8'});
        } catch (e) {
            return null;
        }
    };

    const optimization = require("../main/optimization.js");
    optimization.disableOptimization();

    const builder = require("../main/builder.js");
    assert.ok(builder);

    const filtersDir = path.join(__dirname, './resources/filters');
    const logFile = path.join(__dirname, './resources/log.txt');
    await builder.build(filtersDir, logFile);

    let revision = readFile(path.join(filtersDir, 'filter_3_Test', 'revision.json'));
    assert.ok(revision);
    //
    revision = JSON.parse(revision);
    assert.ok(revision.version);
    assert.ok(revision.timeUpdated);

    const filterText = readFile(path.join(filtersDir, 'filter_3_Test', 'filter.txt')).trim();
    assert.ok(filterText);

    const os = require('os');

    let filterLines = filterText.split(os.EOL);
    assert.equal(filterLines.length, 23);

    //Common include
    assert.ok(filterLines.indexOf('! some common rules could be places here') >= 0);
    assert.ok(filterLines.indexOf('test-common-rule.com') >= 0);
    assert.ok(filterLines.indexOf('test-common-rule.com$xmlhttprequest') >= 0);
    assert.ok(filterLines.indexOf('example.com#$#h1 { background-color: blue !important }') >= 0);

    //Check replace version comment
    assert.notOk(filterLines.indexOf('! Version: 11.9090.19.19') >= 0);
    assert.ok(filterLines.indexOf('! OriginalVersion: 11.9090.19.19') >= 0);

    //Common_1 include
    assert.ok(filterLines.indexOf('test-common-1-rule.com') >= 0);

    //Exclude_1
    assert.notOk(filterLines.indexOf('test-common-1-rule.com$xmlhttprequest') >= 0);
    //Strip comments
    assert.notOk(filterLines.indexOf('! some common rules could be places here, but comment are stripped') >= 0);

    //Exclude
    assert.ok(filterLines.indexOf('||test.com^') >= 0);
    assert.notOk(filterLines.indexOf('#%#test.com^$third-party') >= 0);
    assert.notOk(filterLines.indexOf('||test.com^$third-party') >= 0);
    assert.notOk(filterLines.indexOf('||test.com^$replace=') >= 0);
    assert.notOk(filterLines.indexOf('regularexpressionexcluded') >= 0);
    assert.ok(filterLines.indexOf('regularexpression_not_excluded') >= 0);

    let filterContent = readFile(path.join(__dirname, 'resources/platforms/test', 'filters', '5.txt'));
    filterLines = filterContent.split('\r\n');
    assert.equal(filterLines.length, 34);

    assert.ok(filterLines.indexOf('||adsnet.com/*/700x350.gif$domain=example.com') >= 0);
    assert.ok(filterLines.indexOf('example.com##+js(set-constant.js, ads, false)') >= 0);
    assert.ok(filterLines.indexOf('test.com##+js(abort-on-property-read.js, adsShown)') >= 0);
    assert.ok(filterLines.indexOf('example.com##+js(disable-newtab-links.js)') >= 0);
    assert.ok(filterLines.indexOf('test.com#@#+js(abort-on-property-read.js, some.prop)') >= 0);
    assert.ok(filterLines.indexOf('||www.ynet.co.il^$important,websocket,~third-party,domain=www.ynet.co.il') >= 0);
    assert.ok(filterLines.indexOf('example.com$$script[tag-content="12313"][max-length="262144"]') >= 0);
    assert.ok(filterLines.indexOf('rybnik.com.pl##^iframe[name]:not([class]):not([id]):not([src])[style="display:none"]') === -1);
    assert.ok(filterLines.indexOf('test.com#%#AG_setConstant("ads", "false");') ===  -1);
    assert.ok(filterLines.indexOf('test.com#@%#Object.defineProperty(window, \'abcde\', { get: function() { return []; } });') ===  -1);
    assert.ok(filterLines.indexOf('||example.com/api/v1/ad/*/json$replace=/html/abcd\\,/i') ===  -1);
    assert.ok(filterLines.indexOf('||adsnet.com/*/700x350.gif$domain=example.com') >= 0);

    filterContent = readFile(path.join(__dirname, 'resources/platforms/test2', 'filters', '5.txt'));
    filterLines = filterContent.split('\r\n');
    assert.equal(filterLines.length, 34);
    assert.ok(filterLines.indexOf('test.com#%#//scriptlet("abp-abort-on-property-read", "adsShown")') >= 0);
    assert.ok(filterLines.indexOf('example.com#@%#//scriptlet("abp-abort-on-property-write", "adblock.check")') >= 0);
    assert.ok(filterLines.indexOf('example.com#%#//scriptlet("ubo-disable-newtab-links.js")') >= 0);
    assert.ok(filterLines.indexOf('test.com#@%#//scriptlet("ubo-abort-on-property-read.js", "some.prop")') >= 0);
    assert.ok(filterLines.indexOf('example.com#%#//scriptlet("ubo-set-constant.js", "ads", "false")') >= 0);
    assert.ok(filterLines.indexOf('example.com#%#//scriptlet("ubo-disable-newtab-links.js")') >= 0);
    assert.ok(filterLines.indexOf('example.com#%#//scriptlet("set-constant", "ads", "false")') >= 0);
    assert.ok(filterLines.indexOf('example.com$$script[tag-content="12313"][max-length="262144"]') >= 0);
    assert.ok(filterLines.indexOf('||www.ynet.co.il^$important,websocket,~third-party,domain=www.ynet.co.il') >= 0);
});

QUnit.test("Test builder - build lists", async (assert) => {
    'use strict';

    const readFile = function (path) {
        try {
            return fs.readFileSync(path, {encoding: 'utf-8'});
        } catch (e) {
            return null;
        }
    };

    const optimization = require("../main/optimization.js");
    optimization.disableOptimization();

    const builder = require("../main/builder.js");
    assert.ok(builder);

    const filtersDir = path.join(__dirname, './resources/filters');
    const logFile = path.join(__dirname, './resources/log.txt');

    await builder.build(filtersDir, logFile, null, null, null, [2, 3]);

    let revision = readFile(path.join(filtersDir, 'filter_2_English', 'revision.json'));
    assert.ok(revision);

    await builder.build(filtersDir, logFile, null, null, null, null, [3, 4]);

    revision = readFile(path.join(filtersDir, 'filter_2_English', 'revision.json'));
    assert.ok(revision);

    await builder.build(filtersDir, logFile, null, null, null, [2, 3], [3, 4]);

    revision = readFile(path.join(filtersDir, 'filter_2_English', 'revision.json'));
    assert.ok(revision);
});

QUnit.test("Test builder - platforms", async (assert) => {
    'use strict';

    const path = require('path');
    const fs = require('fs');

    const readFile = function (path) {
        try {
            return fs.readFileSync(path, {encoding: 'utf-8'});
        } catch (e) {
            return null;
        }
    };

    const optimization = require("../main/optimization.js");
    optimization.disableOptimization();

    const builder = require("../main/builder.js");
    const generator = require("../main/platforms/generator.js");

    const filtersDir = path.join(__dirname, './resources/filters');
    const logFile = path.join(__dirname, './resources/log_platforms.txt');
    const platforms = path.join(__dirname, './resources/platforms');
    const platformsConfig = path.join(__dirname, './resources/platforms.json');
    await builder.build(filtersDir, logFile, null, platforms, platformsConfig);

    const filterText = readFile(path.join(filtersDir, 'filter_3_Test', 'filter.txt'));
    assert.ok(filterText);

    let filtersMetadata = readFile(path.join(platforms, 'test', 'filters.json'));
    assert.ok(filtersMetadata);
    filtersMetadata = JSON.parse(filtersMetadata);
    assert.ok(filtersMetadata.filters);
    assert.ok(filtersMetadata.filters[0]);
    assert.equal(filtersMetadata.filters[0].filterId, 2);
    assert.equal(filtersMetadata.filters[0].name, 'English Filter');
    assert.equal(filtersMetadata.filters[0].description, 'English Filter description');
    assert.ok(filtersMetadata.filters[0].timeAdded);
    assert.equal(filtersMetadata.filters[0].homepage, 'https://easylist.adblockplus.org/');
    assert.equal(filtersMetadata.filters[0].expires, 172800);
    assert.equal(filtersMetadata.filters[0].displayNumber, 101);
    assert.equal(filtersMetadata.filters[0].groupId, 2);
    assert.equal(filtersMetadata.filters[0].subscriptionUrl, 'https://filters.adtidy.org/test/filters/2.txt');
    assert.ok(filtersMetadata.filters[0].version);
    assert.ok(filtersMetadata.filters[0].timeUpdated);
    assert.ok(/\d\d-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d\d\d/.test(filtersMetadata.filters[0].timeUpdated));
    assert.equal(filtersMetadata.filters[0].languages.length, 2);
    assert.equal(filtersMetadata.filters[0].languages[0], 'en');
    assert.equal(filtersMetadata.filters[0].languages[1], 'pl');
    assert.equal(filtersMetadata.filters[0].tags.length, 4);
    assert.equal(filtersMetadata.filters[0].tags[0], 1);
    assert.equal(filtersMetadata.filters[0].trustLevel, 'full');

    let filtersI18nMetadata = readFile(path.join(platforms, 'test', 'filters_i18n.json'));
    assert.ok(filtersI18nMetadata);

    let localScriptRules = readFile(path.join(platforms, 'test', 'local_script_rules.txt'));
    assert.ok(localScriptRules);
    let localScriptRulesLines = localScriptRules.split('\r\n');
    assert.ok(localScriptRulesLines.indexOf('test_domain#%#testScript();') >= 0);

    let localScriptRulesJson = readFile(path.join(platforms, 'test', 'local_script_rules.json'));
    assert.ok(localScriptRulesJson);
    localScriptRulesJson = JSON.parse(localScriptRulesJson);
    assert.ok(localScriptRulesJson.comment);
    assert.ok(localScriptRulesJson.rules);
    assert.ok(localScriptRulesJson.rules[0]);
    assert.equal(localScriptRulesJson.rules[0].domains, 'test_domain');
    assert.equal(localScriptRulesJson.rules[0].script, 'testScript();');

    let filterContent = readFile(path.join(platforms, 'test', 'filters', '2.txt'));
    assert.ok(filterContent);

    let filterLines = filterContent.split('\r\n');
    assert.equal(filterLines.length, 40);

    assert.ok(filterLines.indexOf('![Adblock Plus 2.0]') >= 0);
    assert.ok(filterLines.indexOf('test-common-rule.com') >= 0);
    assert.ok(filterLines.indexOf('test-common-1-rule.com') >= 0);
    assert.ok(filterLines.indexOf('! some common rules could be places here') >= 0);
    assert.ok(filterLines.indexOf('~nigma.ru,google.com$$div[id=\"ad_text\"][wildcard=\"*teasernet*tararar*\"]') >= 0);
    assert.ok(filterLines.indexOf('excluded_platform') >= 0);
    assert.ok(filterLines.indexOf('test_domain#%#testScript();') >= 0);
    assert.ok(filterLines.indexOf('!+ NOT_OPTIMIZED') >= 0);
    assert.ok(filterLines.indexOf('test-common-2-rule.com') >= 0);

    filterContent = readFile(path.join(platforms, 'config/test', 'filters', '2.txt'));
    assert.ok(filterContent);

    filterLines = filterContent.split('\r\n');
    assert.equal(filterLines.length, 24);

    assert.ok(filterLines.indexOf('test-common-rule.com') >= 0);
    assert.notOk(filterLines.indexOf('test-common-1-rule.com') >= 0);
    assert.notOk(filterLines.indexOf('! some common rules could be places here') >= 0);
    assert.notOk(filterLines.indexOf('~nigma.ru,google.com$$div[id=\"ad_text\"][wildcard=\"*teasernet*tararar*\"]') >= 0);
    assert.ok(filterLines.indexOf('excluded_platform') >= 0);
    assert.ok(filterLines.indexOf('test_domain#%#testScript();') >= 0);


    filterContent = readFile(path.join(platforms, 'hints', 'filters', '2.txt'));
    assert.ok(filterContent);

    filterLines = filterContent.split('\r\n');
    assert.equal(filterLines.length, 35);

    assert.ok(filterLines.indexOf('test-common-rule.com') >= 0);
    assert.ok(filterLines.indexOf('test-common-1-rule.com') >= 0);
    assert.ok(filterLines.indexOf('! some common rules could be places here') >= 0);
    assert.ok(filterLines.indexOf('~nigma.ru,google.com$$div[id=\"ad_text\"][wildcard=\"*teasernet*tararar*\"]') >= 0);
    assert.ok(filterLines.indexOf('excluded_platform') >= 0);
    assert.ok(filterLines.indexOf('test_domain#%#testScript();') >= 0);

    //Check MAC platform
    let filtersMetadataMAC = readFile(path.join(platforms, 'mac', 'filters.json'));
    assert.ok(filtersMetadataMAC);
    filtersMetadataMAC = JSON.parse(filtersMetadataMAC);
    assert.equal(Object.keys(filtersMetadataMAC).length, 2);

    assert.ok(filtersMetadataMAC.groups);
    let group = filtersMetadataMAC.groups[0];
    assert.ok(group);
    assert.equal(Object.keys(group).length, 3);
    assert.equal(group.groupId, 1);
    assert.equal(group.groupName, "Adguard Filters");
    assert.equal(group.displayNumber, 1);

    assert.equal(filtersMetadataMAC.tags, undefined);

    assert.ok(filtersMetadataMAC.filters);
    let englishFilter = filtersMetadataMAC.filters[0];
    assert.ok(englishFilter);
    assert.equal(Object.keys(englishFilter).length, 12);

    assert.equal(englishFilter.filterId, 2);
    assert.equal(englishFilter.name, 'English Filter');
    assert.equal(englishFilter.description, 'English Filter description');
    assert.equal(englishFilter.timeAdded, undefined);
    assert.equal(englishFilter.homepage, 'https://easylist.adblockplus.org/');
    assert.equal(englishFilter.expires, 172800);
    assert.equal(englishFilter.displayNumber, 101);
    assert.equal(englishFilter.groupId, 2);
    assert.equal(englishFilter.subscriptionUrl, 'https://filters.adtidy.org/mac/filters/2.txt');
    assert.ok(englishFilter.version);
    assert.ok(englishFilter.timeUpdated);
    assert.equal(englishFilter.languages.length, 2);
    assert.equal(englishFilter.languages[0], 'en');
    assert.equal(englishFilter.languages[1], 'pl');
    assert.equal(englishFilter.tags, undefined);

    let filtersI18nMetadataMAC = readFile(path.join(platforms, 'mac', 'filters_i18n.json'));
    assert.ok(filtersI18nMetadataMAC);
    filtersI18nMetadataMAC = JSON.parse(filtersI18nMetadataMAC);
    assert.ok(filtersI18nMetadataMAC);

    assert.equal(Object.keys(filtersI18nMetadataMAC).length, 2);
    assert.ok(filtersMetadataMAC.groups);
    assert.equal(filtersMetadataMAC.tags, undefined);
    assert.ok(filtersMetadataMAC.filters);

    //Check conditions
    assert.notOk(filterLines.indexOf('!#if adguard') >= 0);
    assert.notOk(filterLines.indexOf('!#endif') >= 0);
    assert.notOk(filterLines.indexOf('if_not_adguard_rule') >= 0);
    assert.ok(filterLines.indexOf('if_adguard_included_rule') >= 0);
    assert.ok(filterLines.indexOf('if_adguard_rule') >= 0);

    // wrong condition
    assert.notOk(filterLines.indexOf('wrong_condition') >= 0);

    //Check includes
    assert.notOk(filterLines.indexOf('!#include') >= 0);

    // platform specify includes
    filterContent = readFile(path.join(platforms, 'mac', 'filters', '4_optimized.txt'));
    assert.ok(filterContent);

    filterLines = filterContent.split('\r\n');
    assert.equal(filterLines.length, 13);
    assert.ok(filterLines.indexOf('if_mac_included_rule') < 0);

    // do not remove directives while stripped comment. `directives_not_stripped` rule should not remain
    assert.notOk(filterLines.indexOf('directives_not_stripped') >= 0);

    //Check condition directives for platforms
    filterContent = readFile(path.join(platforms, 'test', 'filters', '4.txt'));
    assert.ok(filterContent);

    filterLines = filterContent.split('\r\n');
    assert.equal(filterLines.length, 23);
    assert.ok(filterLines.indexOf('if_not_ublock') < 0);

    filterContent = readFile(path.join(platforms, 'test', 'filters', '4_optimized.txt'));
    assert.ok(filterContent);

    filterLines = filterContent.split('\r\n');
    assert.equal(filterLines.length, 13);
    assert.ok(filterLines.indexOf('if_not_ublock') < 0);

});
