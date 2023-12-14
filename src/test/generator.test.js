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
});
