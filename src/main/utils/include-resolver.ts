import { FiltersDownloader, type DefinedExpressions } from '@adguard/filters-downloader';

/**
 * Preprocessor include directive prefix.
 */
const INCLUDE_DIRECTIVE = '!#include';

/**
 * Absolute external URL. `file://` URLs are excluded because they have no
 * usable URL origin.
 */
const ABSOLUTE_EXTERNAL_URL = /^(?!file)[a-z]+:\/\//i;

/**
 * Userinfo component of an URL, used to keep credentials out of error messages.
 */
const URL_CREDENTIALS = /\/\/[^/?#@]+@/;

/**
 * Removes the userinfo component from an URL.
 *
 * @param url URL to sanitize.
 *
 * @returns URL without credentials.
 */
const stripUrlCredentials = (url: string): string => url.replace(URL_CREDENTIALS, '//');

/**
 * Error thrown when a remote preprocessor `!#include` cannot be resolved.
 */
export class RemoteIncludeError extends Error {
    /**
     * URL of the include directive that failed to resolve.
     */
    public readonly url: string;

    /**
     * Creates a remote include error.
     *
     * @param url URL of the include directive that failed to resolve.
     * @param cause Underlying error.
     */
    constructor(url: string, cause: unknown) {
        const reason = cause instanceof Error ? cause.message : String(cause);
        super(`Error resolving remote include '${stripUrlCredentials(url)}': ${reason}`);
        this.name = 'RemoteIncludeError';
        this.url = url;
    }
}

/**
 * Returns the absolute external URL from a preprocessor include directive line.
 *
 * @param line Line to check.
 *
 * @returns Include URL or `null` if the line is not a remote include.
 */
export const getRemoteIncludeUrl = (line: string): string | null => {
    if (!line.startsWith(INCLUDE_DIRECTIVE)) {
        return null;
    }

    const url = line.substring(INCLUDE_DIRECTIVE.length).trim();

    return ABSOLUTE_EXTERNAL_URL.test(url) ? url : null;
};

/**
 * Resolves preprocessor `!#include` directives.
 *
 * An absolute external include uses its own origin, so the include validation
 * accepts it and relative nested includes resolve against the remote directory.
 * All other lines use the default origin, so local and relative includes keep
 * their existing behavior.
 *
 * @param lines Lines with rules and preprocessor directives.
 * @param defaultOrigin Origin for local and relative includes.
 * @param definedExpressions Defined expressions for condition resolution.
 *
 * @returns Resolved lines in the original order.
 *
 * @throws {RemoteIncludeError} If a remote include cannot be resolved.
 */
export const resolveIncludes = async (
    lines: string[],
    defaultOrigin: string,
    definedExpressions?: DefinedExpressions,
): Promise<string[]> => {
    let result: string[] = [];
    let batch: string[] = [];

    const resolveBatch = async (): Promise<void> => {
        if (batch.length === 0) {
            return;
        }

        const resolved = await FiltersDownloader.resolveIncludes(batch, defaultOrigin, definedExpressions);
        result = result.concat(resolved);
        batch = [];
    };

    // eslint-disable-next-line no-restricted-syntax
    for (const line of lines) {
        const remoteUrl = getRemoteIncludeUrl(line);

        if (!remoteUrl) {
            batch.push(line);
            continue;
        }

        // eslint-disable-next-line no-await-in-loop
        await resolveBatch();

        try {
            // eslint-disable-next-line no-await-in-loop
            const resolved = await FiltersDownloader.resolveIncludes(
                [line],
                FiltersDownloader.getFilterUrlOrigin(remoteUrl),
                definedExpressions,
            );
            result = result.concat(resolved);
        } catch (e) {
            throw new RemoteIncludeError(remoteUrl, e);
        }
    }

    await resolveBatch();

    return result;
};
