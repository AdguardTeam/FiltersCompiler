import { FiltersDownloader, type DefinedExpressions } from '@adguard/filters-downloader';

/**
 * Preprocessor include directive prefix.
 */
const INCLUDE_DIRECTIVE = '!#include';

/**
 * Absolute external URL, including protocol-relative URLs. `file://` URLs are
 * excluded because they have no usable URL origin.
 */
const ABSOLUTE_EXTERNAL_URL = /^(?!file)(?:[a-z]+:)?\/\//i;

/**
 * Absolute URL with a scheme. Used to detect a remote default origin.
 */
const ABSOLUTE_URL = /^[a-z]+:\/\//i;

/**
 * Credentials in the authority component of an URL.
 */
const URL_CREDENTIALS = /^((?:[a-z][a-z0-9+.-]*:)?\/\/)[^/?#\s\\]*@/i;

/**
 * Removes credentials from the authority component of an URL.
 *
 * @param url URL to sanitize.
 *
 * @returns URL without credentials.
 */
const stripUrlCredentials = (url: string): string => url.replace(URL_CREDENTIALS, '$1');

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
 * Options for include resolution.
 */
export interface ResolveIncludesOptions {
    /**
     * The default origin comes from a remote `@include` URL. The caller must
     * set this flag because a remote URL with no path cannot be parsed into a
     * valid origin.
     */
    remoteOrigin?: boolean;
}

/**
 * Resolves preprocessor `!#include` directives.
 *
 * When the default origin is a local path, an absolute external include uses
 * its own origin, so the include validation accepts it and relative nested
 * includes resolve against the remote directory. All other lines use the
 * default origin. When the default origin is a remote URL, the directives are
 * delegated unchanged, so the downloader keeps its same-origin validation.
 *
 * @param lines Lines with rules and preprocessor directives.
 * @param defaultOrigin Origin for local and relative includes.
 * @param definedExpressions Defined expressions for condition resolution.
 * @param options Resolution options.
 *
 * @returns Resolved lines in the original order.
 *
 * @throws {RemoteIncludeError} If a local-path remote include cannot be resolved.
 */
export const resolveIncludes = async (
    lines: string[],
    defaultOrigin: string,
    definedExpressions?: DefinedExpressions,
    options?: ResolveIncludesOptions,
): Promise<string[]> => {
    const isRemoteOrigin = options?.remoteOrigin ?? ABSOLUTE_URL.test(defaultOrigin);

    if (isRemoteOrigin) {
        return FiltersDownloader.resolveIncludes(lines, defaultOrigin, definedExpressions);
    }

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
