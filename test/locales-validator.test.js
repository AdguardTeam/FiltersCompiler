import {
    describe,
    it,
    expect,
    vi,
} from 'vitest';
import path from 'path';

import { localesValidator } from '../src/main/locales-validator';

// Mock log to hide error messages
vi.mock('../src/main/utils/log');

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
                            'group.3.description',
                        ],
                        reason: 'invalid or absent message key/value',
                        type: 'critical',
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

    it('Generates a markdown log when logFormat is markdown', async () => {
        const LOCALES_DIR_PATH = './resources/locales';
        const TEST_REQUIRED_LOCALES = [
            'en',
        ];

        const localesDirPath = path.join(__dirname, LOCALES_DIR_PATH);

        const actualResult = localesValidator.validate(localesDirPath, TEST_REQUIRED_LOCALES, 'markdown');

        expect(actualResult.ok).toBeFalsy();
        expect(actualResult.log).toContain('## Locales validation issues');
        expect(actualResult.log).toContain('### `ko`');
        expect(actualResult.log).toContain('- `low` priority — **empty file or no messages in file**:');
        expect(actualResult.log).toContain('  - `groups.json`');
        expect(actualResult.log).toContain('- `critical` priority — **invalid or absent message key/value**:');
        expect(actualResult.log).toContain('  - `"tag.1.description": "Blocks ads"`');
    });

    it('Escapes markdown metacharacters in the markdown log', async () => {
        const LOCALES_DIR_PATH = './resources/locales_markdown';
        const TEST_REQUIRED_LOCALES = [
            'en',
        ];

        const localesDirPath = path.join(__dirname, LOCALES_DIR_PATH);

        const actualResult = localesValidator.validate(localesDirPath, TEST_REQUIRED_LOCALES, 'markdown');

        expect(actualResult.ok).toBeFalsy();
        // backticks/newlines in translation content are escaped so they
        // cannot break out of an inline-code span
        expect(actualResult.log).toContain(
            '  - `"filter.1.name": "value with \\`backtick\\` and newline"`',
        );
    });

    it('Does not emit a dangling empty list item for a warning without details', async () => {
        const LOCALES_DIR_PATH = './resources/locales_markdown';
        const TEST_REQUIRED_LOCALES = [
            'en',
        ];

        const localesDirPath = path.join(__dirname, LOCALES_DIR_PATH);

        const actualResult = localesValidator.validate(localesDirPath, TEST_REQUIRED_LOCALES, 'markdown');

        expect(actualResult.ok).toBeFalsy();
        // the empty `{}` object produces a warning with no details, which
        // must be followed directly by the next line without a dangling
        // blank line / empty sub-list item
        expect(actualResult.log).toContain(
            '**invalid or absent message key/value**:\n- `low` priority — **empty file or no messages in file**:',
        );
    });
});
