const path = require('path');

const localesValidator = require('../main/locales-validator');

// Mock log to hide error messages
jest.mock('../main/utils/log');

describe('locales validator', () => {
    it('Test locales validator', async () => {
        const LOCALES_DIR_PATH = './resources/locales';
        const TEST_REQUIRED_LOCALES = [
            'en',
            'ru',
        ];

        const localesDirPath = path.join(__dirname, LOCALES_DIR_PATH);

        const expectedResultData = [
            {
                locale: 'ko',
                warnings: [
                    {
                        type: 'low',
                        reason: 'empty file or no messages in file',
                        details: [
                            'groups.json',
                        ],
                    },
                    {
                        type: 'critical',
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
                        type: 'critical',
                        reason: 'missed files',
                        details: [
                            'tags.json',
                        ],
                    },
                    {
                        type: 'critical',
                        reason: 'invalid or absent message key/value',
                        details: [
                            'filter.6.name',
                        ],
                    },
                    {
                        type: 'critical',
                        reason: 'invalid or absent message key/value',
                        details: [
                            'filter.6.description',
                        ],
                    },
                    {
                        details: [
                            '"group.3.name": ""',
                        ],
                        reason: 'invalid or absent message key/value',
                        type: 'critical',
                    },
                ],
            },
        ];

        // Test locales validation
        const actualResult = localesValidator.validate(localesDirPath, TEST_REQUIRED_LOCALES);
        expect(actualResult.ok).toBeFalsy();
        expect(actualResult.data).toMatchObject(expectedResultData);
    });
});
