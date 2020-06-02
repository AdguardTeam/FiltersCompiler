const fs = require('fs');

const { log } = console;
const reportDate = new Date();

let reportData = `\nFiltersCompiler report ${reportDate.toLocaleDateString()} ${reportDate.toLocaleTimeString()}:\n\n`;

/**
 * Adds filters data to report
 * @param {object} metadata
 * @param {object} filterRules
 */
const addFilter = (metadata, filterRules) => {
    if (metadata && filterRules) {
        const { filterId, name, subscriptionUrl } = metadata;
        const filterLength = filterRules.lines.length;
        const excludedLength = filterRules.excluded.length;

        reportData += `Filter ID: ${filterId}\n`
            + `Filter name: ${name}\n`
            + `Compiled rules: ${filterLength}\n`
            + `Excluded rules: ${excludedLength}\n`
            + `URL: ${subscriptionUrl}\n`
            + '---------------------------\n';
    }
};

/**
 * Adds disabled filters data to report
 * @param {object} metadata
 */
const skipFilter = (metadata) => {
    if (metadata) {
        const { filterId, name, subscriptionUrl } = metadata;

        reportData += `Filter ID: ${filterId}\n`
            + `Filter name: ${name}\n`
            + 'Filter is DISABLED!\n'
            + `URL: ${subscriptionUrl}\n`
            + '---------------------------\n';
    }
};

/**
 * Creates report file or outputs report
 * @param {string} reportPath
 */
const create = (reportPath) => {
    if (reportPath) {
        fs.writeFileSync(reportPath, reportData, 'utf8');
        return;
    }
    log(reportData);
};

module.exports = {
    addFilter,
    skipFilter,
    create,
};
