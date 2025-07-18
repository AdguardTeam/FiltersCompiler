/**
 * Version utility functions
 */
export const version = {
    /**
     * Parses version from string
     *
     * @param v version string
     * @returns {Array}
     */
    parse(v) {
        const version = [];
        const parts = String(v || '').split('.');

        const parseVersionPart = (part) => {
            if (Number.isNaN(part)) {
                return 0;
            }
            return Math.max(part - 0, 0);
        };

        // eslint-disable-next-line no-restricted-syntax
        for (const part of parts) {
            version.push(parseVersionPart(part));
        }

        return version;
    },

    /**
     * Increments build part of version '0.0.0.0'
     *
     * @param v version string
     * @returns {string}
     */
    increment(v) {
        const version = this.parse(v);

        if (version.length > 0) {
            version[version.length - 1] = version[version.length - 1] + 1;
        }

        for (let i = version.length; i > 0; i -= 1) {
            if (version[i] === 100) {
                version[i] = 0;
                version[i - 1] += 1;
            }
        }

        return version.join('.');
    },
};
