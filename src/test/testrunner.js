const testRunner = require('qunit');

(() => {
    testRunner.setup({
        log: {
            // log assertions overview
            assertions: false,
            // log expected and actual values for failed tests
            errors: true,
            // log tests overview
            tests: false,
            // log summary
            summary: true,
            // log global summary (all files)
            globalSummary: true,
            // log coverage
            coverage: true,
            // log global coverage (all files)
            globalCoverage: true,
            // log currently testing code file
            testing: false,
        },
        // max amount of ms child can be blocked, after that we assume running an infinite loop
        maxBlockDuration: 50000,
    });

    const testCallback = function (err) {
        if (err) {
            // eslint-disable-next-line no-console
            console.error(err);
        }
    };

    testRunner.run({
        code: './src/main/utils/version.js',
        tests: './src/test/test-version.js',
    }, testCallback);

    testRunner.run({
        code: './src/main/rule/rule-parser.js',
        tests: './src/test/test-rule-parser.js',
    }, testCallback);

    testRunner.run({
        code: './src/main/rule/rule.js',
        tests: './src/test/test-rules.js',
    }, testCallback);

    // testRunner.run({
    //     code: './src/main/converter.js',
    //     tests: './src/test/converter.test.js',
    // }, testCallback);

    testRunner.run({
        code: './src/main/validator.js',
        tests: './src/test/test-validator.js',
    }, testCallback);

    testRunner.run({
        code: './src/main/sorting.js',
        tests: './src/test/test-sorting.js',
    }, testCallback);

    testRunner.run({
        code: './src/main/optimization.js',
        tests: './src/test/test-optimization.js',
    }, testCallback);

    testRunner.run({
        code: './src/main/platforms/filter.js',
        tests: './src/test/test-platforms-filter.js',
    }, testCallback);

    testRunner.run({
        code: './src/main/builder.js',
        tests: './src/test/test-builder.js',
    }, testCallback);

    testRunner.run({
        code: './src/main/json-validator.js',
        tests: './src/test/test-json-validator.js',
    }, testCallback);
})();
