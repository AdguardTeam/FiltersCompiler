const { optimizeDomainBlockingRules } = require('../../main/utils/builder-utils');

jest.mock('../../main/utils/log');

describe('optimizeDomainBlockingRules options of include directive', () => {
    it('Properly removes redundant rules', async () => {
        const lines = [
            '||example.com^',
            '||sub.example.com^',
            '||sub2.sub.example.com^',
            '||anotherexample.com^',
        ];
        const expectedOutput = ['||example.com^', '||anotherexample.com^'];
        const result = await optimizeDomainBlockingRules(lines);
        expect(result).toEqual(expectedOutput);
    });

    it('Returns all rules if there are no redundant rules', async () => {
        const lines = [
            '||example.com^',
            '||anotherexample.com^',
        ];
        const expectedOutput = ['||example.com^', '||anotherexample.com^'];
        const result = await optimizeDomainBlockingRules(lines);
        expect(result).toEqual(expectedOutput);
    });

    it('Skips rules that should not be optimized', async () => {
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
        const result = await optimizeDomainBlockingRules(lines);
        expectedOutput.forEach((rule) => {
            expect(result.includes(rule)).toBeTruthy();
        });
    });

    it('Repeats the given order', async () => {
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
        const result = await optimizeDomainBlockingRules(lines);
        expectedOutput.forEach((rule) => {
            expect(result.includes(rule)).toBeTruthy();
        });
    });

    it('one more test', async () => {
        const lines = [
            '||0031.lookinews.com^',
            '||0021.lookinews.com^',
            '||1.lookinews.com^',
            '||0051.lookinews.com^',
            '||0071.lookinews.com^',
            '||4189.freshalldaynews.com^',
            '||9.freshalldaynews.com^',
            '||4179.freshalldaynews.com^',
            '||39.freshalldaynews.com^',
            '||pl02.owen.prolitteris.ch^',
            '||1und1.met.vgwort.de^',
            '||express.met.vgwort.de^',
            '||focus.met.vgwort.de^',
            '||golem.met.vgwort.de^',
            '||handelsblatt.met.vgwort.de^',
            '||kr.met.vgwort.de^',
            '||ksta.met.vgwort.de^',
            '||merkur.met.vgwort.de^',
            '||ssl-express.met.vgwort.de^',
            '||met.vgwort.de^',
            '||intense.vgwort.de^',
        ];
        const expectedOutput = [
            '||0031.lookinews.com^',
            '||0021.lookinews.com^',
            '||1.lookinews.com^',
            '||0051.lookinews.com^',
            '||0071.lookinews.com^',
            '||4189.freshalldaynews.com^',
            '||9.freshalldaynews.com^',
            '||4179.freshalldaynews.com^',
            '||39.freshalldaynews.com^',
            '||pl02.owen.prolitteris.ch^',
            '||met.vgwort.de^',
            '||intense.vgwort.de^',
        ];

        const output = await optimizeDomainBlockingRules(lines);
        expect(output).toEqual(expectedOutput);
    });
});
