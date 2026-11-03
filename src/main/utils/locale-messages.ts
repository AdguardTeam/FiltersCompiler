/**
 * Locale file parsing shared by the platform generator and the
 * `filters_i18n` schema generator.
 *
 * Both modules read the same FiltersRegistry locale files. Keeping one parser
 * makes sure they agree on which keys are valid and on how a key maps to an
 * entity id and a field.
 */

/**
 * Top-level entity kinds in `filters_i18n.json`.
 */
export const ENTITY_KINDS = ['groups', 'tags', 'filters'] as const;

/**
 * Entity kind.
 */
export type EntityKind = typeof ENTITY_KINDS[number];

/**
 * Fields that every locale object must contain.
 */
export const LOCALE_FIELDS = ['name', 'description'] as const;

/**
 * Locale field name.
 */
export type LocaleField = typeof LOCALE_FIELDS[number];

/**
 * Prefix of the dotted keys in locale files, for example `group.1.name`.
 */
export const KEY_PREFIXES: Record<EntityKind, string> = {
    groups: 'group',
    tags: 'tag',
    filters: 'filter',
};

/**
 * Locale data for a single entity.
 */
export type LocaleEntry = Partial<Record<LocaleField, string>>;

/**
 * Locale data keyed by entity id.
 */
export type LocaleFileData = Record<string, LocaleEntry>;

/**
 * Parses the messages of one locale file into entity data keyed by id.
 *
 * A key must match `<prefix>.<numeric id>.<name|description>`. Other keys are
 * ignored, so a malformed key cannot add a field that the schema does not
 * know.
 *
 * @param messages Parsed locale file contents, or `null` when the file is
 * missing.
 * @param keyPrefix Entity key prefix, for example `filter`.
 * @param sourcePath Path to the locale file, used in the error message.
 *
 * @returns Locale data keyed by entity id.
 *
 * @throws {TypeError} When the locale file contents are neither `null` nor an
 * array of message objects.
 */
export const parseLocaleMessages = (
    messages: unknown,
    keyPrefix: string,
    sourcePath: string,
): LocaleFileData => {
    const data: LocaleFileData = {};

    if (messages === null || messages === undefined) {
        return data;
    }

    if (
        !Array.isArray(messages)
        || messages.some((message) => !message || typeof message !== 'object' || Array.isArray(message))
    ) {
        throw new TypeError(`Locale file ${sourcePath} must contain an array of message objects`);
    }

    const keyPattern = new RegExp(`^${keyPrefix}\\.(\\d+)\\.(${LOCALE_FIELDS.join('|')})$`);

    messages.forEach((message: Record<string, string>) => {
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
