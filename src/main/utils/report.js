import fs from 'fs';

const { log } = console;
const reportDate = new Date();
const reportHeader = `\nFiltersCompiler report ${reportDate.toLocaleDateString()} `
    + `${reportDate.toLocaleTimeString()}:\n\n`;
const reportEntries = [];

/**
 * Renders a compiled filter report entry.
 *
 * @param {object} entry Filter report entry.
 *
 * @returns {string} Rendered report entry.
 */
const renderFilter = (entry) => {
    const {
        metadata,
        compiledRules,
        excludedRules,
        invalidRules,
    } = entry;
    const { filterId, name, subscriptionUrl } = metadata;

    let result = `Filter ID: ${filterId}\n`
        + `Filter name: ${name}\n`
        + `Compiled rules: ${compiledRules}\n`
        + `Excluded rules: ${excludedRules}\n`
        + `URL: ${subscriptionUrl}\n`;

    // log list of invalid rules only if they exist
    if (invalidRules.length > 0) {
        result += 'INVALID RULES:\n'
            + `${invalidRules.join('\n')}\n`;
    } else {
        result += 'All rules are valid.\n';
    }

    return `${result}---------------------------\n`;
};

/**
 * Renders a disabled filter report entry.
 *
 * @param {object} entry Disabled filter report entry.
 *
 * @returns {string} Rendered report entry.
 */
const renderDisabledFilter = (entry) => {
    const { filterId, name, subscriptionUrl } = entry.metadata;

    return `Filter ID: ${filterId}\n`
        + `Filter name: ${name}\n`
        + 'Filter is DISABLED!\n'
        + `URL: ${subscriptionUrl}\n`
        + '---------------------------\n';
};

/**
 * Finds the latest report entry of a filter.
 *
 * A process can build the same filter more than once. The latest entry
 * describes the current build.
 *
 * @param {number} filterId Filter ID.
 *
 * @returns {object|undefined} Filter report entry.
 */
const findFilterEntry = (filterId) => {
    return reportEntries.findLast((entry) => entry.type === 'filter' && entry.metadata.filterId === filterId);
};

/**
 * Adds filters data to report.
 *
 * @param {object} metadata Filter metadata.
 * @param {object} filterRules Compiled filter rules.
 * @param {string[]} invalidRules Invalid rules collected at the compile stage.
 */
export const addFilter = (metadata, filterRules, invalidRules = []) => {
    if (metadata && filterRules) {
        reportEntries.push({
            type: 'filter',
            metadata,
            compiledRules: filterRules.lines.length,
            excludedRules: filterRules.excluded.length,
            deferredExcluded: new Set(),
            invalidRules: [...invalidRules],
        });
    }
};

/**
 * Adds rules collected while a deferred include is resolved to the report.
 *
 * @param {object} metadata Filter metadata.
 * @param {string[]} excludedRules Excluded rules and their messages.
 * @param {string[]} invalidRules Invalid rules.
 */
export const addFilterDetails = (metadata, excludedRules = [], invalidRules = []) => {
    const entry = findFilterEntry(metadata.filterId);

    if (!entry) {
        return;
    }

    excludedRules.forEach((line) => {
        if (!entry.deferredExcluded.has(line)) {
            entry.deferredExcluded.add(line);
            entry.excludedRules += 1;
        }
    });

    const knownInvalid = new Set(entry.invalidRules);
    invalidRules.forEach((line) => {
        if (!knownInvalid.has(line)) {
            knownInvalid.add(line);
            entry.invalidRules.push(line);
        }
    });
};

/**
 * Adds disabled filters data to report.
 *
 * @param {object} metadata Filter metadata.
 */
export const skipFilter = (metadata) => {
    if (metadata) {
        reportEntries.push({
            type: 'disabled',
            metadata,
        });
    }
};

/**
 * Creates report file or outputs report.
 *
 * @param {string} reportPath Path to the report file.
 */
export const create = (reportPath) => {
    const reportData = reportEntries.map((entry) => (
        entry.type === 'filter' ? renderFilter(entry) : renderDisabledFilter(entry)
    )).join('');

    const result = reportHeader + reportData;

    if (reportPath) {
        fs.writeFileSync(reportPath, result, 'utf8');
        return;
    }

    log(result);
};
