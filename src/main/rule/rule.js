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
