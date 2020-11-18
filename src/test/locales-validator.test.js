const path = require('path');
const localesValidator = require('../main/locales-validator.js');

// Mock log to hide error messages
jest.mock('../main/utils/log');

describe('locales validator', () => {
    it('Test locales validator', async () => {
        const LOCALES_DIR_PATH = './resources/locales';
        const localesDirPath = path.join(__dirname, LOCALES_DIR_PATH);

        const expectedResults = [
            {
                locale: 'ko',
                warnings: [
                    {
                        reason: 'empty file or no messages in file',
                        details: [
                            'groups.json',
                        ],
                    },
                    {
                        reason: 'invalid or absent message key/value',
                        details: [
                            '"tag.1.description": "Blocks ads"',
                        ],
                    },
                ],
            },
            {
                locale: 'ru',
                warnings: [
                    {
                        reason: 'missed files',
                        details: [
                            'tags.json',
                        ],
                    },
                    {
                        reason: 'invalid or absent message key/value',
                        details: [
                            '"group.3.name": ""',
                        ],
                    },
                ],
            },
        ];

        // Test locales validation
        expect(localesValidator.validate(localesDirPath)).toMatchObject(expectedResults);
    });
});
