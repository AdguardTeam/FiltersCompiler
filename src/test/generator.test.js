const generator = require('../main/platforms/generator');

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
        expect(generator.sortMetadataFilters(actual)).toEqual(expected);
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
                expect(generator.shouldBuildFilterForPlatform(metadata, platform)).toBeTruthy();
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
                expect(generator.shouldBuildFilterForPlatform(metadata, platform)).toBeFalsy();
            });
        });

        it('both platformsExcluded and platformsIncluded defined', () => {
            const metadata = {
                filterId: 1,
                platformsIncluded: ['chromium'],
                platformsExcluded: ['mac'],
            };
            expect(() => {
                generator.shouldBuildFilterForPlatform(metadata, platform);
            }).toThrow(
                'Both platformsIncluded and platformsExcluded cannot be defined simultaneously for filter 1',
            );
        });
    });
});
