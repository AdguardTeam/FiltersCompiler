import fs from 'fs';

const { log } = console;
const reportDate = new Date();

let reportData = `\nFiltersCompiler report ${reportDate.toLocaleDateString()} ${reportDate.toLocaleTimeString()}:\n\n`;

/**
 * Adds filters data to report
 * @param {object} metadata
 * @param {object} filterRules
 * @param {string[]} invalidRules
 */
export const addFilter = (metadata, filterRules, invalidRules) => {
    if (metadata && filterRules) {
        const { filterId, name, subscriptionUrl } = metadata;
        const filterLength = filterRules.lines.length;
        const excludedLength = filterRules.excluded.length;

        reportData += `Filter ID: ${filterId}\n`
            + `Filter name: ${name}\n`
            + `Compiled rules: ${filterLength}\n`
            + `Excluded rules: ${excludedLength}\n`
            + `URL: ${subscriptionUrl}\n`;
        // log list of invalid rules only if they exist
        if (invalidRules.length > 0) {
            reportData += 'INVALID RULES:\n'
                + `${invalidRules.join('\n')}\n`;
        } else {
            reportData += 'All rules are valid.\n';
        }
        reportData += '---------------------------\n';
    }
};

/**
 * Adds disabled filters data to report
 * @param {object} metadata
 */
export const skipFilter = (metadata) => {
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
export const create = (reportPath) => {
    if (reportPath) {
        fs.writeFileSync(reportPath, reportData, 'utf8');
        return;
    }
    log(reportData);
};
