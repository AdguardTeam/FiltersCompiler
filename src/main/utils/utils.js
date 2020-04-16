module.exports = (() => {
    /**
     * Removes array duplicates
     *
     * @param list
     * @returns {*}
     */
    const removeDuplicates = function (list) {
        return list.filter((item, pos) => item.startsWith('!')
                || list.indexOf(item) === pos);
    };

    return {
        removeDuplicates,
    };
})();
