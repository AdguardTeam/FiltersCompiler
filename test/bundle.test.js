/**
 * @file Smoke tests for verifying the npm package bundle includes all required files.
 *
 * These tests ensure that critical files like trust-level exclusions
 * are properly bundled in the dist folder and will be available
 * when the package is published to npm.
 */
import {
    describe,
    it,
    expect,
} from 'vitest';
import path from 'path';
import { existsSync, readFileSync } from 'fs';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const distDir = path.join(__dirname, '../dist');

describe('Bundle smoke tests', () => {
    describe('Trust-level exclusion files', () => {
        const trustLevelsDir = path.join(distDir, 'utils/trust-levels');

        const trustLevelFiles = [
            'exclusions-low.txt',
            'exclusions-high.txt',
            'exclusions-full.txt',
        ];

        it('trust-levels directory should exist in dist', () => {
            expect(existsSync(trustLevelsDir)).toBe(true);
        });

        trustLevelFiles.forEach((filename) => {
            describe(`${filename}`, () => {
                const filePath = path.join(trustLevelsDir, filename);

                it('should exist', () => {
                    expect(existsSync(filePath)).toBe(true);
                });

                it('should not be empty', () => {
                    const content = readFileSync(filePath, 'utf-8');
                    expect(content.length).toBeGreaterThan(0);
                });
            });
        });

        it('exclusions-low.txt should contain #$# exclusion pattern', () => {
            const filePath = path.join(trustLevelsDir, 'exclusions-low.txt');
            const content = readFileSync(filePath, 'utf-8');
            // #$# is a CSS injection rule marker that should be excluded for low trust level
            expect(content).toContain('#$#');
        });

        it('exclusions-low.txt should contain #%# exclusion pattern', () => {
            const filePath = path.join(trustLevelsDir, 'exclusions-low.txt');
            const content = readFileSync(filePath, 'utf-8');
            // #%# is a JS injection rule marker that should be excluded for low trust level
            expect(content).toContain('#%#');
        });

        it('exclusions-low.txt should contain $replace exclusion pattern', () => {
            const filePath = path.join(trustLevelsDir, 'exclusions-low.txt');
            const content = readFileSync(filePath, 'utf-8');
            // $replace modifier should be excluded for low trust level
            expect(content).toContain('$replace');
        });
    });

    describe('Schema files', () => {
        const schemasDir = path.join(distDir, 'schemas');

        it('schemas directory should exist in dist', () => {
            expect(existsSync(schemasDir)).toBe(true);
        });

        it('filters.schema.json should exist', () => {
            const filePath = path.join(schemasDir, 'filters.schema.json');
            expect(existsSync(filePath)).toBe(true);
        });

        it('filters_i18n.schema.json should exist', () => {
            const filePath = path.join(schemasDir, 'filters_i18n.schema.json');
            expect(existsSync(filePath)).toBe(true);
        });
    });

    describe('Main entry points', () => {
        it('dist/index.js (ESM) should exist', () => {
            const filePath = path.join(distDir, 'index.js');
            expect(existsSync(filePath)).toBe(true);
        });

        it('dist/index.cjs (CommonJS) should exist', () => {
            const filePath = path.join(distDir, 'index.cjs');
            expect(existsSync(filePath)).toBe(true);
        });
    });
});
