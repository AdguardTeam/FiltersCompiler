const fs = require('fs');

let reportStream;

/**
 * Creates full path to report file based on log file path
 * @param {string} logFile
 * @returns {string}
 */
const createReportPath = (logFile) => {
    let dotIndex = logFile.lastIndexOf('.');
    if (!dotIndex) {
        dotIndex = logFile.length;
    }
    return `${logFile.slice(0, dotIndex)}-report${logFile.slice(dotIndex)}`;
};

/**
 * Initiates report stream
 * @param logFile
 */
const init = (logFile) => {
    if (!logFile) {
        // eslint-disable-next-line no-console
        console.warn('Log file is not specified');
        return;
    }
    const reportFile = createReportPath(logFile);
    reportStream = fs.openSync(reportFile, 'w');
};

/**
 * Adds filters data to report
 * @param {object} metadata
 * @param {object} filterRules
 */
const addFilter = (metadata, filterRules) => {
    if (reportStream && metadata && filterRules) {
        const { filterId, name, subscriptionUrl } = metadata;
        const filterLength = filterRules.lines.length;
        const excludedLength = filterRules.excluded.length;

        const filterData = `Filter ID: ${filterId}\n`
            + `Filter name: ${name}\n`
            + `Compiled rules: ${filterLength}\n`
            + `Excluded rules: ${excludedLength}\n`
            + `URL: ${subscriptionUrl}\n`
            + '---------------------------\n';

        fs.appendFileSync(reportStream, filterData, 'utf8');
    }
};

/**
 * Adds disabled filters data to report
 * @param {object} metadata
 */
const skipFilter = (metadata) => {
    if (reportStream && metadata) {
        const { filterId, name, subscriptionUrl } = metadata;

        const filterData = `Filter ID: ${filterId}\n`
            + `Filter name: ${name}\n`
            + 'Filter is DISABLED!\n'
            + `URL: ${subscriptionUrl}\n`
            + '---------------------------\n';

        fs.appendFileSync(reportStream, filterData, 'utf8');
    }
};

module.exports = {
    init,
    addFilter,
    skipFilter,
};
