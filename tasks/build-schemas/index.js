/**
 * @file
 *
 * Generates the JSON schema for filters.json.
 *
 * The filters_i18n schema is generated at runtime by validateJSONSchema()
 * from FiltersRegistry data. It is not stored in this repository.
 */

import { generateFiltersSchema } from './build-filters-schema.js';

generateFiltersSchema();
