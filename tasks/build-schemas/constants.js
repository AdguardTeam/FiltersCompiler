const ROOT_DIR_RELATIVE_PATH = '../..';
const OUTPUT_SCHEMAS_DIR = 'schemas';

const SCHEMA_DRAFT = 'http://json-schema.org/draft-07/schema#';

const FILTERS_I18N_SCHEMA_ID = 'http://adguard.com/filters_i18n.json';
const FILTERS_SCHEMA_ID = 'http://adguard.com/filters.json';

const GROUPS_KEY = 'groups';
const TAGS_KEY = 'tags';
const FILTERS_KEY = 'filters';

const GROUP_ID_KEY = 'groupId';
const GROUP_NAME_KEY = 'groupName';
const GROUP_DESCRIPTION_KEY = 'groupDescription';
const DISPLAY_NUMBER_KEY = 'displayNumber';
const FILTER_ID_KEY = 'filterId';
const NAME_KEY = 'name';
const DESCRIPTION_KEY = 'description';
const TIME_ADDED_KEY = 'timeAdded';
const HOMEPAGE_KEY = 'homepage';
const DEPRECATED_KEY = 'deprecated';
const EXPIRES_KEY = 'expires';
const SUBSCRIPTION_URL_KEY = 'subscriptionUrl';
const DOWNLOAD_URL_KEY = 'downloadUrl';
const VERSION_KEY = 'version';
const TIME_UPDATED_KEY = 'timeUpdated';
const LANGUAGES_KEY = 'languages';
const TAG_ID_KEY = 'tagId';
const KEYWORD_KEY = 'keyword';

/**
 * Every language object must have a "name" and "description" field.
 */
const REQUIRED_FIELDS_PER_LOCALE = [
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
const SUPPORTED_LOCALES = [
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
    'hr',
    'hu',
    'id',
    'it',
    'ja',
    'ko',
    'mk',
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
    'tr',
    'uk',
    'vi',
    'zh', // "zh_CN" is saved as "zh" in FiltersRegistry
    'zh_TW',
];

const SCHEMA_TYPES = {
    INTEGER: 'integer',
    STRING: 'string',
    BOOLEAN: 'boolean',
    ARRAY: 'array',
    OBJECT: 'object',
};

const STRING_PATTERN = '^(.*)$';

module.exports = {
    ROOT_DIR_RELATIVE_PATH,
    OUTPUT_SCHEMAS_DIR,
    FILTERS_I18N_SCHEMA_ID,
    FILTERS_SCHEMA_ID,
    SCHEMA_DRAFT,
    SUPPORTED_LOCALES,
    REQUIRED_FIELDS_PER_LOCALE,
    GROUPS_KEY,
    TAGS_KEY,
    FILTERS_KEY,
    GROUP_ID_KEY,
    GROUP_NAME_KEY,
    GROUP_DESCRIPTION_KEY,
    DISPLAY_NUMBER_KEY,
    FILTER_ID_KEY,
    NAME_KEY,
    DESCRIPTION_KEY,
    TIME_ADDED_KEY,
    HOMEPAGE_KEY,
    DEPRECATED_KEY,
    EXPIRES_KEY,
    SUBSCRIPTION_URL_KEY,
    DOWNLOAD_URL_KEY,
    VERSION_KEY,
    TIME_UPDATED_KEY,
    LANGUAGES_KEY,
    TAG_ID_KEY,
    KEYWORD_KEY,
    SCHEMA_TYPES,
    STRING_PATTERN,
};
