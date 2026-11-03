import fs from 'node:fs';
import path from 'node:path';

import {
    ENTITY_KINDS,
    KEY_PREFIXES,
    LOCALE_FIELDS,
    parseLocaleMessages,
    type EntityKind,
    type LocaleEntry,
    type LocaleFileData,
    type LocaleMessages,
} from './utils/locale-messages';
import { readJson } from './utils/read-json';

/**
 * JSON Schema draft used by the generated schema.
 */
const SCHEMA_DRAFT = 'http://json-schema.org/draft-07/schema#';

/**
 * Base locale that supplies the fallback strings.
 */
const BASE_LOCALE = 'en';

/**
 * Prefix of the JSON pointers to the shared locale schema definitions.
 */
const LOCALE_DEFINITION_PREFIX = '#/definitions/';

/**
 * Entity metadata from a platform's filters.json.
 */
export interface FiltersMetadata {
    groups: Array<{ groupId: number }>;
    tags: Array<{ tagId: number }>;
    filters: Array<{ filterId: number }>;
}

/**
 * Locale data loaded from the FiltersRegistry locales directory.
 */
export interface RegistryLocales {
    /**
     * Locale directories that the schema validates.
     */
    availableLocales: string[];

    /**
     * Locales that must be present for every entity.
     */
    requiredLocales: string[];

    /**
     * Path to the base locale directory.
     */
    englishPath: string;

    /**
     * Base locale data for every entity kind.
     */
    englishData: Record<EntityKind, LocaleFileData>;
}

/**
 * Options for building the filters_i18n schema from already loaded locale data.
 */
export interface BuildFiltersI18nSchemaOptions {
    /**
     * Entity metadata from a platform's filters.json.
     */
    filtersMetadata: FiltersMetadata;

    /**
     * Locale data loaded from the FiltersRegistry locales directory.
     */
    registryLocales: RegistryLocales;
}

/**
 * Schema definition for a single locale object.
 */
export interface LocaleSchemaDefinition {
    type: 'object';
    required: string[];
    properties: Record<string, { type: 'string'; default: string }>;
}

/**
 * Schema definition for a single entity id.
 */
export interface EntityIdSchemaDefinition {
    type: 'object';
    required: string[];
    properties: Record<string, { $ref: string }>;
}

/**
 * Schema definition for a top-level entity kind.
 */
export interface EntityKindSchemaDefinition {
    type: 'object';
    required: string[];
    properties: Record<string, EntityIdSchemaDefinition>;
}

/**
 * Generated filters_i18n schema.
 */
export interface FiltersI18nSchema {
    definitions: Record<string, LocaleSchemaDefinition>;
    '$schema': string;
    type: 'object';
    title: string;
    required: string[];
    properties: Record<EntityKind, EntityKindSchemaDefinition>;
}

/**
 * A missing locale field that the schema fills with an English fallback.
 */
export interface MissingFallback {
    kind: EntityKind;
    id: string;
    locale: string;
    field: string;
    fallback: string;
}

/**
 * Parses a locale file into a map keyed by entity id.
 *
 * @param filePath Path to the locale file.
 * @param kind Entity kind.
 *
 * @returns Locale data keyed by entity id.
 */
const parseLocaleFile = (filePath: string, kind: EntityKind): LocaleFileData => {
    const messages = readJson<LocaleMessages>(filePath);

    return parseLocaleMessages(messages, KEY_PREFIXES[kind]);
};

/**
 * Returns the names of all locale directories.
 *
 * @param localesPath Path to the locales directory.
 *
 * @returns Sorted locale names.
 */
const getLocaleDirectories = (localesPath: string): string[] => {
    return fs
        .readdirSync(localesPath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
};

/**
 * Loads the base (English) locale data.
 *
 * @param englishPath Path to the base locale directory.
 *
 * @returns Base locale data for every entity kind.
 */
const loadEnglishLocales = (englishPath: string): Record<EntityKind, LocaleFileData> => {
    const englishData = {} as Record<EntityKind, LocaleFileData>;

    ENTITY_KINDS.forEach((kind) => {
        englishData[kind] = parseLocaleFile(path.join(englishPath, `${kind}.json`), kind);
    });

    return englishData;
};

/**
 * Loads the locale data that the generated schema depends on.
 *
 * @param localesPath Path to the locales directory.
 * @param requiredLocales Locales that must be present for every entity.
 * Defaults to all locale directories in `localesPath`.
 *
 * @returns Loaded locale data.
 *
 * @throws {Error} When a required locale directory is missing.
 */
export const loadRegistryLocales = (
    localesPath: string,
    requiredLocales?: string[],
): RegistryLocales => {
    const availableLocales = getLocaleDirectories(localesPath);
    const required = requiredLocales ?? availableLocales;
    const missingLocales = required.filter((locale) => !availableLocales.includes(locale));

    if (missingLocales.length > 0) {
        throw new Error(`Required locales are missing in ${localesPath}: ${missingLocales.join(', ')}`);
    }

    const englishPath = path.join(localesPath, BASE_LOCALE);

    return {
        availableLocales,
        requiredLocales: required,
        englishPath,
        englishData: loadEnglishLocales(englishPath),
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
): string[] => {
    return ENTITY_ID_GETTERS[kind](metadata).map((id) => String(id));
};

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
 * @throws {Error} When the English locale data is missing or empty.
 */
const createLocaleSchema = (
    entry: LocaleEntry,
    kind: EntityKind,
    id: string,
    englishPath: string,
): LocaleSchemaDefinition => {
    const properties: LocaleSchemaDefinition['properties'] = {};

    LOCALE_FIELDS.forEach((field) => {
        const value = entry[field];
        if (!value) {
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
 * Returns the name of an entity's shared locale schema definition.
 *
 * @param kind Entity kind.
 * @param id Entity id.
 *
 * @returns Definition name.
 */
const getDefinitionName = (kind: EntityKind, id: string): string => {
    return `${kind}.${id}`;
};

/**
 * Returns the JSON pointer for an entity's shared locale schema definition.
 *
 * @param kind Entity kind.
 * @param id Entity id.
 *
 * @returns JSON pointer to the definition.
 */
const getLocaleDefinitionRef = (kind: EntityKind, id: string): string => {
    return `${LOCALE_DEFINITION_PREFIX}${getDefinitionName(kind, id)}`;
};

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
): EntityIdSchemaDefinition => {
    return {
        type: 'object',
        required: requiredLocales,
        properties: Object.fromEntries(
            availableLocales.map((locale) => [locale, { $ref: getLocaleDefinitionRef(kind, id) }]),
        ),
    };
};

/**
 * Creates the shared locale schema definitions for an entity kind.
 *
 * @param kind Entity kind.
 * @param ids Entity ids.
 * @param englishData English locale data for the entity kind.
 * @param englishPath Path to the English locale directory.
 *
 * @returns Shared schema definitions, keyed by entity.
 *
 * @throws {Error} When an entity has no English locale data.
 */
const createDefinitions = (
    kind: EntityKind,
    ids: string[],
    englishData: LocaleFileData,
    englishPath: string,
): Record<string, LocaleSchemaDefinition> => {
    const definitions: Record<string, LocaleSchemaDefinition> = {};

    ids.forEach((id) => {
        const entry = englishData[id];
        if (!entry) {
            throw new Error(`Missing English localization for ${kind} ${id} in ${englishPath}`);
        }

        definitions[getDefinitionName(kind, id)] = createLocaleSchema(entry, kind, id, englishPath);
    });

    return definitions;
};

/**
 * Creates the schema for a top-level entity kind.
 *
 * @param kind Entity kind.
 * @param ids Entity ids.
 * @param availableLocales Locales that the schema validates.
 * @param requiredLocales Locales that must be present.
 *
 * @returns Schema definition for the top-level entity kind.
 */
const createKindSchema = (
    kind: EntityKind,
    ids: string[],
    availableLocales: string[],
    requiredLocales: string[],
): EntityKindSchemaDefinition => {
    return {
        type: 'object',
        required: ids,
        properties: Object.fromEntries(
            ids.map((id) => [id, createIdSchema(kind, id, availableLocales, requiredLocales)]),
        ),
    };
};

/**
 * Builds the filters_i18n JSON schema from already loaded locale data.
 *
 * The entity ids come from the platform metadata. The schema validates every
 * available locale. The required locales and the English fallback strings come
 * from the loaded locale data.
 *
 * @param options Schema build options.
 *
 * @returns Generated JSON schema.
 *
 * @throws {Error} When an English localization is missing or empty.
 */
export const buildFiltersI18nSchema = (
    { filtersMetadata, registryLocales }: BuildFiltersI18nSchemaOptions,
): FiltersI18nSchema => {
    const definitions: Record<string, LocaleSchemaDefinition> = {};
    const properties = {} as Record<EntityKind, EntityKindSchemaDefinition>;

    ENTITY_KINDS.forEach((kind) => {
        const ids = getEntityIds(filtersMetadata, kind);

        Object.assign(
            definitions,
            createDefinitions(kind, ids, registryLocales.englishData[kind], registryLocales.englishPath),
        );
        properties[kind] = createKindSchema(
            kind,
            ids,
            registryLocales.availableLocales,
            registryLocales.requiredLocales,
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

/**
 * Collects the locale fields that Ajv fills with an English fallback.
 *
 * Every locale property in the generated schema references one shared
 * definition per entity, so the definitions are read directly.
 *
 * @param json Parsed filters_i18n.json.
 * @param schema Generated filters_i18n schema.
 *
 * @returns Missing fields with their fallback values. The result is empty when
 * `json` is not an object, so that validation reports the document as invalid.
 */
export const collectMissingFallbacks = (json: unknown, schema: FiltersI18nSchema): MissingFallback[] => {
    const fallbacks: MissingFallback[] = [];

    if (!json || typeof json !== 'object' || Array.isArray(json)) {
        return fallbacks;
    }

    const data = json as Record<string, Record<string, Record<string, Record<string, string>>>>;

    ENTITY_KINDS.forEach((kind) => {
        Object.entries(schema.properties[kind].properties).forEach(([id, idSchema]) => {
            const idData = data[kind]?.[id];
            if (!idData) {
                return;
            }

            const localeSchema = schema.definitions[getDefinitionName(kind, id)];

            Object.keys(idSchema.properties).forEach((locale) => {
                const localeData = idData[locale];
                if (!localeData) {
                    return;
                }

                LOCALE_FIELDS.forEach((field) => {
                    if (localeData[field] !== undefined) {
                        return;
                    }

                    fallbacks.push({
                        kind,
                        id,
                        locale,
                        field,
                        fallback: localeSchema.properties[field].default,
                    });
                });
            });
        });
    });

    return fallbacks;
};
