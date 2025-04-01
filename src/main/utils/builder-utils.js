import { parse } from 'tldts';

import { RuleMasks } from '../rule/rule-masks';

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
 * Returns the top level domain of the given domain.
 *
 * @param {string} domain Domain to get the top level domain from.
 *
 * @returns {string} Top level domain.
 */
const getTopLevelDomain = (domain) => {
    const parsedDomain = parse(domain).domain;
    return typeof parsedDomain === 'string' ? parsedDomain : domain;
};

/**
 * Finds the widest domains in the given list.
 *
 * @param {Set<string>} domains Set of domains to find the widest domains from.
 *
 * @returns {Set<string>} Set of widest domains.
 *
 * @example
 * - example.com, sub1.example.com, abc.sub2.example.com -> example.com
 * - example.org, example.com -> example.org, example.com
 */
const findWidestDomains = (domains) => {
    const sortedDomains = [...domains].sort((a, b) => {
        return a.split(DOT).length - b.split(DOT).length;
    });

    const result = new Set();

    sortedDomains.forEach((domain) => {
        let isSubdomain = false;
        result.forEach((parent) => {
            if (domain.endsWith(`${DOT}${parent}`)) {
                isSubdomain = true;
            }
        });

        if (!isSubdomain) {
            result.add(domain);
        }
    });

    return result;
};

/**
 * Removes redundant rules from lines
 * @param {string[]} lines - An array of text lines.
 * @returns {string[]} - An array of of text lines with redundant rules removed.
 */
export const optimizeDomainBlockingRules = async (lines) => {
    const linesToSkipOptimization = new Set();
    const rawDomainsToOptimize = new Set();

    lines.forEach((line) => {
        if (!shouldOptimize(line)) {
            linesToSkipOptimization.add(line);
            return;
        }

        const rawDomain = removeRuleMarkers(line);
        rawDomainsToOptimize.add(rawDomain);
    });

    /**
     * Map of tld for all raw domains
     * @type {Map<string, Set<string>>}
     *
     * It is needed to group rawDomains by top level domain
     * so groups of related rawDomains can be optimized in parallel.
     */
    const topDomainsMap = new Map();

    rawDomainsToOptimize.forEach((rawDomain) => {
        const topLevelDomain = getTopLevelDomain(rawDomain);

        if (!topDomainsMap.has(topLevelDomain)) {
            topDomainsMap.set(topLevelDomain, new Set([rawDomain]));
        } else {
            topDomainsMap.get(topLevelDomain).add(rawDomain);
        }
    });

    const widerDomains = new Set();

    /**
     * Runs optimization for a group of related domains -
     * finds the widest domains in the group and adds them to the result list of wider domains.
     *
     * @param {Set<string>} rawDomains Set of related raw domains to optimize.
     */
    const optimizeDomains = (rawDomains) => {
        const widestDomains = findWidestDomains(rawDomains);
        widestDomains.forEach((domain) => {
            widerDomains.add(domain);
        });
    };

    topDomainsMap.forEach((rawDomains) => {
        optimizeDomains(rawDomains);
    });

    // return lines in the order they were given
    return lines.filter((line) => {
        if (linesToSkipOptimization.has(line)) {
            return true;
        }

        const domain = removeRuleMarkers(line);

        return widerDomains.has(domain);
    });
};
