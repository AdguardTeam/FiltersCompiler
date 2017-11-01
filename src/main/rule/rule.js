/*jslint node: true */

'use strict';

/**
 * Rule class object
 *
 * @type {Rule}
 */
module.exports = class Rule {
    constructor(ruleText, ruleType) {
        this.ruleText = ruleText;
        this.ruleType = ruleType;
        this.modifiers = null;
        this.cssSelector = null;
        this.cssDomains = null;
        this.url = null;
    }

    /**
     * Builds url blocking ruleText with new modifiers
     *
     * @param modifiers
     * @returns {string}
     */
    buildNewModifiers(modifiers) {
        const options = [];
        for (let m in modifiers) {
            if (modifiers[m] && modifiers[m].length > 0 ) {
                options.push(`${m}=${modifiers[m].join('|')}`);
            } else {
                options.push(m);
            }
        }

        return `${this.url}$${options.join(',')}`;
    }

    /**
     * Builds css rule ruleText with selector and domains
     *
     * @param selector
     * @param domains
     * @returns {string}
     */
    static buildNewCssRuleText(selector, domains) {
        return `${domains.join(',')}##${selector}`;
    }

    /**
     * Builds url blocking rule ruleText with url and domains
     *
     * @param url
     * @param domains
     */
    static buildNewUrlBlockingRuleText(url, domains) {
        return `${url}$domain=${domains.join('|')}`;
    }
};