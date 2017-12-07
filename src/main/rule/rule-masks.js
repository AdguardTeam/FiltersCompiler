module.exports = (() => {

    'use strict';

    /**
     * Rule masks constants
     */
    return {
        MASK_REGEX_RULE: "/",
        MASK_WHITE_LIST: "@@",
        MASK_ELEMENT_HIDING: "##",
        MASK_ELEMENT_HIDING_EXCEPTION: "#@#",
        MASK_CSS: "#$#",
        MASK_CSS_EXCEPTION: "#@$#",
        MASK_SCRIPT: "#%#",
        MASK_SCRIPT_EXCEPTION: "#@%#",
        MASK_CONTENT: "$$",
        MASK_CONTENT_EXCEPTION: "$@$",
        MASK_COMMENT: "!"
    };
})();