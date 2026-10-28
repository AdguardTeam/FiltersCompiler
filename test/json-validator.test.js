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
import path from 'path';
import { fileURLToPath } from 'url';

import { schemaValidator } from '../src/main/json-validator';
import { logger } from '../src/main/utils/log';
import { build } from '../src/main/builder';
import { disableOptimization } from '../src/main/optimization';

import {
    createLocales,
    createTempDir,
    readJson,
    writeJson,
} from './utils/fixtures';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
 * Creates a schemas directory with the real shipped filters schema and the
 * legacy test fixtures.
 *
 * `filters.schema.json` is copied from `schemas/` (the shipped schema). The
 * frozen legacy schemas in `schemas/` require every FiltersRegistry locale,
 * but the test platform data only contains en, ko, and ru. The fixtures keep
 * legacy validation minimal for the test data, so they are not the shipped
 * `mac`/`mac_v2` schemas.
 *
 * @returns {string} Path to the schemas directory.
 */
const createTestSchemasDir = () => {
    const schemasDir = createTempDir('filters-compiler-schemas-');

    fs.copyFileSync(
        path.join(__dirname, '../schemas/filters.schema.json'),
        path.join(schemasDir, 'filters.schema.json'),
    );
    fs.cpSync(path.join(__dirname, 'resources/schemas/mac'), path.join(schemasDir, 'mac'), { recursive: true });
    fs.cpSync(
        path.join(__dirname, 'resources/schemas/mac_v2'),
        path.join(schemasDir, 'mac_v2'),
        { recursive: true },
    );

    return schemasDir;
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

/**
 * Creates complete English locale messages for the standard test entities.
 *
 * @returns {object} English locale messages keyed by entity kind.
 */
const createEnglishLocales = () => ({
    groups: [{ 'group.1.name': 'Group', 'group.1.description': 'Group description' }],
    tags: [{ 'tag.2.name': 'Tag', 'tag.2.description': 'Tag description' }],
    filters: [{ 'filter.25.name': 'Filter 25', 'filter.25.description': 'Filter 25 description' }],
});

/**
 * Creates German locale messages with the group description always missing,
 * so the fallback tests exercise the English fallback for it.
 *
 * @param {object} [options] Fixture options.
 * @param {boolean} [options.completeFilter] Include the German filter name
 * (the default); set to `false` to also leave the filter name missing.
 * @returns {object} German locale messages keyed by entity kind.
 */
const createGermanLocales = ({ completeFilter = true } = {}) => ({
    groups: [{ 'group.1.name': 'Gruppe' }],
    tags: [{ 'tag.2.name': 'Tag', 'tag.2.description': 'Tag-Beschreibung' }],
    filters: [{
        ...(completeFilter ? { 'filter.25.name': 'Filter 25' } : {}),
        'filter.25.description': 'Filter 25 Beschreibung',
    }],
});

/**
 * Creates a temporary validation fixture.
 *
 * @param {object} [options] Fixture options.
 * @param {object} [options.locales] Locale data.
 * @param {string} [options.platform] Platform directory name.
 * @param {object} [options.filtersMetadata] Contents of filters.json.
 * @param {object} [options.filtersI18n] Contents of filters_i18n.json.
 * @returns {object} Fixture paths and a cleanup function.
 */
const createValidationFixture = ({
    locales,
    platform,
    filtersMetadata,
    filtersI18n,
} = {}) => {
    const root = createTempDir('filters-compiler-json-validator-');
    const platformsPath = path.join(root, 'platforms');
    const localesPath = path.join(root, 'locales');
    const schemasDir = path.join(root, 'schemas');

    fs.mkdirSync(path.join(schemasDir, 'mac'), { recursive: true });
    fs.mkdirSync(path.join(schemasDir, 'mac_v2'), { recursive: true });

    if (locales) {
        createLocales(localesPath, locales);
    }

    if (platform) {
        createPlatform(platformsPath, platform, filtersMetadata, filtersI18n);
    }

    return {
        root,
        platformsPath,
        localesPath,
        schemasDir,
        logPath: path.join(root, 'validation.log'),
        cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
    };
};

/**
 * Runs a test body with a temporary validation fixture and cleans it up.
 *
 * @param {object} fixtureOptions Fixture options.
 * @param {Function} callback Test body.
 * @returns {*} Callback result.
 */
const withValidationFixture = async (fixtureOptions, callback) => {
    const fixture = createValidationFixture(fixtureOptions);

    try {
        return await callback(fixture);
    } finally {
        fixture.cleanup();
    }
};

describe('json validator', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        logger.close();
    });

    it('fills missing translations with English values and logs them', () => withValidationFixture({
        locales: {
            en: createEnglishLocales(),
            de: createGermanLocales({ completeFilter: false }),
        },
        platform: 'test',
        filtersMetadata: createFiltersMetadata(),
        filtersI18n: createFiltersI18n(),
    }, ({ platformsPath, localesPath, schemasDir }) => {
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

        const filtersI18n = readJson(path.join(platformsPath, 'test', 'filters_i18n.json'));
        expect(filtersI18n.groups['1'].de.description).toBe('Group description');
        expect(filtersI18n.filters['25'].de.name).toBe('Filter 25');
    }));

    it('validates several platforms in one call', () => withValidationFixture({
        locales: { en: createEnglishLocales() },
    }, ({ platformsPath, localesPath, schemasDir }) => {
        createPlatform(platformsPath, 'first', createFiltersMetadata(), createFiltersI18n({ includeDe: false }));
        createPlatform(platformsPath, 'second', createFiltersMetadata(), createFiltersI18n({ includeDe: false }));

        const result = schemaValidator.validate(
            platformsPath,
            schemasDir,
            1,
            { localesPath, requiredLocales: ['en'] },
        );

        expect(result).toBe(true);
    }));

    it('fails when a built entity has no English localization', () => withValidationFixture({
        locales: {
            en: {
                groups: [{ 'group.1.name': 'Group', 'group.1.description': 'Group description' }],
                tags: [{ 'tag.2.name': 'Tag', 'tag.2.description': 'Tag description' }],
                filters: [],
            },
        },
        platform: 'test',
        filtersMetadata: createFiltersMetadata(),
        filtersI18n: createFiltersI18n({ includeDe: false }),
    }, ({ platformsPath, localesPath, schemasDir }) => {
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
    }));

    it('fails when a required locale is absent for a built filter', () => {
        const filtersI18n = createFiltersI18n();
        delete filtersI18n.filters['25'].de;

        return withValidationFixture({
            locales: {
                en: createEnglishLocales(),
                de: {
                    groups: [{ 'group.1.name': 'Gruppe', 'group.1.description': 'Gruppenbeschreibung' }],
                    tags: [{ 'tag.2.name': 'Tag', 'tag.2.description': 'Tag-Beschreibung' }],
                    filters: [{ 'filter.25.name': 'Filter 25', 'filter.25.description': 'Filter 25 Beschreibung' }],
                },
            },
            platform: 'test',
            filtersMetadata: createFiltersMetadata(),
            filtersI18n,
        }, ({ platformsPath, localesPath, schemasDir }) => {
            vi.spyOn(logger, 'error').mockImplementation(() => {});

            const result = schemaValidator.validate(
                platformsPath,
                schemasDir,
                1,
                { localesPath, requiredLocales: ['en', 'de'] },
            );

            expect(result).toBe(false);
        });
    });

    it('validates locales outside requiredLocales', () => withValidationFixture({
        locales: {
            en: createEnglishLocales(),
            de: {
                groups: [{ 'group.1.name': 42 }],
                tags: [{ 'tag.2.name': 'Tag', 'tag.2.description': 'Tag-Beschreibung' }],
                filters: [{ 'filter.25.name': 'Filter 25', 'filter.25.description': 'Filter 25 Beschreibung' }],
            },
        },
        platform: 'test',
        filtersMetadata: createFiltersMetadata(),
        filtersI18n: createFiltersI18n({ deGroup: { name: 42 } }),
    }, ({ platformsPath, localesPath, schemasDir }) => {
        vi.spyOn(logger, 'error').mockImplementation(() => {});

        const result = schemaValidator.validate(
            platformsPath,
            schemasDir,
            1,
            { localesPath, requiredLocales: ['en'] },
        );

        expect(result).toBe(false);
    }));

    it('fails when filters.json is missing next to filters_i18n.json', () => withValidationFixture({
        locales: { en: createEnglishLocales() },
    }, ({ platformsPath, localesPath, schemasDir }) => {
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
        expect(errorSpy).toHaveBeenCalledWith(expect.stringMatching(
            /^Cannot read filters metadata for .*filters_i18n\.json: .*filters\.json is missing$/,
        ));
    }));

    it('writes fallback warnings to the log file', () => withValidationFixture({
        locales: {
            en: createEnglishLocales(),
            de: createGermanLocales(),
        },
        platform: 'test',
        filtersMetadata: createFiltersMetadata(),
        filtersI18n: createFiltersI18n({
            deFilter: { name: 'Filter 25', description: 'Filter 25 Beschreibung' },
        }),
    }, ({
        platformsPath,
        localesPath,
        schemasDir,
        logPath,
    }) => {
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
    }));

    it('appends fallback warnings to an existing log file', () => withValidationFixture({
        locales: {
            en: createEnglishLocales(),
            de: createGermanLocales(),
        },
        platform: 'test',
        filtersMetadata: createFiltersMetadata(),
        filtersI18n: createFiltersI18n(),
    }, ({
        platformsPath,
        localesPath,
        schemasDir,
        logPath,
    }) => {
        fs.writeFileSync(logPath, 'existing log line\n');

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
    }));

    it('closes the log file after validation', () => withValidationFixture({
        locales: {
            en: createEnglishLocales(),
            de: createGermanLocales(),
        },
        platform: 'test',
        filtersMetadata: createFiltersMetadata(),
        filtersI18n: createFiltersI18n(),
    }, ({
        platformsPath,
        localesPath,
        schemasDir,
        logPath,
    }) => {
        const firstResult = schemaValidator.validate(
            platformsPath,
            schemasDir,
            1,
            { localesPath, requiredLocales: ['en', 'de'], logPath },
        );

        expect(firstResult).toBe(true);

        // The log file must be closed: a later message must not reach it.
        logger.warn('logged after validation');
        const logAfterFirstCall = fs.readFileSync(logPath, 'utf8');
        expect(logAfterFirstCall).not.toContain('logged after validation');

        createPlatform(platformsPath, 'second', createFiltersMetadata(), createFiltersI18n());
        const secondResult = schemaValidator.validate(
            platformsPath,
            schemasDir,
            1,
            { localesPath, requiredLocales: ['en', 'de'] },
        );

        expect(secondResult).toBe(true);
        expect(fs.readFileSync(logPath, 'utf8')).toBe(logAfterFirstCall);
    }));

    it('throws when logPath cannot be opened', () => withValidationFixture({
        locales: { en: createEnglishLocales() },
        platform: 'test',
        filtersMetadata: createFiltersMetadata(),
        filtersI18n: createFiltersI18n({ includeDe: false }),
    }, ({
        platformsPath,
        localesPath,
        schemasDir,
        root,
    }) => {
        const logPath = path.join(root, 'log-directory');
        fs.mkdirSync(logPath);

        expect(() => schemaValidator.validate(
            platformsPath,
            schemasDir,
            1,
            { localesPath, requiredLocales: ['en'], logPath },
        )).toThrow();
    }));

    it('does not apply requiredFiltersAmount to nested platform directories', () => withValidationFixture({
        locales: { en: createEnglishLocales() },
        platform: 'test',
        filtersMetadata: createFiltersMetadata(),
        filtersI18n: createFiltersI18n({ includeDe: false }),
    }, ({ platformsPath, localesPath, schemasDir }) => {
        const result = schemaValidator.validate(
            platformsPath,
            schemasDir,
            80,
            { localesPath, requiredLocales: ['en'] },
        );

        expect(result).toBe(true);
    }));

    it('writes validation errors to the log file as text', () => withValidationFixture({
        locales: {
            en: createEnglishLocales(),
            de: {
                groups: [{ 'group.1.name': 42 }],
                tags: [{ 'tag.2.name': 'Tag', 'tag.2.description': 'Tag-Beschreibung' }],
                filters: [{ 'filter.25.name': 'Filter 25', 'filter.25.description': 'Filter 25 Beschreibung' }],
            },
        },
        platform: 'test',
        filtersMetadata: createFiltersMetadata(),
        filtersI18n: createFiltersI18n({ deGroup: { name: 42 } }),
    }, ({
        platformsPath,
        localesPath,
        schemasDir,
        logPath,
    }) => {
        const result = schemaValidator.validate(
            platformsPath,
            schemasDir,
            1,
            { localesPath, requiredLocales: ['en'], logPath },
        );

        expect(result).toBe(false);

        const log = fs.readFileSync(logPath, 'utf8');
        expect(log).toContain('must be string');
        expect(log).not.toContain('[object Object]');
    }));

    it('uses the frozen schema for legacy mac platforms', () => withValidationFixture({
        locales: { en: createEnglishLocales() },
    }, ({ platformsPath, localesPath, schemasDir }) => {
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
    }));

    it('builds the real platform tree and validates it with the shipped schema and legacy fixtures', async () => {
        const fixture = createIntegrationFixture();
        const platformsPath = createTempDir('filters-compiler-json-validator-platforms-');
        const schemasDir = createTestSchemasDir();
        const logPath = path.join(fixture.root, 'build.log');
        const reportPath = path.join(fixture.root, 'report.txt');

        try {
            const config = readJson(path.join(__dirname, 'resources/platforms.json'));

            disableOptimization();
            await build(fixture.filtersDir, logPath, reportPath, platformsPath, config);

            const result = schemaValidator.validate(
                platformsPath,
                schemasDir,
                2,
                { localesPath: fixture.localesPath, requiredLocales: ['en'] },
            );

            expect(result).toBe(true);
        } finally {
            logger.close();
            fs.rmSync(fixture.root, { recursive: true, force: true });
            fs.rmSync(platformsPath, { recursive: true, force: true });
            fs.rmSync(schemasDir, { recursive: true, force: true });
        }
    }, 180000);

    it('requires options.localesPath', () => {
        expect(() => schemaValidator.validate('platforms', 'schemas', 1)).toThrow(
            'validateJSONSchema: options.localesPath is required',
        );
    });
});
