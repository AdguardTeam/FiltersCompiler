import fs from 'node:fs';

/**
 * Parses JSON content and adds the file path to a parse error.
 *
 * @param content JSON content.
 * @param filePath Path to the JSON file.
 *
 * @returns Parsed JSON value.
 *
 * @throws {Error} When the content cannot be parsed as JSON.
 */
const parseJson = <T>(content: string, filePath: string): T => {
    try {
        return JSON.parse(content) as T;
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        throw new Error(`Cannot parse ${filePath}: ${message}`);
    }
};

/**
 * Reads and parses a JSON file.
 *
 * @param filePath Path to the JSON file.
 *
 * @returns Parsed JSON value.
 *
 * @throws {Error} When the file cannot be read or parsed as JSON.
 */
export const readJson = <T>(filePath: string): T => {
    const content = fs.readFileSync(filePath, 'utf8');

    return parseJson<T>(content, filePath);
};

/**
 * Reads and parses a JSON file, returning `null` when the file does not exist.
 *
 * @param filePath Path to the JSON file.
 *
 * @returns Parsed JSON value, or `null` when the file does not exist.
 *
 * @throws {Error} When the file exists but cannot be read or parsed as JSON.
 */
export const readJsonOrNull = <T>(filePath: string): T | null => {
    let content: string;

    try {
        content = fs.readFileSync(filePath, 'utf8');
    } catch (e) {
        if ((e as { code?: string }).code === 'ENOENT') {
            return null;
        }

        throw e;
    }

    return parseJson<T>(content, filePath);
};
