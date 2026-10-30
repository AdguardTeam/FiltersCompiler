/**
 * Names of the metadata files that the platform generator writes and the JSON
 * validator reads.
 *
 * Every file is written twice: once as JSON and once as a JavaScript copy
 * (AG-20175). The base name is defined here so that both consumers use the
 * same spelling.
 */

/**
 * Name of the filters metadata file without its extension.
 */
export const FILTERS_METADATA_FILE_NAME = 'filters';

/**
 * Name of the filters localization file without its extension.
 */
export const FILTERS_I18N_METADATA_FILE_NAME = 'filters_i18n';

/**
 * Name of the filters metadata JSON file.
 */
export const FILTERS_METADATA_FILE_JSON = `${FILTERS_METADATA_FILE_NAME}.json`;

/**
 * Name of the filters metadata JavaScript copy.
 */
export const FILTERS_METADATA_FILE_JS = `${FILTERS_METADATA_FILE_NAME}.js`;

/**
 * Name of the filters localization JSON file.
 */
export const FILTERS_I18N_METADATA_FILE_JSON = `${FILTERS_I18N_METADATA_FILE_NAME}.json`;

/**
 * Name of the filters localization JavaScript copy.
 */
export const FILTERS_I18N_METADATA_FILE_JS = `${FILTERS_I18N_METADATA_FILE_NAME}.js`;
