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
        this.contentPart = null;
        this.domains = null;
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
        // eslint-disable-next-line no-restricted-syntax
        for (const m in modifiers) {
            if (modifiers[m] && modifiers[m].length > 0) {
                options.push(`${m}=${modifiers[m].join('|')}`);
            } else {
                options.push(m);
            }
        }

        return `${this.url}$${options.join(',')}`;
    }

    /**
     * Builds rule ruleText, for rule with leading domains
     * like css, content, script rules
     *
     * @param contentPart
     * @param domains
     * @param mask
     * @returns {string}
     */
    static buildNewLeadingDomainsRuleText(contentPart, domains, mask) {
        return `${domains.join(',')}${mask}${contentPart}`;
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
