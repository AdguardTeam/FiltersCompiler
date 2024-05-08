const { parse } = require('tldts');

const RuleMasks = require('../rule/rule-masks');

const DOT = '.';

/**
 * Modifies string to handle domains without rule markers
 *
 * @param {string} rule - Rule in base adblock syntax.
 * @returns {string} - Domain without base rule markers.
 */
const removeRuleMarkers = (rule) => rule
    .replace(RuleMasks.MASK_BASE_RULE, '')
    .replace(RuleMasks.MASK_RULE_SEPARATOR, '');

/**
 * Converts domain to base rule style syntax
 * @param {string} domain - Domain name.
 * @returns {string} - Domain with base rule markers.
 */
const addRuleMarkers = (domain) => `${RuleMasks.MASK_BASE_RULE}${domain}${RuleMasks.MASK_RULE_SEPARATOR}`;

/**
 * Checks if the line is in base rule style syntax with no modifier, i.e.,
 * starts with `||` and ends with `^`.
 *
 * @param {string} rule - Rule to check.
 * @returns {boolean} - True if the rule is in base rule style syntax.
 */
const shouldOptimize = (rule) => {
    return rule.startsWith(RuleMasks.MASK_BASE_RULE)
        && rule.endsWith(RuleMasks.MASK_RULE_SEPARATOR);
};

/**
 * Extracts all possible domains from the line.
 *
 * @param {string} line Line to be optimized.
 * @returns {string[]} Array of possible domains, e.g.,
 * for `sub.example.com` -> `['sub.example.com', 'example.com']`.
 */
const extractDomainNames = (line) => {
    const rawDomain = removeRuleMarkers(line);

    const mainDomain = parse(rawDomain).domain;
    const parts = rawDomain.split(DOT);
    const domains = [];

    for (let i = 0; i < parts.length; i += 1) {
        const domain = parts.slice(i).join(DOT);
        domains.push(domain);

        if (domain === mainDomain) {
            break;
        }
    }

    return domains;
};

/**
 * Removes redundant rules from lines
 * @param {string[]} lines - An array of text lines.
 * @returns {string[]} - An array of of text lines with redundant rules removed.
 */
const optimizeDomainBlockingRules = (lines) => {
    /**
     * Stores a map of original domain and all possible domains from the line.
     *
     * @type {Map<string, string[]>}
     */
    const domainsMap = new Map();

    const resultLines = [];

    lines.forEach((line) => {
        if (!shouldOptimize(line)) {
            resultLines.push(line);
            return;
        }
        const [originalDomain, ...otherDomains] = extractDomainNames(line);
        domainsMap.set(originalDomain, otherDomains);
    });

    // consider all original domains as wider domains at first
    const widerDomains = new Set(domainsMap.keys());

    widerDomains.forEach((wideDomain) => {
        domainsMap.forEach((otherDomains, checkedWideDomain) => {
            // skip comparing a domain to itself
            if (wideDomain === checkedWideDomain) {
                return;
            }

            // if currently checking other domains contain the wide domain,
            // remove currently checked domain from wider domains set as it is redundant
            if (otherDomains.includes(wideDomain)) {
                widerDomains.delete(checkedWideDomain);
            }
        });
    });

    const optimizedDomainBlockingRules = Array.from(widerDomains).map(addRuleMarkers);

    return resultLines.concat(optimizedDomainBlockingRules);
};

module.exports = {
    optimizeDomainBlockingRules,
};
