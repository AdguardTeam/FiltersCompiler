import fs from 'node:fs';
import path from 'node:path';

/**
 * JSON Schema draft used by the generated schema.
 */
const SCHEMA_DRAFT = 'http://json-schema.org/draft-07/schema#';

/**
 * Top-level entity kinds in filters_i18n.json.
 */
export const ENTITY_KINDS = ['groups', 'tags', 'filters'] as const;

/**
 * Entity kind.
 */
type EntityKind = typeof ENTITY_KINDS[number];

/**
 * Fields that every locale object must contain.
 */
export const LOCALE_FIELDS = ['name', 'description'] as const;

/**
 * Locale field name.
 */
type LocaleField = typeof LOCALE_FIELDS[number];

/**
 * Prefix of the dotted keys in locale files, for example `group.1.name`.
 */
const KEY_PREFIXES: Record<EntityKind, string> = {
    groups: 'group',
    tags: 'tag',
    filters: 'filter',
};

/**
 * Locale data for a single entity.
 */
type LocaleEntry = Partial<Record<LocaleField, string>>;

/**
 * Locale data keyed by entity id.
 */
type LocaleData = Record<string, LocaleEntry>;

/**
 * Entity metadata from a platform's filters.json.
 */
export interface FiltersMetadata {
    groups: Array<{ groupId: number }>;
    tags: Array<{ tagId: number }>;
    filters: Array<{ filterId: number }>;
}

/**
 * Options for generating the filters_i18n schema.
 */
export interface FiltersI18nSchemaOptions {
    /**
     * Path to the FiltersRegistry locales directory.
     */
    localesPath: string;

    /**
     * Entity metadata from a platform's filters.json.
     */
    filtersMetadata: FiltersMetadata;

    /**
     * Locales that must be present for every entity.
     * Defaults to all locale directories in `localesPath`.
     *
     * The schema validates every locale directory in `localesPath`, even when
     * this list contains a subset.
     */
    requiredLocales?: string[];
}

/**
 * Reads and parses a JSON file.
 *
 * @param filePath Path to the JSON file.
 *
 * @returns Parsed JSON value.
 *
 * @throws {Error} When the file cannot be parsed as JSON.
 */
const readJson = <T>(filePath: string): T => {
    const content = fs.readFileSync(filePath, 'utf8');

    try {
        return JSON.parse(content) as T;
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        throw new Error(`Cannot parse ${filePath}: ${message}`);
    }
};

/**
 * Parses a locale file into a map keyed by entity id.
 *
 * @param filePath Path to the locale file.
 * @param kind Entity kind.
 *
 * @returns Locale data keyed by entity id.
 */
const parseLocaleFile = (filePath: string, kind: EntityKind): LocaleData => {
    const messages = readJson<Array<Record<string, string>>>(filePath);
    const data: LocaleData = {};
    const keyPattern = new RegExp(`^${KEY_PREFIXES[kind]}\\.(\\d+)\\.(${LOCALE_FIELDS.join('|')})$`);

    messages.forEach((message) => {
        Object.entries(message).forEach(([key, value]) => {
            const match = keyPattern.exec(key);
            if (!match) {
                return;
            }

            const [, id, field] = match;
            data[id] = data[id] ?? {};
            data[id][field as LocaleField] = value;
        });
    });

    return data;
};

/**
 * Returns the names of all locale directories.
 *
 * @param localesPath Path to the locales directory.
 *
 * @returns Sorted locale names.
 */
const getLocaleDirectories = (localesPath: string): string[] => fs
    .readdirSync(localesPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

/**
 * Loads the base (English) locale data.
 *
 * @param localesPath Path to the locales directory.
 *
 * @returns English locale data for every entity kind.
 */
const loadEnglishLocales = (localesPath: string): Record<EntityKind, LocaleData> => {
    const englishPath = path.join(localesPath, 'en');

    return {
        groups: parseLocaleFile(path.join(englishPath, 'groups.json'), 'groups'),
        tags: parseLocaleFile(path.join(englishPath, 'tags.json'), 'tags'),
        filters: parseLocaleFile(path.join(englishPath, 'filters.json'), 'filters'),
    };
};

/**
 * Entity id getters keyed by entity kind.
 *
 * A `Record` makes a missing kind a TypeScript error, unlike a `switch` with
 * an unreachable default branch.
 */
const ENTITY_ID_GETTERS: Record<EntityKind, (metadata: FiltersMetadata) => number[]> = {
    groups: (metadata) => metadata.groups.map((group) => group.groupId),
    tags: (metadata) => metadata.tags.map((tag) => tag.tagId),
    filters: (metadata) => metadata.filters.map((filter) => filter.filterId),
};

/**
 * Returns the entity ids from the platform metadata.
 *
 * @param metadata Platform metadata from filters.json.
 * @param kind Entity kind.
 *
 * @returns Entity ids as strings.
 */
export const getEntityIds = (
    metadata: FiltersMetadata,
    kind: EntityKind,
): string[] => ENTITY_ID_GETTERS[kind](metadata).map((id) => String(id));

/**
 * Creates the schema for a single locale object.
 *
 * @param entry English locale data for the entity.
 * @param kind Entity kind.
 * @param id Entity id.
 * @param englishPath Path to the English locale directory.
 *
 * @returns Schema definition for the locale object.
 *
 * @throws {Error} When the English locale data is incomplete.
 */
const createLocaleSchema = (
    entry: LocaleEntry,
    kind: EntityKind,
    id: string,
    englishPath: string,
): Record<string, unknown> => {
    const properties: Record<string, { type: string; default: string }> = {};

    LOCALE_FIELDS.forEach((field) => {
        const value = entry[field];
        if (value === undefined) {
            throw new Error(`Missing English ${field} for ${kind} ${id} in ${englishPath}`);
        }

        properties[field] = {
            type: 'string',
            default: value,
        };
    });

    return {
        type: 'object',
        required: [...LOCALE_FIELDS],
        properties,
    };
};

/**
 * Returns the JSON pointer for an entity's shared locale schema definition.
 *
 * @param kind Entity kind.
 * @param id Entity id.
 *
 * @returns JSON pointer to the definition.
 */
const getLocaleDefinitionRef = (kind: EntityKind, id: string): string => `#/definitions/${kind}.${id}`;

/**
 * Creates the schema for a single entity id.
 *
 * Every locale references one shared definition instead of embedding a copy
 * of the same subschema. This keeps the generated schema small and makes Ajv
 * compile it faster.
 *
 * @param kind Entity kind.
 * @param id Entity id.
 * @param availableLocales Locales that the schema validates.
 * @param requiredLocales Locales that must be present.
 *
 * @returns Schema definition for the entity id.
 */
const createIdSchema = (
    kind: EntityKind,
    id: string,
    availableLocales: string[],
    requiredLocales: string[],
): Record<string, unknown> => ({
    type: 'object',
    required: requiredLocales,
    properties: Object.fromEntries(
        availableLocales.map((locale) => [locale, { $ref: getLocaleDefinitionRef(kind, id) }]),
    ),
});

/**
 * Creates the schema for a top-level entity kind.
 *
 * @param kind Entity kind.
 * @param ids Entity ids.
 * @param englishData English locale data for the entity kind.
 * @param availableLocales Locales that the schema validates.
 * @param requiredLocales Locales that must be present.
 * @param englishPath Path to the English locale directory.
 * @param definitions Shared schema definitions, keyed by entity.
 *
 * @returns Schema definition for the top-level entity kind.
 *
 * @throws {Error} When an entity has no English locale data.
 */
const createTopLevelSchema = (
    kind: EntityKind,
    ids: string[],
    englishData: LocaleData,
    availableLocales: string[],
    requiredLocales: string[],
    englishPath: string,
    definitions: Record<string, unknown>,
): Record<string, unknown> => {
    const properties: Record<string, unknown> = {};

    ids.forEach((id) => {
        const entry = englishData[id];
        if (!entry) {
            throw new Error(`Missing English localization for ${kind} ${id} in ${englishPath}`);
        }

        definitions[`${kind}.${id}`] = createLocaleSchema(entry, kind, id, englishPath);
        properties[id] = createIdSchema(kind, id, availableLocales, requiredLocales);
    });

    return {
        type: 'object',
        required: ids,
        properties,
    };
};

/**
 * Generates the filters_i18n JSON schema from FiltersRegistry data.
 *
 * The entity ids come from the platform metadata. The schema validates every
 * locale directory in the locales path. The required locales and the English
 * fallback strings come from the locales directory. The compiler does not
 * keep its own copy of filter, group, or tag text.
 *
 * @param options Schema generation options.
 *
 * @returns Generated JSON schema.
 *
 * @throws {Error} When a required locale or an English localization is missing.
 */
export const generateFiltersI18nSchema = (options: FiltersI18nSchemaOptions): Record<string, unknown> => {
    const { localesPath, filtersMetadata, requiredLocales } = options;

    const availableLocales = getLocaleDirectories(localesPath);
    const required = requiredLocales ?? availableLocales;
    const missingLocales = required.filter((locale) => !availableLocales.includes(locale));

    if (missingLocales.length > 0) {
        throw new Error(`Required locales are missing in ${localesPath}: ${missingLocales.join(', ')}`);
    }

    const englishPath = path.join(localesPath, 'en');
    const englishData = loadEnglishLocales(localesPath);
    const properties: Record<string, unknown> = {};
    const definitions: Record<string, unknown> = {};

    ENTITY_KINDS.forEach((kind) => {
        const ids = getEntityIds(filtersMetadata, kind);
        properties[kind] = createTopLevelSchema(
            kind,
            ids,
            englishData[kind],
            availableLocales,
            required,
            englishPath,
            definitions,
        );
    });

    // Do not add `$id`: Ajv caches compiled schemas by id, and every platform
    // gets its own generated schema.
    return {
        definitions,
        '$schema': SCHEMA_DRAFT,
        type: 'object',
        title: 'The Root Schema',
        required: [...ENTITY_KINDS],
        properties,
    };
};
