module.exports = (() => {

    'use strict';

    /**
     * Rule types enum
     */
    return {
        /**
         * Comments
         */
        Comment: 1,
        /**
         * Url blocking rules
         */
        UrlBlocking: 2,
        /**
         * Element hiding rules
         */
        ElementHiding: 3,
        /**
         * Content rules
         */
        Content: 4,
        /**
         * Javascript rules
         */
        Script: 5,
        /**
         * Cosmetic css rules
         */
        Css: 6,
        /**
         * Extended css rules
         */
        ExtCss: 7
    };
})();
