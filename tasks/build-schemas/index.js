/**
 * @file
 *
 * Generates the JSON schema for filters.json and filters_i18n.json.
 *
 * Script is intended to simplify the process maintaining the schemas,
 * e.g. when new filter id or locale is added, much less manual work is needed.
 */

import { generateFiltersI18nSchema } from './build-filters-i18n-schema.js';
import { generateFiltersSchema } from './build-filters-schema.js';

generateFiltersI18nSchema();
generateFiltersSchema();
