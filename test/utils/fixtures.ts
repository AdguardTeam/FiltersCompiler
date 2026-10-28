import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Locale messages for a single locale file.
 */
export type LocaleMessages = Record<string, string>;

/**
 * Locale data keyed by locale name and entity kind.
 */
export type LocalesData = Record<string, Record<string, LocaleMessages[]>>;

/**
 * Creates a temporary directory.
 *
 * @param prefix Directory name prefix.
 *
 * @returns Path to the created directory.
 */
export const createTempDir = (prefix: string): string => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

/**
 * Writes a value as formatted JSON, creating parent directories as needed.
 *
 * @param filePath Path to the JSON file.
 * @param data Value to serialize.
 */
export const writeJson = (filePath: string, data: unknown): void => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, '\t'));
};

/**
 * Reads and parses a JSON file.
 *
 * @param filePath Path to the JSON file.
 *
 * @returns Parsed value.
 */
export const readJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;

/**
 * Writes locale files for the given locales.
 *
 * @param localesPath Path to the locales directory.
 * @param locales Locale data keyed by locale name and entity kind.
 */
export const createLocales = (localesPath: string, locales: LocalesData): void => {
    Object.entries(locales).forEach(([locale, data]) => {
        Object.entries(data).forEach(([kind, messages]) => {
            writeJson(path.join(localesPath, locale, `${kind}.json`), messages);
        });
    });
};

/**
 * Runs a test body with a temporary directory and removes it afterwards.
 *
 * @param prefix Directory name prefix.
 * @param callback Test body receiving the directory path.
 *
 * @returns Callback result.
 */
export const withTempDir = <T>(prefix: string, callback: (dir: string) => T): T => {
    const dir = createTempDir(prefix);

    try {
        return callback(dir);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
};
