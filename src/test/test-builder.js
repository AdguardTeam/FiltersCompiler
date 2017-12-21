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
    assert.equal(filterLines.length, 21);

    //Common include
    assert.ok(filterLines.indexOf('! some common rules could be places here') >= 0);
    assert.ok(filterLines.indexOf('test-common-rule.com') >= 0);
    assert.ok(filterLines.indexOf('test-common-rule.com$xmlhttprequest') >= 0);
    assert.ok(filterLines.indexOf('example.com#$#h1 { background-color: blue !important }') >= 0);

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

    let filterContent = readFile(path.join(platforms, 'test', '2.txt'));
    assert.ok(filterContent);

    let filterLines = filterContent.split('\r\n');
    assert.equal(filterLines.length, 27);

    assert.ok(filterLines.indexOf('test-common-rule.com') >= 0);
    assert.ok(filterLines.indexOf('test-common-1-rule.com') >= 0);
    assert.ok(filterLines.indexOf('! some common rules could be places here') >= 0);
    assert.ok(filterLines.indexOf('~nigma.ru,google.com$$div[id=\"ad_text\"][wildcard=\"*teasernet*tararar*\"]') >= 0);
    assert.ok(filterLines.indexOf('excluded_platform') >= 0);

    filterContent = readFile(path.join(platforms, 'config/test', '2.txt'));
    assert.ok(filterContent);

    filterLines = filterContent.split('\r\n');
    assert.equal(filterLines.length, 13);

    assert.ok(filterLines.indexOf('test-common-rule.com') >= 0);
    assert.notOk(filterLines.indexOf('test-common-1-rule.com') >= 0);
    assert.notOk(filterLines.indexOf('! some common rules could be places here') >= 0);
    assert.notOk(filterLines.indexOf('~nigma.ru,google.com$$div[id=\"ad_text\"][wildcard=\"*teasernet*tararar*\"]') >= 0);
    assert.ok(filterLines.indexOf('excluded_platform') >= 0);


    filterContent = readFile(path.join(platforms, 'hints', '2.txt'));
    assert.ok(filterContent);

    filterLines = filterContent.split('\r\n');
    assert.equal(filterLines.length, 25);

    assert.ok(filterLines.indexOf('test-common-rule.com') >= 0);
    assert.ok(filterLines.indexOf('test-common-1-rule.com') >= 0);
    assert.ok(filterLines.indexOf('! some common rules could be places here') >= 0);
    assert.ok(filterLines.indexOf('~nigma.ru,google.com$$div[id=\"ad_text\"][wildcard=\"*teasernet*tararar*\"]') >= 0);
    assert.notOk(filterLines.indexOf('excluded_platform') >= 0);
});
