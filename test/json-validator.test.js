/**
 * @vitest-environment jsdom
 */
import {
    describe,
    it,
    expect,
    vi,
    afterEach,
} from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { schemaValidator } from '../src/main/json-validator';
import { logger } from '../src/main/utils/log';
import { build } from '../src/main/builder';
import { disableOptimization } from '../src/main/optimization';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const createTempDir = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

const writeJson = (filePath, data) => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, '\t'));
};

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

/**
 * Adds locale messages for entities that have no message for the key prefix.
 *
 * @param {object[]} messages Locale messages.
 * @param {string} keyPrefix Key prefix, for example `group`.
 * @param {object[]} items Entities with `id` and `data` fields.
 * @param {Function} createMessage Creates a message object for an entity.
 */
const appendMissingMessages = (messages, keyPrefix, items, createMessage) => {
    const existingIds = new Set();

    messages.forEach((message) => {
        Object.keys(message).forEach((key) => {
            const match = new RegExp(`^${keyPrefix}\\.(\\d+)\\.`).exec(key);
            if (match) {
                existingIds.add(match[1]);
            }
        });
    });

    items.forEach((item) => {
        const id = String(item.id);
        if (!existingIds.has(id)) {
            messages.push(createMessage(id, item.data));
        }
    });
};

/**
 * Creates a temporary filter tree with complete English locale data.
 *
 * The tree contains the real test filters, groups, tags, and locales. Missing
 * English messages are added from the metadata so that every built entity has
 * an English localization.
 *
 * @returns {{root: string, filtersDir: string, localesPath: string}} Fixture paths.
 */
const createIntegrationFixture = () => {
    const root = createTempDir('filters-compiler-json-validator-fixture-');
    const filtersDir = path.join(root, 'filters');
    const localesPath = path.join(root, 'locales');

    fs.cpSync(path.join(__dirname, 'resources/filters'), filtersDir, { recursive: true });
    fs.cpSync(path.join(__dirname, 'resources/groups'), path.join(root, 'groups'), { recursive: true });
    fs.cpSync(path.join(__dirname, 'resources/tags'), path.join(root, 'tags'), { recursive: true });
    fs.cpSync(path.join(__dirname, 'resources/locales'), localesPath, { recursive: true });

    const groups = readJson(path.join(root, 'groups', 'metadata.json'));
    const tags = readJson(path.join(root, 'tags', 'metadata.json'));
    const filters = fs.readdirSync(filtersDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => readJson(path.join(filtersDir, entry.name, 'metadata.json')));

    const enPath = path.join(localesPath, 'en');

    const groupMessages = readJson(path.join(enPath, 'groups.json'));
    appendMissingMessages(
        groupMessages,
        'group',
        groups.map((group) => ({ id: group.groupId, data: group })),
        (id, group) => ({
            [`group.${id}.name`]: group.groupName,
            [`group.${id}.description`]: group.groupDescription,
        }),
    );
    writeJson(path.join(enPath, 'groups.json'), groupMessages);

    const tagMessages = readJson(path.join(enPath, 'tags.json'));
    appendMissingMessages(
        tagMessages,
        'tag',
        tags.map((tag) => ({ id: tag.tagId, data: tag })),
        (id, tag) => ({
            [`tag.${id}.name`]: tag.keyword,
            [`tag.${id}.description`]: tag.keyword,
        }),
    );
    writeJson(path.join(enPath, 'tags.json'), tagMessages);

    const filterMessages = readJson(path.join(enPath, 'filters.json'));
    appendMissingMessages(
        filterMessages,
        'filter',
        filters.map((filter) => ({ id: filter.filterId, data: filter })),
        (id, filter) => ({
            [`filter.${id}.name`]: filter.name,
            [`filter.${id}.description`]: filter.description,
        }),
    );
    writeJson(path.join(enPath, 'filters.json'), filterMessages);

    return { root, filtersDir, localesPath };
};

/**
 * Creates an empty schemas directory with the legacy subdirectories that
 * `schemaValidator.validate()` expects.
 *
 * @returns {string} Path to the schemas directory.
 */
const createSchemasDir = () => {
    const schemasDir = createTempDir('filters-compiler-schemas-');
    fs.mkdirSync(path.join(schemasDir, 'mac'));
    fs.mkdirSync(path.join(schemasDir, 'mac_v2'));
    return schemasDir;
};

/**
 * Creates locale files for the given locales.
 *
 * @param {string} localesPath Path to the locales directory.
 * @param {object} locales Locale data keyed by locale name and entity kind.
 */
const createLocales = (localesPath, locales) => {
    Object.entries(locales).forEach(([locale, data]) => {
        Object.entries(data).forEach(([kind, messages]) => {
            writeJson(path.join(localesPath, locale, `${kind}.json`), messages);
        });
    });
};

/**
 * Creates a platform directory with filters.json and filters_i18n.json.
 *
 * @param {string} platformsPath Path to the platforms directory.
 * @param {string} platform Platform directory name.
 * @param {object} filtersMetadata Contents of filters.json.
 * @param {object} filtersI18n Contents of filters_i18n.json.
 */
const createPlatform = (platformsPath, platform, filtersMetadata, filtersI18n) => {
    const platformPath = path.join(platformsPath, platform);
    writeJson(path.join(platformPath, 'filters.json'), filtersMetadata);
    writeJson(path.join(platformPath, 'filters_i18n.json'), filtersI18n);
};

/**
 * Creates filters.json contents for the test fixtures.
 *
 * @returns {object} Filters metadata.
 */
const createFiltersMetadata = () => ({
    groups: [{
        groupId: 1,
        groupName: 'Group',
        groupDescription: 'Group description',
        displayNumber: 1,
    }],
    tags: [{ tagId: 2, keyword: 'purpose:ads' }],
    filters: [{
        filterId: 25,
        name: 'Filter 25',
        description: 'Filter 25 description',
    }],
});

/**
 * Creates filters_i18n.json contents for the test fixtures.
 *
 * @param {object} [options] Fixture options.
 * @param {boolean} [options.includeDe] Include the German locale.
 * @param {object} [options.deGroup] German group data.
 * @param {object} [options.deFilter] German filter data.
 * @returns {object} Filters i18n metadata.
 */
const createFiltersI18n = ({
    includeDe = true,
    deGroup = { name: 'Gruppe' },
    deFilter = { description: 'Filter 25 Beschreibung' },
} = {}) => {
    const result = {
        groups: {
            1: {
                en: { name: 'Group', description: 'Group description' },
                ...(includeDe ? { de: deGroup } : {}),
            },
        },
        tags: {
            2: {
                en: { name: 'Tag', description: 'Tag description' },
                ...(includeDe ? { de: { name: 'Tag', description: 'Tag-Beschreibung' } } : {}),
            },
        },
        filters: {
            25: {
                en: { name: 'Filter 25', description: 'Filter 25 description' },
                ...(includeDe ? { de: deFilter } : {}),
            },
        },
    };

    return result;
};

describe('json validator', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        logger.close();
    });

    it('fills missing translations with English values and logs them', () => {
        const tempDir = createTempDir('filters-compiler-json-validator-');
        const platformsPath = path.join(tempDir, 'platforms');
        const localesPath = path.join(tempDir, 'locales');
        const schemasDir = createSchemasDir();

        try {
            createLocales(localesPath, {
                en: {
                    groups: [{ 'group.1.name': 'Group', 'group.1.description': 'Group description' }],
                    tags: [{ 'tag.2.name': 'Tag', 'tag.2.description': 'Tag description' }],
                    filters: [{ 'filter.25.name': 'Filter 25', 'filter.25.description': 'Filter 25 description' }],
                },
                de: {
                    groups: [{ 'group.1.name': 'Gruppe' }],
                    tags: [{ 'tag.2.name': 'Tag', 'tag.2.description': 'Tag-Beschreibung' }],
                    filters: [{ 'filter.25.description': 'Filter 25 Beschreibung' }],
                },
            });
            createPlatform(platformsPath, 'test', createFiltersMetadata(), createFiltersI18n());

            const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

            const result = schemaValidator.validate(
                platformsPath,
                schemasDir,
                1,
                { localesPath, requiredLocales: ['en', 'de'] },
            );

            expect(result).toBe(true);
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(
                "Missing groups 1 description for locale 'de'",
            ));
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(
                "Missing filters 25 name for locale 'de'",
            ));
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Applied 2 English fallback(s)'));

            const filtersI18n = JSON.parse(fs.readFileSync(
                path.join(platformsPath, 'test', 'filters_i18n.json'),
                'utf8',
            ));
            expect(filtersI18n.groups['1'].de.description).toBe('Group description');
            expect(filtersI18n.filters['25'].de.name).toBe('Filter 25');
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
            fs.rmSync(schemasDir, { recursive: true, force: true });
        }
    });

    it('validates several platforms in one call', () => {
        const tempDir = createTempDir('filters-compiler-json-validator-');
        const platformsPath = path.join(tempDir, 'platforms');
        const localesPath = path.join(tempDir, 'locales');
        const schemasDir = createSchemasDir();

        try {
            createLocales(localesPath, {
                en: {
                    groups: [{ 'group.1.name': 'Group', 'group.1.description': 'Group description' }],
                    tags: [{ 'tag.2.name': 'Tag', 'tag.2.description': 'Tag description' }],
                    filters: [{ 'filter.25.name': 'Filter 25', 'filter.25.description': 'Filter 25 description' }],
                },
            });
            createPlatform(platformsPath, 'first', createFiltersMetadata(), createFiltersI18n({ includeDe: false }));
            createPlatform(platformsPath, 'second', createFiltersMetadata(), createFiltersI18n({ includeDe: false }));

            const result = schemaValidator.validate(
                platformsPath,
                schemasDir,
                1,
                { localesPath, requiredLocales: ['en'] },
            );

            expect(result).toBe(true);
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
            fs.rmSync(schemasDir, { recursive: true, force: true });
        }
    });

    it('fails when a built entity has no English localization', () => {
        const tempDir = createTempDir('filters-compiler-json-validator-');
        const platformsPath = path.join(tempDir, 'platforms');
        const localesPath = path.join(tempDir, 'locales');
        const schemasDir = createSchemasDir();

        try {
            createLocales(localesPath, {
                en: {
                    groups: [{ 'group.1.name': 'Group', 'group.1.description': 'Group description' }],
                    tags: [{ 'tag.2.name': 'Tag', 'tag.2.description': 'Tag description' }],
                    filters: [],
                },
            });
            createPlatform(platformsPath, 'test', createFiltersMetadata(), createFiltersI18n({ includeDe: false }));

            const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});

            const result = schemaValidator.validate(
                platformsPath,
                schemasDir,
                1,
                { localesPath, requiredLocales: ['en'] },
            );

            expect(result).toBe(false);
            expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(
                'Missing English localization for filters 25',
            ));
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
            fs.rmSync(schemasDir, { recursive: true, force: true });
        }
    });

    it('fails when a required locale is absent for a built filter', () => {
        const tempDir = createTempDir('filters-compiler-json-validator-');
        const platformsPath = path.join(tempDir, 'platforms');
        const localesPath = path.join(tempDir, 'locales');
        const schemasDir = createSchemasDir();

        try {
            createLocales(localesPath, {
                en: {
                    groups: [{ 'group.1.name': 'Group', 'group.1.description': 'Group description' }],
                    tags: [{ 'tag.2.name': 'Tag', 'tag.2.description': 'Tag description' }],
                    filters: [{ 'filter.25.name': 'Filter 25', 'filter.25.description': 'Filter 25 description' }],
                },
                de: {
                    groups: [{ 'group.1.name': 'Gruppe', 'group.1.description': 'Gruppenbeschreibung' }],
                    tags: [{ 'tag.2.name': 'Tag', 'tag.2.description': 'Tag-Beschreibung' }],
                    filters: [{ 'filter.25.name': 'Filter 25', 'filter.25.description': 'Filter 25 Beschreibung' }],
                },
            });

            const filtersI18n = createFiltersI18n();
            delete filtersI18n.filters['25'].de;
            createPlatform(platformsPath, 'test', createFiltersMetadata(), filtersI18n);

            vi.spyOn(logger, 'error').mockImplementation(() => {});

            const result = schemaValidator.validate(
                platformsPath,
                schemasDir,
                1,
                { localesPath, requiredLocales: ['en', 'de'] },
            );

            expect(result).toBe(false);
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
            fs.rmSync(schemasDir, { recursive: true, force: true });
        }
    });

    it('validates locales outside requiredLocales', () => {
        const tempDir = createTempDir('filters-compiler-json-validator-');
        const platformsPath = path.join(tempDir, 'platforms');
        const localesPath = path.join(tempDir, 'locales');
        const schemasDir = createSchemasDir();

        try {
            createLocales(localesPath, {
                en: {
                    groups: [{ 'group.1.name': 'Group', 'group.1.description': 'Group description' }],
                    tags: [{ 'tag.2.name': 'Tag', 'tag.2.description': 'Tag description' }],
                    filters: [{ 'filter.25.name': 'Filter 25', 'filter.25.description': 'Filter 25 description' }],
                },
                de: {
                    groups: [{ 'group.1.name': 42 }],
                    tags: [{ 'tag.2.name': 'Tag', 'tag.2.description': 'Tag-Beschreibung' }],
                    filters: [{ 'filter.25.name': 'Filter 25', 'filter.25.description': 'Filter 25 Beschreibung' }],
                },
            });
            createPlatform(
                platformsPath,
                'test',
                createFiltersMetadata(),
                createFiltersI18n({ deGroup: { name: 42 } }),
            );

            vi.spyOn(logger, 'error').mockImplementation(() => {});

            const result = schemaValidator.validate(
                platformsPath,
                schemasDir,
                1,
                { localesPath, requiredLocales: ['en'] },
            );

            expect(result).toBe(false);
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
            fs.rmSync(schemasDir, { recursive: true, force: true });
        }
    });

    it('fails when filters.json is missing next to filters_i18n.json', () => {
        const tempDir = createTempDir('filters-compiler-json-validator-');
        const platformsPath = path.join(tempDir, 'platforms');
        const localesPath = path.join(tempDir, 'locales');
        const schemasDir = createSchemasDir();

        try {
            createLocales(localesPath, {
                en: {
                    groups: [{ 'group.1.name': 'Group', 'group.1.description': 'Group description' }],
                    tags: [{ 'tag.2.name': 'Tag', 'tag.2.description': 'Tag description' }],
                    filters: [{ 'filter.25.name': 'Filter 25', 'filter.25.description': 'Filter 25 description' }],
                },
            });
            writeJson(
                path.join(platformsPath, 'test', 'filters_i18n.json'),
                createFiltersI18n({ includeDe: false }),
            );

            const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});

            const result = schemaValidator.validate(
                platformsPath,
                schemasDir,
                1,
                { localesPath, requiredLocales: ['en'] },
            );

            expect(result).toBe(false);
            expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('is missing'));
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
            fs.rmSync(schemasDir, { recursive: true, force: true });
        }
    });

    it('writes fallback warnings to the log file', () => {
        const tempDir = createTempDir('filters-compiler-json-validator-');
        const platformsPath = path.join(tempDir, 'platforms');
        const localesPath = path.join(tempDir, 'locales');
        const schemasDir = createSchemasDir();
        const logPath = path.join(tempDir, 'validation.log');

        try {
            createLocales(localesPath, {
                en: {
                    groups: [{ 'group.1.name': 'Group', 'group.1.description': 'Group description' }],
                    tags: [{ 'tag.2.name': 'Tag', 'tag.2.description': 'Tag description' }],
                    filters: [{ 'filter.25.name': 'Filter 25', 'filter.25.description': 'Filter 25 description' }],
                },
                de: {
                    groups: [{ 'group.1.name': 'Gruppe' }],
                    tags: [{ 'tag.2.name': 'Tag', 'tag.2.description': 'Tag-Beschreibung' }],
                    filters: [{ 'filter.25.name': 'Filter 25', 'filter.25.description': 'Filter 25 Beschreibung' }],
                },
            });
            createPlatform(
                platformsPath,
                'test',
                createFiltersMetadata(),
                createFiltersI18n({ deFilter: { name: 'Filter 25', description: 'Filter 25 Beschreibung' } }),
            );

            const result = schemaValidator.validate(
                platformsPath,
                schemasDir,
                1,
                { localesPath, requiredLocales: ['en', 'de'], logPath },
            );

            expect(result).toBe(true);

            const log = fs.readFileSync(logPath, 'utf8');
            expect(log).toContain("Missing groups 1 description for locale 'de'");
            expect(log).toContain('Applied 1 English fallback(s)');
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
            fs.rmSync(schemasDir, { recursive: true, force: true });
        }
    });

    it('appends fallback warnings to an existing log file', () => {
        const tempDir = createTempDir('filters-compiler-json-validator-');
        const platformsPath = path.join(tempDir, 'platforms');
        const localesPath = path.join(tempDir, 'locales');
        const schemasDir = createSchemasDir();
        const logPath = path.join(tempDir, 'validation.log');

        try {
            fs.writeFileSync(logPath, 'existing log line\n');

            createLocales(localesPath, {
                en: {
                    groups: [{ 'group.1.name': 'Group', 'group.1.description': 'Group description' }],
                    tags: [{ 'tag.2.name': 'Tag', 'tag.2.description': 'Tag description' }],
                    filters: [{ 'filter.25.name': 'Filter 25', 'filter.25.description': 'Filter 25 description' }],
                },
                de: {
                    groups: [{ 'group.1.name': 'Gruppe' }],
                    tags: [{ 'tag.2.name': 'Tag', 'tag.2.description': 'Tag-Beschreibung' }],
                    filters: [{ 'filter.25.name': 'Filter 25', 'filter.25.description': 'Filter 25 Beschreibung' }],
                },
            });
            createPlatform(platformsPath, 'test', createFiltersMetadata(), createFiltersI18n());

            const result = schemaValidator.validate(
                platformsPath,
                schemasDir,
                1,
                { localesPath, requiredLocales: ['en', 'de'], logPath },
            );

            expect(result).toBe(true);

            const log = fs.readFileSync(logPath, 'utf8');
            expect(log).toContain('existing log line');
            expect(log).toContain("Missing groups 1 description for locale 'de'");
        } finally {
            logger.close();
            fs.rmSync(tempDir, { recursive: true, force: true });
            fs.rmSync(schemasDir, { recursive: true, force: true });
        }
    });

    it('uses the frozen schema for legacy mac platforms', () => {
        const tempDir = createTempDir('filters-compiler-json-validator-');
        const platformsPath = path.join(tempDir, 'platforms');
        const localesPath = path.join(tempDir, 'locales');
        const schemasDir = createSchemasDir();

        try {
            createLocales(localesPath, {
                en: {
                    groups: [{ 'group.1.name': 'Group', 'group.1.description': 'Group description' }],
                    tags: [{ 'tag.2.name': 'Tag', 'tag.2.description': 'Tag description' }],
                    filters: [{ 'filter.25.name': 'Filter 25', 'filter.25.description': 'Filter 25 description' }],
                },
            });
            writeJson(path.join(schemasDir, 'mac', 'filters_i18n.schema.json'), {
                type: 'object',
                required: ['legacy'],
                properties: {
                    legacy: { type: 'string' },
                },
            });
            writeJson(path.join(platformsPath, 'mac', 'filters_i18n.json'), { legacy: 'ok' });

            const result = schemaValidator.validate(
                platformsPath,
                schemasDir,
                1,
                { localesPath, requiredLocales: ['en'] },
            );

            expect(result).toBe(true);
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
            fs.rmSync(schemasDir, { recursive: true, force: true });
        }
    });

    it('builds the real platform tree and validates it with the bundled schemas', async () => {
        const fixture = createIntegrationFixture();
        const platformsPath = createTempDir('filters-compiler-json-validator-platforms-');
        const logPath = path.join(fixture.root, 'build.log');
        const reportPath = path.join(fixture.root, 'report.txt');

        try {
            const config = readJson(path.join(__dirname, 'resources/platforms.json'));

            disableOptimization();
            await build(fixture.filtersDir, logPath, reportPath, platformsPath, config);

            const result = schemaValidator.validate(
                platformsPath,
                path.join(__dirname, 'resources/schemas'),
                2,
                { localesPath: fixture.localesPath, requiredLocales: ['en'] },
            );

            expect(result).toBe(true);
        } finally {
            logger.close();
            fs.rmSync(fixture.root, { recursive: true, force: true });
            fs.rmSync(platformsPath, { recursive: true, force: true });
        }
    }, 180000);

    it('requires options.localesPath', () => {
        expect(() => schemaValidator.validate('platforms', 'schemas', 1)).toThrow(
            'validateJSONSchema: options.localesPath is required',
        );
    });
});
