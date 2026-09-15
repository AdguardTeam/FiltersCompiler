import {
    describe,
    it,
    expect,
    vi,
} from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import markdownit from 'markdown-it';

import { localesValidator } from '../src/main/locales-validator';

// Mock log to hide error messages
vi.mock('../src/main/utils/log');

const md = markdownit();

const BASE_LOCALE_NAME = 'en';
const LOCALES_FILES = [
    'filters.json',
    'groups.json',
    'tags.json',
];

/**
 * Renders the markdown log and collects the contents of all inline-code spans,
 * i.e. what ends up inside `<code>` elements, so tests assert the rendered
 * result instead of pinning the raw log string.
 * @param {string} markdownLog log produced by the locales validator
 * @returns {string[]} contents of the rendered code spans
 */
const getCodeSpanContents = (markdownLog) => {
    const contents = [];
    md.parse(markdownLog, {}).forEach((token) => {
        if (token.type === 'inline') {
            token.children.forEach((child) => {
                if (child.type === 'code_inline') {
                    contents.push(child.content);
                }
            });
        }
    });
    return contents;
};

/**
 * Renders the markdown log and collects the text of all headings, so tests can
 * assert that translation content did not inject extra headings.
 * @param {string} markdownLog log produced by the locales validator
 * @returns {string[]} text of the rendered headings
 */
const getHeadingContents = (markdownLog) => {
    const headings = [];
    let isHeading = false;
    md.parse(markdownLog, {}).forEach((token) => {
        if (token.type === 'heading_open') {
            isHeading = true;
        } else if (token.type === 'heading_close') {
            isHeading = false;
        } else if (isHeading && token.type === 'inline') {
            headings.push(token.children.map((child) => child.content).join(''));
        }
    });
    return headings;
};

/**
 * Creates a temporary locales directory with the base locale and a locale of
 * the given name, runs the callback and removes the directory afterwards.
 *
 * Locale names with a space at either edge cannot be stored in the repository
 * fixtures: such paths fail to check out on Windows (`error: invalid path`),
 * so the fixture is created in the OS temp directory instead.
 * @param {string} localeName - name of the locale directory to create
 * @param {(localesDirPath: string, createdLocaleName: string) => void} callback -
 * receives the temp locales dir path and the name actually created on disk
 */
const withTempLocale = (localeName, callback) => {
    const tempDirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'locales-validator-'));
    try {
        [BASE_LOCALE_NAME, localeName].forEach((name) => {
            const localeDirPath = path.join(tempDirPath, name);
            fs.mkdirSync(localeDirPath);
            LOCALES_FILES.forEach((fileName) => {
                fs.writeFileSync(path.join(localeDirPath, fileName), '[]');
            });
        });
        // a file system may not preserve a space at the edge of a directory
        // name (Windows strips a trailing one), so read back the created name
        const createdLocaleName = fs.readdirSync(tempDirPath)
            .find((name) => name !== BASE_LOCALE_NAME);
        callback(tempDirPath, createdLocaleName);
    } finally {
        fs.rmSync(tempDirPath, { recursive: true, force: true });
    }
};

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

        // the whole translation value — backticks, both line endings collapsed
        // to spaces, and the markdown link — must stay inside a single rendered
        // code span
        const expectedDetail = [
            '"filter.1.name": "value with `backtick` and``run and',
            'newline before # Injected heading [demo](https://example.invalid)"',
        ].join(' ');
        expect(getCodeSpanContents(actualResult.log)).toContain(expectedDetail);

        // translation content must not inject active links or headings
        expect(md.render(actualResult.log)).not.toContain('<a ');
        const injectedHeadings = getHeadingContents(actualResult.log)
            .filter((heading) => heading.includes('Injected'));
        expect(injectedHeadings).toEqual([]);
    });

    it('Does not insert a blank line after a warning without details', async () => {
        const LOCALES_DIR_PATH = './resources/locales_markdown';
        const TEST_REQUIRED_LOCALES = [
            'en',
        ];

        const localesDirPath = path.join(__dirname, LOCALES_DIR_PATH);

        const actualResult = localesValidator.validate(localesDirPath, TEST_REQUIRED_LOCALES, 'markdown');

        expect(actualResult.ok).toBeFalsy();
        // the empty `{}` object produces a warning with no details, which
        // must be followed directly by the next entry without an
        // intermediate blank line, keeping the markdown list compact
        expect(actualResult.log).toContain(
            '**invalid or absent message key/value**:\n- `low` priority — **empty file or no messages in file**:',
        );
    });

    it('Escapes locale names in markdown headings', async () => {
        const LOCALES_DIR_PATH = './resources/locales_markdown';
        const TEST_REQUIRED_LOCALES = [
            'en',
        ];

        const localesDirPath = path.join(__dirname, LOCALES_DIR_PATH);

        const actualResult = localesValidator.validate(localesDirPath, TEST_REQUIRED_LOCALES, 'markdown');

        expect(actualResult.ok).toBeFalsy();
        const codeSpanContents = getCodeSpanContents(actualResult.log);
        // a locale directory name containing a backtick is wrapped in a code
        // span whose delimiter run is longer than the backtick run in the name,
        // so it cannot break out of the markdown heading code span
        expect(codeSpanContents).toContain('ko`backtick');
        // a locale name that starts and ends with a backtick is padded with
        // spaces so the delimiters cannot merge with the boundary backticks
        expect(codeSpanContents).toContain('`padding`');
    });

    it('Preserves leading and trailing spaces in markdown code spans', async () => {
        // the locale name starts and ends with a space, which cannot be
        // committed as a fixture path, so it is created in a temp directory
        withTempLocale(' x ', (localesDirPath, createdLocaleName) => {
            const actualResult = localesValidator.validate(localesDirPath, [BASE_LOCALE_NAME], 'markdown');

            expect(actualResult.ok).toBeFalsy();
            // CommonMark strips one leading and trailing space from code span
            // content, so a name with a space on both sides is padded with an
            // extra space on each side and keeps its spaces in the rendered
            // output; the created name is used as the expectation because a
            // file system may not preserve the trailing space
            expect(getCodeSpanContents(actualResult.log)).toContain(createdLocaleName);
        });
    });
});
