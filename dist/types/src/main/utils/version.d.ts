/**
 * Version utility class.
 */
export declare class Version {
    /**
     * Parses version from string.
     *
     * @param v Version string.
     * @returns Array of numeric version parts.
     */
    static parse(v: string | null | undefined): number[];
    /**
     * Increments the build (last) part of a version string `'0.0.0.0'`.
     * Carries over when a part reaches 100.
     *
     * @param v Version string.
     * @returns Incremented version string.
     */
    static increment(v: string | null | undefined): string;
}
