/**
 * @vitest-environment jsdom
 */
import {
    describe,
    it,
    expect,
    vi,
} from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { schemaValidator } from '../src/main/json-validator';
import { build } from '../src/main/builder';
import { disableOptimization } from '../src/main/optimization';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Mock log to hide error messages
vi.mock('../main/utils/log');

describe('json validator', () => {
    // The test builds the whole platforms tree, which can take longer than the
    // default 5s timeout when other test files are building in parallel
    it('Test json validator', async () => {
        // Builds directory, otherwise validation would fail
        disableOptimization();
        const filtersDir = path.join(__dirname, './resources/filters');
        const logFile = path.join(__dirname, './resources/log.txt');
        const reportFile = path.join(__dirname, './resources/report.txt');

        // Use a unique temp platforms directory to avoid racing with builder.test.js,
        // which removes and rebuilds `test/resources/platforms` in parallel, and
        // with other local runs sharing the same fixed os.tmpdir() path
        const platformsPath = await fs.promises.mkdtemp(
            path.join(os.tmpdir(), 'filters-compiler-json-validator-platforms-'),
        );
        const platformsConfigFile = path.join(__dirname, './resources/platforms.json');

        try {
            const platformsConfig = JSON.parse(fs.readFileSync(platformsConfigFile, { encoding: 'utf-8' }));
            await build(filtersDir, logFile, reportFile, platformsPath, platformsConfig);

            // Test validation
            const jsonSchemasConfigDir = path.join(__dirname, './resources/schemas');
            expect(schemaValidator.validate(platformsPath, jsonSchemasConfigDir, 2)).toBeTruthy();
        } finally {
            await fs.promises.rm(platformsPath, { recursive: true, force: true });
        }
    }, 120000);
});
