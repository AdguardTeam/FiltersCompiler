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
} from '../src/main/platforms/generator';

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

        /* eslint-disable-next-line max-len */
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
});
