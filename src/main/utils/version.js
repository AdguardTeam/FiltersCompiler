module.exports = (() => {

    'use strict';

    /**
     * Parses version from string
     *
     * @param v version string
     * @returns {Array}
     */
    const parse = function (v) {
        let version = [];
        const parts = String(v || "").split(".");

        const parseVersionPart = (part) => {
            if (isNaN(part)) {
                return 0;
            }
            return Math.max(part - 0, 0);
        };

        for (let part of parts) {
            version.push(parseVersionPart(part));
        }

        return version;
    };

    /**
     * Increments build part of version '0.0.0.0'
     *
     * @param v version string
     * @returns {string}
     */
    const increment = function (v) {
        const version = parse(v);

        if (version.length > 0) {
            version[version.length - 1] = version[version.length - 1] + 1;
        }

        for (let i = version.length; i > 0; i--) {
            if (version[i] === 100) {
                version[i] = 0;
                version[i - 1]++;
            }
        }

        return version.join('.');
    };

    return {
        increment: increment
    };
})();