import {
    describe,
    it,
    expect,
} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import {
    buildFiltersI18nSchema,
    collectMissingFallbacks,
    loadRegistryLocales,
    type FiltersI18nSchema,
    type FiltersMetadata,
    type LocaleSchemaDefinition,
} from '../src/main/filters-i18n-schema';
import {
    parseLocaleMessages,
    type EntityKind,
    type LocaleFileData,
} from '../src/main/utils/locale-messages';
import {
    createEnglishLocales,
    createLocales,
    withTempDir,
} from './utils/fixtures';

const FILTERS_METADATA: FiltersMetadata = {
    groups: [{ groupId: 1 }],
    tags: [{ tagId: 2 }],
    filters: [{ filterId: 25 }],
};

/**
 * Creates base locale data from the English fixture messages.
 *
 * @returns English locale data keyed by entity kind.
 */
const createEnglishData = (): Record<EntityKind, LocaleFileData> => {
    const messages = createEnglishLocales();

    return {
        groups: parseLocaleMessages(messages.groups, 'group', '/locales/en/groups.json'),
        tags: parseLocaleMessages(messages.tags, 'tag', '/locales/en/tags.json'),
        filters: parseLocaleMessages(messages.filters, 'filter', '/locales/en/filters.json'),
    };
};

/**
 * Builds the schema for the standard test metadata and English data without
 * reading the filesystem.
 *
 * @param locales Locales that the schema validates and requires.
 *
 * @returns Generated schema.
 */
const buildSchema = (locales: string[] = ['en']): FiltersI18nSchema => buildFiltersI18nSchema({
    filtersMetadata: FILTERS_METADATA,
    registryLocales: {
        availableLocales: locales,
        requiredLocales: locales,
        englishPath: '/locales/en',
        englishData: createEnglishData(),
    },
});

/**
 * Generates the schema from a locales directory.
 *
 * @param localesPath Path to the locales directory.
 * @param requiredLocales Optional required locales.
 *
 * @returns Generated schema.
 */
const generateSchema = (
    localesPath: string,
    requiredLocales?: string[],
): FiltersI18nSchema => buildFiltersI18nSchema({
    filtersMetadata: FILTERS_METADATA,
    registryLocales: loadRegistryLocales(localesPath, requiredLocales),
});

/**
 * Resolves the shared locale schema for an entity.
 *
 * @param schema Generated schema.
 * @param kind Entity kind.
 * @param id Entity id.
 * @param locale Locale name.
 *
 * @returns Locale schema definition.
 */
const getLocaleSchema = (
    schema: FiltersI18nSchema,
    kind: EntityKind,
    id: string,
    locale: string,
): LocaleSchemaDefinition => {
    const ref = schema.properties[kind].properties[id].properties[locale].$ref;
    const definitionName = ref.replace('#/definitions/', '');

    return schema.definitions[definitionName];
};

describe('filters i18n schema generator', () => {
    it('generates required ids, locales, and English defaults without filesystem access', () => {
        const schema = buildSchema(['de', 'en']);

        expect(schema.properties.groups.required).toEqual(['1']);
        expect(schema.properties.tags.required).toEqual(['2']);
        expect(schema.properties.filters.required).toEqual(['25']);

        expect(schema.properties.groups.properties['1'].required).toEqual(['de', 'en']);
        expect(Object.keys(schema.properties.groups.properties['1'].properties)).toEqual(['de', 'en']);

        expect(schema.properties.groups.properties['1'].properties.en).toEqual({
            $ref: '#/definitions/groups.1',
        });
        expect(getLocaleSchema(schema, 'groups', '1', 'en').properties.name.default).toBe('Group');
        expect(getLocaleSchema(schema, 'filters', '25', 'de').properties.description.default)
            .toBe('Filter 25 description');

        expect(Object.keys(schema.definitions)).toEqual(['groups.1', 'tags.2', 'filters.25']);
    });

    it('collects missing locale fields with their English fallbacks', () => {
        const schema = buildSchema(['en', 'de']);
        const json = {
            groups: {
                1: {
                    en: { name: 'Group', description: 'Group description' },
                    de: { name: 'Gruppe' },
                },
            },
            tags: {
                2: {
                    en: { name: 'Tag', description: 'Tag description' },
                },
            },
            filters: {
                25: {
                    en: { name: 'Filter 25', description: 'Filter 25 description' },
                    de: { name: 'Filter 25', description: 'Filter 25 Beschreibung' },
                },
            },
        };

        expect(collectMissingFallbacks(json, schema)).toEqual([
            {
                kind: 'groups',
                id: '1',
                locale: 'de',
                field: 'description',
                fallback: 'Group description',
            },
        ]);
    });

    it.each([null, [], 'text', 42])('returns no fallbacks when the document is not an object', (json) => {
        const schema = buildSchema(['en', 'de']);

        expect(collectMissingFallbacks(json, schema)).toEqual([]);
    });

    it.each(['Gruppe', 42, ['Gruppe']])(
        'returns no fallbacks when a locale value is not an object: %s',
        (localeValue) => {
            const schema = buildSchema(['en', 'de']);
            const json = {
                groups: {
                    1: {
                        en: { name: 'Group', description: 'Group description' },
                        de: localeValue,
                    },
                },
            };

            expect(collectMissingFallbacks(json, schema)).toEqual([]);
        },
    );

    it('keeps requiredLocales required and validates all available locales', () => withTempDir(
        'filters-i18n-schema-',
        (tempDir) => {
            const localesPath = path.join(tempDir, 'locales');

            createLocales(localesPath, {
                en: createEnglishLocales(),
                de: createEnglishLocales(),
            });

            const schema = generateSchema(localesPath, ['en']);

            const groupSchema = schema.properties.groups.properties['1'];
            expect(groupSchema.required).toEqual(['en']);
            expect(Object.keys(groupSchema.properties)).toEqual(['de', 'en']);
        },
    ));

    it('throws when an entity has no English localization', () => withTempDir(
        'filters-i18n-schema-',
        (tempDir) => {
            const localesPath = path.join(tempDir, 'locales');

            createLocales(localesPath, {
                en: {
                    groups: [{ 'group.1.name': 'Group', 'group.1.description': 'Group description' }],
                    tags: [{ 'tag.2.name': 'Tag', 'tag.2.description': 'Tag description' }],
                    filters: [],
                },
            });

            expect(() => generateSchema(localesPath)).toThrow('Missing English localization for filters 25');
        },
    ));

    it('throws when an English field is missing', () => withTempDir(
        'filters-i18n-schema-',
        (tempDir) => {
            const localesPath = path.join(tempDir, 'locales');

            createLocales(localesPath, {
                en: {
                    groups: [{ 'group.1.name': 'Group', 'group.1.description': 'Group description' }],
                    tags: [{ 'tag.2.name': 'Tag', 'tag.2.description': 'Tag description' }],
                    filters: [{ 'filter.25.name': 'Filter 25' }],
                },
            });

            expect(() => generateSchema(localesPath)).toThrow('Missing English description for filters 25');
        },
    ));

    it('throws when an English field is empty', () => withTempDir(
        'filters-i18n-schema-',
        (tempDir) => {
            const localesPath = path.join(tempDir, 'locales');

            createLocales(localesPath, {
                en: {
                    groups: [{ 'group.1.name': 'Group', 'group.1.description': 'Group description' }],
                    tags: [{ 'tag.2.name': 'Tag', 'tag.2.description': 'Tag description' }],
                    filters: [{ 'filter.25.name': 'Filter 25', 'filter.25.description': '' }],
                },
            });

            expect(() => generateSchema(localesPath)).toThrow('Missing English description for filters 25');
        },
    ));

    it('throws when a required locale directory is missing', () => withTempDir(
        'filters-i18n-schema-',
        (tempDir) => {
            const localesPath = path.join(tempDir, 'locales');

            createLocales(localesPath, {
                en: createEnglishLocales(),
            });

            expect(() => generateSchema(localesPath, ['en', 'fr'])).toThrow('Required locales are missing');
        },
    ));

    it('reports the locale file path when a locale file is not valid JSON', () => withTempDir(
        'filters-i18n-schema-',
        (tempDir) => {
            const localesPath = path.join(tempDir, 'locales');

            createLocales(localesPath, {
                en: createEnglishLocales(),
            });
            fs.writeFileSync(path.join(localesPath, 'en', 'groups.json'), '{');

            expect(() => generateSchema(localesPath)).toThrow(
                /Cannot parse .*locales[\\/]en[\\/]groups\.json/,
            );
        },
    ));

    it('reports the locale file path when a locale file is not an array', () => withTempDir(
        'filters-i18n-schema-',
        (tempDir) => {
            const localesPath = path.join(tempDir, 'locales');

            createLocales(localesPath, {
                en: createEnglishLocales(),
            });
            fs.writeFileSync(path.join(localesPath, 'en', 'groups.json'), '{}');

            expect(() => generateSchema(localesPath)).toThrow(
                /Locale file .*locales[\\/]en[\\/]groups\.json must contain an array/,
            );
        },
    ));
});
