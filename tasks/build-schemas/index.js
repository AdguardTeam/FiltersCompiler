/**
 * @file
 *
 * Generates the JSON schema for filters.json and filters_i18n.json.
 *
 * Script is intended to simplify the process maintaining the schemas,
 * e.g. when new filter id or locale is added, much less manual work is needed.
 */

const { generateFiltersI18nSchema } = require('./build-filters-i18n-schema');
const { generateFiltersSchema } = require('./build-filters-schema');

generateFiltersI18nSchema();
generateFiltersSchema();
