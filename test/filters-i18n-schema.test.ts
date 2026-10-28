import {
    describe,
    it,
    expect,
} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import {
    generateFiltersI18nSchema,
    type FiltersMetadata,
} from '../src/main/filters-i18n-schema';
import {
    createLocales,
    withTempDir,
} from './utils/fixtures';

/**
 * Schema for a single locale object.
 */
interface LocaleSchema {
    required: string[];
    properties: Record<string, { default: string }>;
}

/**
 * Schema for a single entity id.
 */
interface EntityIdSchema {
    required: string[];
    properties: Record<string, { $ref: string }>;
}

/**
 * Subset of the generated schema used by the tests.
 */
interface GeneratedSchema {
    definitions: Record<string, LocaleSchema>;
    properties: Record<string, {
        required: string[];
        properties: Record<string, EntityIdSchema>;
    }>;
}

const FILTERS_METADATA: FiltersMetadata = {
    groups: [{ groupId: 1 }],
    tags: [{ tagId: 2 }],
    filters: [{ filterId: 25 }],
};

/**
 * Creates complete English locale messages for the test entities.
 *
 * @returns Locale messages keyed by entity kind.
 */
const createLocaleMessages = (): Record<string, Record<string, string>[]> => ({
    groups: [{ 'group.1.name': 'Group', 'group.1.description': 'Group description' }],
    tags: [{ 'tag.2.name': 'Tag', 'tag.2.description': 'Tag description' }],
    filters: [{ 'filter.25.name': 'Filter 25', 'filter.25.description': 'Filter 25 description' }],
});

/**
 * Generates the schema for a fixture.
 *
 * @param localesPath Path to the locales directory.
 * @param requiredLocales Optional required locales.
 *
 * @returns Generated schema.
 */
const generateSchema = (
    localesPath: string,
    requiredLocales?: string[],
): GeneratedSchema => generateFiltersI18nSchema({
    localesPath,
    filtersMetadata: FILTERS_METADATA,
    requiredLocales,
}) as unknown as GeneratedSchema;

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
    schema: GeneratedSchema,
    kind: string,
    id: string,
    locale: string,
): LocaleSchema => {
    const ref = schema.properties[kind].properties[id].properties[locale].$ref;
    const definitionName = ref.replace('#/definitions/', '');

    return schema.definitions[definitionName];
};

describe('filters i18n schema generator', () => {
    it('generates required ids, locales, and English defaults from registry data', () => withTempDir(
        'filters-i18n-schema-',
        (tempDir) => {
            const localesPath = path.join(tempDir, 'locales');

            createLocales(localesPath, {
                en: createLocaleMessages(),
                de: createLocaleMessages(),
            });

            const schema = generateSchema(localesPath);

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
        },
    ));

    it('keeps requiredLocales required and validates all available locales', () => withTempDir(
        'filters-i18n-schema-',
        (tempDir) => {
            const localesPath = path.join(tempDir, 'locales');

            createLocales(localesPath, {
                en: createLocaleMessages(),
                de: createLocaleMessages(),
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

    it('throws when a required locale directory is missing', () => withTempDir(
        'filters-i18n-schema-',
        (tempDir) => {
            const localesPath = path.join(tempDir, 'locales');

            createLocales(localesPath, {
                en: createLocaleMessages(),
            });

            expect(() => generateSchema(localesPath, ['en', 'fr'])).toThrow('Required locales are missing');
        },
    ));

    it('reports the locale file path when a locale file is not valid JSON', () => withTempDir(
        'filters-i18n-schema-',
        (tempDir) => {
            const localesPath = path.join(tempDir, 'locales');

            createLocales(localesPath, {
                en: createLocaleMessages(),
            });
            fs.writeFileSync(path.join(localesPath, 'en', 'groups.json'), '{');

            expect(() => generateSchema(localesPath)).toThrow(
                /Cannot parse .*locales[\\/]en[\\/]groups\.json/,
            );
        },
    ));
});
