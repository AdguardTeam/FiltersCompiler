export const ROOT_DIR_RELATIVE_PATH = '../..';
export const OUTPUT_SCHEMAS_DIR = 'schemas';

export const SCHEMA_DRAFT = 'http://json-schema.org/draft-07/schema#';

export const FILTERS_I18N_SCHEMA_ID = 'http://adguard.com/filters_i18n.json';
export const FILTERS_SCHEMA_ID = 'http://adguard.com/filters.json';

export const GROUPS_KEY = 'groups';
export const TAGS_KEY = 'tags';
export const FILTERS_KEY = 'filters';

export const GROUP_ID_KEY = 'groupId';
export const GROUP_NAME_KEY = 'groupName';
export const GROUP_DESCRIPTION_KEY = 'groupDescription';
export const DISPLAY_NUMBER_KEY = 'displayNumber';
export const FILTER_ID_KEY = 'filterId';
export const NAME_KEY = 'name';
export const DESCRIPTION_KEY = 'description';
export const TIME_ADDED_KEY = 'timeAdded';
export const HOMEPAGE_KEY = 'homepage';
export const DEPRECATED_KEY = 'deprecated';
export const EXPIRES_KEY = 'expires';
export const SUBSCRIPTION_URL_KEY = 'subscriptionUrl';
export const DOWNLOAD_URL_KEY = 'downloadUrl';
export const VERSION_KEY = 'version';
export const TIME_UPDATED_KEY = 'timeUpdated';
export const LANGUAGES_KEY = 'languages';
export const TAG_ID_KEY = 'tagId';
export const KEYWORD_KEY = 'keyword';

/**
 * Every language object must have a "name" and "description" field.
 */
export const REQUIRED_FIELDS_PER_LOCALE = [
    NAME_KEY,
    DESCRIPTION_KEY,
];

/**
 * The list of supported locales.
 *
 * Should be the same listed in scripts/translations/download.sh in FiltersRegistry.
 *
 * TODO: consider refactoring and passing this list from the FiltersRegistry repo.
 */
export const SUPPORTED_LOCALES = [
    'ar',
    'be',
    'bg',
    'ca',
    'cs',
    'da',
    'de',
    'el',
    'en',
    'es',
    'es_ES', // duplicate of 'es'
    'fa',
    'fi',
    'fr',
    'he',
    'hi',
    'hr',
    'hu',
    'hy',
    'id',
    'it',
    'ja',
    'ko',
    'lt',
    'mk',
    'ms',
    'nl',
    'no',
    'pl',
    'pt',
    'pt_BR',
    'pt_PT',
    'ro',
    'ru',
    'sk',
    'sl',
    'sr',
    'sv',
    'th',
    'tr',
    'uk',
    'vi',
    'zh', // "zh_CN" is saved as "zh" in FiltersRegistry
    'zh_TW',
];

export const SCHEMA_TYPES = {
    INTEGER: 'integer',
    STRING: 'string',
    BOOLEAN: 'boolean',
    ARRAY: 'array',
    OBJECT: 'object',
};

export const STRING_PATTERN = '^(.*)$';
