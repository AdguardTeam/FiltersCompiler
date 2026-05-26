/**
 * Version utility class.
 */
export class Version {
    /**
     * Parses version from string.
     *
     * @param v Version string.
     * @returns Array of numeric version parts.
     */
    static parse(v: string | null | undefined): number[] {
        const parts = String(v ?? '').split('.');

        const parseVersionPart = (part: string): number => {
            const n = Number(part);
            if (Number.isNaN(n)) {
                return 0;
            }
            return Math.max(n, 0);
        };

        return parts.map(parseVersionPart);
    }

    /**
     * Increments the build (last) part of a version string `'0.0.0.0'`.
     * Carries over when a part reaches 100.
     *
     * @param v Version string.
     * @returns Incremented version string.
     */
    static increment(v: string | null | undefined): string {
        const parts = Version.parse(v);

        if (parts.length > 0) {
            parts[parts.length - 1] += 1;
        }

        for (let i = parts.length; i > 0; i -= 1) {
            if (parts[i] === 100) {
                parts[i] = 0;
                parts[i - 1] += 1;
            }
        }

        return parts.join('.');
    }
}
