import {
    describe,
    it,
    expect,
} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { readJson, readJsonOrNull } from '../src/main/utils/read-json';
import { withTempDir, writeJson } from './utils/fixtures';

describe('readJson', () => {
    it('reads and parses a JSON file', () => withTempDir('read-json-', (tempDir) => {
        const filePath = path.join(tempDir, 'data.json');
        writeJson(filePath, { value: 1 });

        expect(readJson(filePath)).toEqual({ value: 1 });
    }));

    it('reports the file path when the file is malformed', () => withTempDir('read-json-', (tempDir) => {
        const filePath = path.join(tempDir, 'data.json');
        fs.writeFileSync(filePath, '{');

        expect(() => readJson(filePath)).toThrow(/Cannot parse .*data\.json/);
    }));

    it('throws when the file is missing', () => withTempDir('read-json-', (tempDir) => {
        expect(() => readJson(path.join(tempDir, 'missing.json'))).toThrow(/ENOENT/);
    }));
});

describe('readJsonOrNull', () => {
    it('returns null when the file is missing', () => withTempDir('read-json-', (tempDir) => {
        expect(readJsonOrNull(path.join(tempDir, 'missing.json'))).toBeNull();
    }));

    it('reports the file path when the file is malformed', () => withTempDir('read-json-', (tempDir) => {
        const filePath = path.join(tempDir, 'data.json');
        fs.writeFileSync(filePath, '{');

        expect(() => readJsonOrNull(filePath)).toThrow(/Cannot parse .*data\.json/);
    }));
});
