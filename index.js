import path from 'path';
import { fileURLToPath } from 'url';

import * as compiler from './src/index';
import { schemaValidator } from './src/main/json-validator';

// `validateJSONSchema` is defined below because the development entry point
// resolves the schemas from the repository root instead of `dist/`.
export const {
    compile,
    localOptimizationStatistics,
    OptimizationStatsError,
    validateLocales,
} = compiler;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The bundled entry point resolves `./schemas/` relative to `dist/`; the
// unbundled development entry point uses the repository's root `schemas/`.
const jsonSchemasConfigDir = path.join(__dirname, 'schemas');

/**
 * Validates built filter files against the bundled JSON schemas.
 *
 * @param platformsPath Path to the built platform output.
 * @param requiredFiltersAmount Minimum number of filters expected.
 * @param options Validation options.
 * @returns `true` when all files are valid, `false` on validation failure.
 */
export const validateJSONSchema = (platformsPath, requiredFiltersAmount, options) => schemaValidator.validate(
    platformsPath,
    jsonSchemasConfigDir,
    requiredFiltersAmount,
    options,
);
