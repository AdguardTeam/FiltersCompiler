/* globals module, console */

module.exports = (function () {

    'use strict';

    /**
     * Parses version from string
     *
     * @param v version string
     * @returns {Array}
     */
    var parse = function (v) {
        var version = [];

        var parts = String(v || "").split(".");

        function parseVersionPart(part) {
            if (isNaN(part)) {
                return 0;
            }
            return Math.max(part - 0, 0);
        }

        for (var i = 0; i < parts.length; i++) {
            version.push(parseVersionPart(parts[i]));
        }

        return version;
    };

    /**
     * Increments build part of version '0.0.0.0'
     *
     * @param v version string
     * @returns {string}
     */
    var increment = function (v) {
        var version = parse(v);

        if (version.length > 0) {
            version[version.length - 1] = version[version.length - 1] + 1;
        }

        for (var i = version.length; i > 0; i--) {
            if (version[i] === 100) {
                version[i] = 0;
                version[i-1]++;
            }
        }

        return version.join('.');
    };

    return {
        increment: increment
    };
})();