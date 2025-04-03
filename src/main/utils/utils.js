/**
 * Returns filter ID from directory name if it has a number id,
 * otherwise returns 0.
 *
 * @param {string} str Directory name.
 *
 * @returns {number} Filter ID for filter directory, otherwise 0.
 */
const getFilterIdFromDirName = (str) => {
    const chunks = str.split('_');
    const rawId = chunks.length > 1 ? Number(chunks[1]) : 0;
    return !Number.isNaN(rawId) ? rawId : 0;
};

export {
    getFilterIdFromDirName,
};
