const { optimizeDomainBlockingRules } = require('../../main/utils/builder-utils');

jest.mock('../../main/utils/log');

describe('optimizeDomainBlockingRules options of include directive', () => {
    it('Properly removes redundant rules', () => {
        const lines = [
            '||example.com^',
            '||sub.example.com^',
            '||sub2.sub.example.com^',
            '||anotherexample.com^',
        ];
        const expectedOutput = ['||example.com^', '||anotherexample.com^'];
        const result = optimizeDomainBlockingRules(lines);
        expect(result).toEqual(expectedOutput);
    });

    it('Returns all rules if there are no redundant rules', () => {
        const lines = [
            '||example.com^',
            '||anotherexample.com^',
        ];
        const expectedOutput = ['||example.com^', '||anotherexample.com^'];
        const result = optimizeDomainBlockingRules(lines);
        expect(result).toEqual(expectedOutput);
    });

    it('Skips rules that should not be optimized', () => {
        const lines = [
            '||example.com^',
            '||sub.example.com^',
            '||sub2.sub.example.com^',
            '||some.anotherexample.com^',
            '||anotherexample.com^$image',
            'host.com',
        ];
        const expectedOutput = [
            '||example.com^',
            '||some.anotherexample.com^',
            '||anotherexample.com^$image',
            'host.com',
        ];
        const result = optimizeDomainBlockingRules(lines);
        expectedOutput.forEach((rule) => {
            expect(result.includes(rule)).toBeTruthy();
        });
    });

    it('Repeats the given order', () => {
        const lines = [
            '! comment',
            '||example.com^',
            '! comment',
            '||sub.example.com^',
            '||sub2.sub.example.com^',
            '||some.anotherexample.com^',
            '! comment',
            '||anotherexample.com^$image',
            '! comment',
            'host.com',
        ];
        const expectedOutput = [
            '! comment',
            '||example.com^',
            '! comment',
            '||some.anotherexample.com^',
            '! comment',
            '||anotherexample.com^$image',
            '! comment',
            'host.com',
        ];
        const result = optimizeDomainBlockingRules(lines);
        expectedOutput.forEach((rule) => {
            expect(result.includes(rule)).toBeTruthy();
        });
    });
});
