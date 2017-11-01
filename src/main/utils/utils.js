module.exports = (() => {

    'use strict';

    /**
     * Removes array duplicates
     *
     * @param list
     * @returns {*}
     */
    const removeDuplicates = function (list) {
        return list.filter((item, pos) => {
            return item.startsWith('!') ||
                list.indexOf(item) === pos;
        });
    };

    return {
        removeDuplicates: removeDuplicates
    };
})();