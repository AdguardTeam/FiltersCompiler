import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
    describe,
    it,
    expect,
    test,
    beforeEach,
    afterEach,
} from 'vitest';
import {
    sortMetadataFilters,
    shouldBuildFilterForPlatform,
    makeHeader,
    loadFilterMetadata,
    init,
    postProcessUrls,
    generate,
} from '../src/main/platforms/generator';
import { disableOptimization } from '../src/main/optimization';

describe('generator', () => {
    it('sortMetadataFilters', () => {
        const actual = {
            filters: [
                {
                    filterId: 101,
                },
                {
                    filterId: 102,
                },
                {
                    filterId: 201,
                },
                {
                    filterId: 254,
                },
                {
                    filterId: 10,
                },
                {
                    filterId: 11,
                },
                {
                    filterId: 12,
                },
                {
                    filterId: 1,
                },
                {
                    filterId: 20,
                },
                {
                    filterId: 21,
                },
                {
                    filterId: 2,
                },
                {
                    filterId: 3,
                },
            ],
        };
        const expected = {
            filters: [
                {
                    filterId: 1,
                },
                {
                    filterId: 2,
                },
                {
                    filterId: 3,
                },
                {
                    filterId: 10,
                },
                {
                    filterId: 11,
                },
                {
                    filterId: 12,
                },
                {
                    filterId: 20,
                },
                {
                    filterId: 21,
                },
                {
                    filterId: 101,
                },
                {
                    filterId: 102,
                },
                {
                    filterId: 201,
                },
                {
                    filterId: 254,
                },
            ],
        };
        expect(sortMetadataFilters(actual)).toEqual(expected);
    });

    describe('shouldBuildFilterForPlatform', () => {
        const platform = 'chromium';

        describe('should build', () => {
            test.each([
                // no exclude or include platforms
                {
                    filterId: 1,
                },
                // platformsIncluded
                {
                    platformsIncluded: ['chromium'],
                },
                {
                    platformsIncluded: ['mac', 'ios', 'chromium'],
                },
                // platformsExcluded
                {
                    platformsExcluded: ['mac'],
                },
                {
                    platformsExcluded: ['mac', 'ios'],
                },
            ])(`should build filter for platform '${platform}' - %s`, async (metadata) => {
                expect(shouldBuildFilterForPlatform(metadata, platform)).toBeTruthy();
            });
        });

        describe('should NOT build', () => {
            test.each([
                // platformsIncluded
                {
                    platformsIncluded: ['ios'],
                },
                {
                    platformsIncluded: ['windows', 'android'],
                },
                // platformsExcluded
                {
                    platformsExcluded: ['chromium'],
                },
                {
                    platformsExcluded: ['mac', 'ios', 'chromium'],
                },
            ])(`should NOT build filter for platform '${platform}' - %s`, async (metadata) => {
                expect(shouldBuildFilterForPlatform(metadata, platform)).toBeFalsy();
            });
        });

        it('both platformsExcluded and platformsIncluded defined', () => {
            const metadata = {
                filterId: 1,
                platformsIncluded: ['chromium'],
                platformsExcluded: ['mac'],
            };
            expect(() => {
                shouldBuildFilterForPlatform(metadata, platform);
            }).toThrow(
                'Both platformsIncluded and platformsExcluded cannot be defined simultaneously for filter 1',
            );
        });
    });

    describe('date fields stay in UTC regardless of local time zone', () => {
        const TIMEZONE_TESTS = [
            'America/New_York',
            'Asia/Tokyo',
            'UTC',
        ];

        let originalTz;
        let tmpDir;

        beforeEach(async () => {
            originalTz = process.env.TZ;
            tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'generator-test-'));
        });

        afterEach(async () => {
            if (originalTz === undefined) {
                delete process.env.TZ;
            } else {
                process.env.TZ = originalTz;
            }
            await fs.rm(tmpDir, { recursive: true, force: true });
        });

        test.each(TIMEZONE_TESTS)('makeHeader keeps TimeUpdated in UTC under local time zone %s', async (tz) => {
            const UTC_TIME_UPDATED = '2024-01-15T10:00:00.000Z';
            const EXPECTED_TIME_UPDATED = '2024-01-15T10:00:00+00:00';

            process.env.TZ = tz;

            const metadataPath = path.join(tmpDir, 'metadata.json');
            const revisionPath = path.join(tmpDir, 'revision.json');
            await fs.writeFile(metadataPath, JSON.stringify({
                name: 'Test filter',
                description: 'Test description',
                expires: '1 days',
            }));
            await fs.writeFile(revisionPath, JSON.stringify({
                version: '1.0.0.0',
                timeUpdated: UTC_TIME_UPDATED,
            }));

            const header = makeHeader(metadataPath, revisionPath);

            expect(header).toContain(`! TimeUpdated: ${EXPECTED_TIME_UPDATED}`);
        });

        /* eslint-disable-next-line max-len */
        test.each(TIMEZONE_TESTS)('loadFilterMetadata keeps timeUpdated/timeAdded in UTC under local time zone %s', async (tz) => {
            const UTC_TIME_UPDATED = '2024-01-15T10:00:00.000Z';
            const UTC_TIME_ADDED = '2024-02-20T22:30:00.000Z';
            const EXPECTED_TIME_ADDED = '2024-02-20T22:30:00+0000';
            const EXPECTED_TIME_UPDATED = '2024-01-15T10:00:00+0000';

            process.env.TZ = tz;

            init('filters.js', 'metadata.json', 'revision.json', {}, 'https://filters.adtidy.org');

            await fs.writeFile(path.join(tmpDir, 'metadata.json'), JSON.stringify({
                filterId: 999999,
                name: 'Test filter',
                timeAdded: UTC_TIME_ADDED,
                disabled: false,
            }));
            await fs.writeFile(path.join(tmpDir, 'revision.json'), JSON.stringify({
                version: '1.0.0.0',
                timeUpdated: UTC_TIME_UPDATED,
            }));

            const result = loadFilterMetadata(tmpDir);

            expect(result.timeUpdated).toBe(EXPECTED_TIME_UPDATED);
            expect(result.timeAdded).toBe(EXPECTED_TIME_ADDED);
        });
    });

    describe('postProcessUrls', () => {
        const SERVER_URL = 'https://filters.adtidy.org/';

        beforeEach(() => {
            init('filters.js', 'metadata.json', 'revision.json', {}, SERVER_URL);
        });

        const metadata = {
            groups: [{ groupId: 1 }],
            tags: [{ tagId: 1 }],
            filters: [
                {
                    filterId: 1,
                    name: 'Test filter',
                    subscriptionUrl: `${SERVER_URL}extension/android-content-blocker/filters/1.txt`,
                },
            ],
        };

        it.each([
            ['ext_safari', 'extension/safari'],
            ['android', 'android'],
            ['ios', 'ios'],
            ['ext_android_cb', 'extension/android-content-blocker'],
        ])(
            'uses optimized urls for platform %s',
            (platform, platformPath) => {
                const config = { platform, path: platformPath };

                const result = postProcessUrls(metadata, config);

                expect(result.filters[0].downloadUrl)
                    .toBe(`${SERVER_URL}${platformPath}/filters/1_optimized.txt`);
                expect(result.filters[0].subscriptionUrl)
                    .toBe(`${SERVER_URL}${platformPath}/filters/1_optimized.txt`);
            },
        );

        it('uses regular urls for a non-optimized platform', () => {
            const config = { platform: 'ext_chromium', path: 'extension/chromium' };

            const result = postProcessUrls(metadata, config);

            expect(result.filters[0].downloadUrl)
                .toBe(`${SERVER_URL}extension/chromium/filters/1.txt`);
            expect(result.filters[0].subscriptionUrl)
                .toBe(`${SERVER_URL}extension/chromium/filters/1.txt`);
        });

        it('does not touch subscription urls hosted elsewhere', () => {
            const config = { platform: 'ext_android_cb', path: 'extension/android-content-blocker' };
            const customMetadata = {
                ...metadata,
                filters: [
                    {
                        ...metadata.filters[0],
                        subscriptionUrl: 'https://example.org/custom/filter.txt',
                    },
                ],
            };

            const result = postProcessUrls(customMetadata, config);

            expect(result.filters[0].downloadUrl)
                .toBe(`${SERVER_URL}extension/android-content-blocker/filters/1_optimized.txt`);
            expect(result.filters[0].subscriptionUrl)
                .toBe('https://example.org/custom/filter.txt');
        });
    });

    describe('generate locales', () => {
        let tmpDir;
        let filtersDir;
        let platformsDir;

        const writeJson = (filePath, data) => fs.writeFile(filePath, JSON.stringify(data));

        beforeEach(async () => {
            disableOptimization();

            tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'generator-locales-test-'));
            filtersDir = path.join(tmpDir, 'filters');
            platformsDir = path.join(tmpDir, 'platforms');

            const filterDir = path.join(filtersDir, 'filter_1_Test');
            const localesDir = path.join(tmpDir, 'locales');

            await fs.mkdir(filterDir, { recursive: true });
            await fs.mkdir(path.join(tmpDir, 'groups'), { recursive: true });
            await fs.mkdir(path.join(tmpDir, 'tags'), { recursive: true });
            await fs.mkdir(path.join(localesDir, 'en'), { recursive: true });
            await fs.mkdir(path.join(localesDir, 'ru'), { recursive: true });
            await fs.mkdir(path.join(localesDir, 'ko'), { recursive: true });

            await writeJson(path.join(filterDir, 'metadata.json'), {
                filterId: 1,
                name: 'Test filter',
                description: 'Test filter description',
                timeAdded: 1404115015843,
                expires: '2 days',
                groupId: 1,
                subscriptionUrl: 'https://example.org/filters/1.txt',
                tags: ['purpose:ads'],
            });
            await writeJson(path.join(filterDir, 'revision.json'), {
                version: '1.0.0.0',
                timeUpdated: 1578671260906,
            });
            await fs.writeFile(path.join(filterDir, 'filter.txt'), '||example.com^\r\n');

            await writeJson(path.join(tmpDir, 'groups', 'metadata.json'), [
                { groupId: 1, groupName: 'Test group' },
            ]);
            await writeJson(path.join(tmpDir, 'tags', 'metadata.json'), [
                { tagId: 1, keyword: 'purpose:ads' },
            ]);

            await writeJson(path.join(localesDir, 'en', 'groups.json'), [
                { 'group.1.name': 'Group name' },
            ]);
            await writeJson(path.join(localesDir, 'en', 'tags.json'), [
                { 'tag.1.name': 'Tag name' },
            ]);
            await writeJson(path.join(localesDir, 'en', 'filters.json'), [
                { 'filter.1.name': 'Filter name', 'filter.1.description': 'Filter description' },
            ]);

            await writeJson(path.join(localesDir, 'ru', 'groups.json'), [
                { 'group.1.name': 'Group name RU' },
            ]);
            // No tags.json for this locale: the missing file must be skipped.
            await writeJson(path.join(localesDir, 'ru', 'filters.json'), [
                { 'filter.1.name': 'Filter name RU' },
            ]);

            // An entry without an id must be skipped.
            await writeJson(path.join(localesDir, 'ko', 'groups.json'), [
                { 'group..name': 'Broken' },
                { 'group.1.name': 'Group name KO' },
            ]);
            await writeJson(path.join(localesDir, 'ko', 'tags.json'), []);
            await writeJson(path.join(localesDir, 'ko', 'filters.json'), []);

            init('filter.txt', 'metadata.json', 'revision.json', {
                TEST: {
                    platform: 'ext_ublock',
                    path: 'test',
                    configuration: {
                        removeRulePatterns: false,
                        ignoreRuleHints: false,
                        adbHeader: '![Adblock Plus 2.0]',
                    },
                    defines: {
                        adguard: true,
                        ublock: true,
                    },
                },
            }, 'https://example.org/');
        });

        afterEach(async () => {
            await fs.rm(tmpDir, { recursive: true, force: true });
        });

        it('loads groups, tags, and filters with their locales', async () => {
            await generate(filtersDir, platformsDir);

            const content = await fs.readFile(path.join(platformsDir, 'test', 'filters_i18n.json'), 'utf-8');
            const i18n = JSON.parse(content);

            expect(i18n.groups).toEqual({
                1: {
                    en: { name: 'Group name' },
                    ru: { name: 'Group name RU' },
                    ko: { name: 'Group name KO' },
                },
            });
            expect(i18n.tags).toEqual({
                1: {
                    en: { name: 'Tag name' },
                },
            });
            expect(i18n.filters).toEqual({
                1: {
                    en: { name: 'Filter name', description: 'Filter description' },
                    ru: { name: 'Filter name RU' },
                },
            });
        });
    });
});
