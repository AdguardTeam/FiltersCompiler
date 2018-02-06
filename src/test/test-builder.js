/* globals require, QUnit, __dirname */

QUnit.test("Test builder", (assert) => {
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

    const generator = require("../main/platforms/generator.js");
    generator.disableOptimization();

    const builder = require("../main/builder.js");
    assert.ok(builder);

    const filtersDir = path.join(__dirname, './resources/filters');
    const logFile = path.join(__dirname, './resources/log.txt');
    builder.build(filtersDir, logFile);

    let revision = readFile(path.join(filtersDir, 'filter_2_English', 'revision.json'));
    assert.ok(revision);
    //
    revision = JSON.parse(revision);
    assert.ok(revision.version);
    assert.ok(revision.timeUpdated);

    const filterText = readFile(path.join(filtersDir, 'filter_2_English', 'filter.txt'));
    assert.ok(filterText);

    const filterLines = filterText.split('\r\n');
    assert.equal(filterLines.length, 26);

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
});

QUnit.test("Test builder - platforms", (assert) => {
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

    const generator = require("../main/platforms/generator.js");
    generator.disableOptimization();

    const builder = require("../main/builder.js");

    const filtersDir = path.join(__dirname, './resources/filters');
    const logFile = path.join(__dirname, './resources/log_platforms.txt');
    const platforms = path.join(__dirname, './resources/platforms');
    const platformsConfig = path.join(__dirname, './resources/platforms.json');
    builder.build(filtersDir, logFile, null, platforms, platformsConfig);

    const filterText = readFile(path.join(filtersDir, 'filter_2_English', 'filter.txt'));
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
    assert.equal(filtersMetadata.filters[0].subscriptionUrl, 'https://easylist-downloads.adblockplus.org/easylist.txt');
    assert.ok(filtersMetadata.filters[0].version);
    assert.ok(filtersMetadata.filters[0].timeUpdated);
    assert.equal(filtersMetadata.filters[0].languages.length, 2);
    assert.equal(filtersMetadata.filters[0].languages[0], 'en');
    assert.equal(filtersMetadata.filters[0].languages[1], 'pl');
    assert.equal(filtersMetadata.filters[0].tags.length, 4);
    assert.equal(filtersMetadata.filters[0].tags[0], 1);

    let filtersI18nMetadata = readFile(path.join(platforms, 'test', 'filters_i18n.json'));
    assert.ok(filtersI18nMetadata);

    let filterContent = readFile(path.join(platforms, 'test', 'filters', '2.txt'));
    assert.ok(filterContent);

    let filterLines = filterContent.split('\r\n');
    assert.equal(filterLines.length, 31);

    assert.ok(filterLines.indexOf('test-common-rule.com') >= 0);
    assert.ok(filterLines.indexOf('test-common-1-rule.com') >= 0);
    assert.ok(filterLines.indexOf('! some common rules could be places here') >= 0);
    assert.ok(filterLines.indexOf('~nigma.ru,google.com$$div[id=\"ad_text\"][wildcard=\"*teasernet*tararar*\"]') >= 0);
    assert.ok(filterLines.indexOf('excluded_platform') >= 0);

    filterContent = readFile(path.join(platforms, 'config/test', 'filters', '2.txt'));
    assert.ok(filterContent);

    filterLines = filterContent.split('\r\n');
    assert.equal(filterLines.length, 14);

    assert.ok(filterLines.indexOf('test-common-rule.com') >= 0);
    assert.notOk(filterLines.indexOf('test-common-1-rule.com') >= 0);
    assert.notOk(filterLines.indexOf('! some common rules could be places here') >= 0);
    assert.notOk(filterLines.indexOf('~nigma.ru,google.com$$div[id=\"ad_text\"][wildcard=\"*teasernet*tararar*\"]') >= 0);
    assert.ok(filterLines.indexOf('excluded_platform') >= 0);


    filterContent = readFile(path.join(platforms, 'hints', 'filters', '2.txt'));
    assert.ok(filterContent);

    filterLines = filterContent.split('\r\n');
    assert.equal(filterLines.length, 27);

    assert.ok(filterLines.indexOf('test-common-rule.com') >= 0);
    assert.ok(filterLines.indexOf('test-common-1-rule.com') >= 0);
    assert.ok(filterLines.indexOf('! some common rules could be places here') >= 0);
    assert.ok(filterLines.indexOf('~nigma.ru,google.com$$div[id=\"ad_text\"][wildcard=\"*teasernet*tararar*\"]') >= 0);
    assert.ok(filterLines.indexOf('excluded_platform') >= 0);

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
    assert.equal(Object.keys(englishFilter).length, 11);

    assert.equal(englishFilter.filterId, 2);
    assert.equal(englishFilter.name, 'English Filter');
    assert.equal(englishFilter.description, 'English Filter description');
    assert.equal(englishFilter.timeAdded, undefined);
    assert.equal(englishFilter.homepage, 'https://easylist.adblockplus.org/');
    assert.equal(englishFilter.expires, 172800);
    assert.equal(englishFilter.displayNumber, 101);
    assert.equal(englishFilter.groupId, 2);
    assert.equal(englishFilter.subscriptionUrl, 'https://easylist-downloads.adblockplus.org/easylist.txt');
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
});
