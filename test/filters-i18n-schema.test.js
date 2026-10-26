import {
    describe,
    it,
    expect,
} from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { generateFiltersI18nSchema } from '../src/main/filters-i18n-schema';

const createTempDir = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

const writeJson = (filePath, data) => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, '\t'));
};

const createLocales = (localesPath, locales) => {
    Object.entries(locales).forEach(([locale, data]) => {
        Object.entries(data).forEach(([kind, messages]) => {
            writeJson(path.join(localesPath, locale, `${kind}.json`), messages);
        });
    });
};

const FILTERS_METADATA = {
    groups: [{ groupId: 1 }],
    tags: [{ tagId: 2 }],
    filters: [{ filterId: 25 }],
};

const createLocaleMessages = () => ({
    groups: [{ 'group.1.name': 'Group', 'group.1.description': 'Group description' }],
    tags: [{ 'tag.2.name': 'Tag', 'tag.2.description': 'Tag description' }],
    filters: [{ 'filter.25.name': 'Filter 25', 'filter.25.description': 'Filter 25 description' }],
});

describe('filters i18n schema generator', () => {
    it('generates required ids, locales, and English defaults from registry data', () => {
        const tempDir = createTempDir('filters-i18n-schema-');
        const localesPath = path.join(tempDir, 'locales');

        try {
            createLocales(localesPath, {
                en: createLocaleMessages(),
                de: createLocaleMessages(),
            });

            const schema = generateFiltersI18nSchema({
                localesPath,
                filtersMetadata: FILTERS_METADATA,
            });

            expect(schema.properties.groups.required).toEqual(['1']);
            expect(schema.properties.tags.required).toEqual(['2']);
            expect(schema.properties.filters.required).toEqual(['25']);

            expect(schema.properties.groups.properties['1'].required).toEqual(['de', 'en']);
            expect(Object.keys(schema.properties.groups.properties['1'].properties)).toEqual(['de', 'en']);
            expect(schema.properties.groups.properties['1'].properties.en.properties.name.default)
                .toBe('Group');
            expect(schema.properties.filters.properties['25'].properties.de.properties.description.default)
                .toBe('Filter 25 description');
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('keeps requiredLocales required and validates all available locales', () => {
        const tempDir = createTempDir('filters-i18n-schema-');
        const localesPath = path.join(tempDir, 'locales');

        try {
            createLocales(localesPath, {
                en: createLocaleMessages(),
                de: createLocaleMessages(),
            });

            const schema = generateFiltersI18nSchema({
                localesPath,
                filtersMetadata: FILTERS_METADATA,
                requiredLocales: ['en'],
            });

            const groupSchema = schema.properties.groups.properties['1'];
            expect(groupSchema.required).toEqual(['en']);
            expect(Object.keys(groupSchema.properties)).toEqual(['de', 'en']);
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('throws when an entity has no English localization', () => {
        const tempDir = createTempDir('filters-i18n-schema-');
        const localesPath = path.join(tempDir, 'locales');

        try {
            createLocales(localesPath, {
                en: {
                    groups: [{ 'group.1.name': 'Group', 'group.1.description': 'Group description' }],
                    tags: [{ 'tag.2.name': 'Tag', 'tag.2.description': 'Tag description' }],
                    filters: [],
                },
            });

            expect(() => generateFiltersI18nSchema({
                localesPath,
                filtersMetadata: FILTERS_METADATA,
            })).toThrow('Missing English localization for filters 25');
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('throws when an English field is missing', () => {
        const tempDir = createTempDir('filters-i18n-schema-');
        const localesPath = path.join(tempDir, 'locales');

        try {
            createLocales(localesPath, {
                en: {
                    groups: [{ 'group.1.name': 'Group', 'group.1.description': 'Group description' }],
                    tags: [{ 'tag.2.name': 'Tag', 'tag.2.description': 'Tag description' }],
                    filters: [{ 'filter.25.name': 'Filter 25' }],
                },
            });

            expect(() => generateFiltersI18nSchema({
                localesPath,
                filtersMetadata: FILTERS_METADATA,
            })).toThrow('Missing English description for filters 25');
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('throws when a required locale directory is missing', () => {
        const tempDir = createTempDir('filters-i18n-schema-');
        const localesPath = path.join(tempDir, 'locales');

        try {
            createLocales(localesPath, {
                en: createLocaleMessages(),
            });

            expect(() => generateFiltersI18nSchema({
                localesPath,
                filtersMetadata: FILTERS_METADATA,
                requiredLocales: ['en', 'fr'],
            })).toThrow('Required locales are missing');
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
});
