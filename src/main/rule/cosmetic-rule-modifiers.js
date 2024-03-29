const { CosmeticRuleParser } = require('@adguard/tsurlfilter');

const isAdgCosmeticRuleWithPathModifier = (rule) => {
    try {
        const { pattern } = CosmeticRuleParser.parseRuleTextByMarker(rule);
        if (!pattern) {
            return false;
        }

        const { modifiersText } = CosmeticRuleParser.parseRulePatternText(pattern);

        if (!modifiersText) {
            return false;
        }

        const { path } = CosmeticRuleParser.parseRuleModifiers(modifiersText);

        if (!path) {
            return false;
        }

        return true;
    } catch (e) {
        return false;
    }
};

const convertAdgPathModifierToUbo = (rule) => {
    const {
        pattern,
        marker,
        content,
    } = CosmeticRuleParser.parseRuleTextByMarker(rule);

    const {
        path,
        restrictedDomains,
        permittedDomains,
    } = CosmeticRuleParser.parseRulePattern(pattern);

    const domains = [];

    if (permittedDomains) {
        domains.push(...permittedDomains);
    }

    if (restrictedDomains) {
        domains.push(...restrictedDomains.map((domain) => `~${domain}`));
    }

    const domainsPattern = domains.join(',');

    const isScriptlet = content.startsWith('//scriptlet');

    if (isScriptlet) {
        throw new Error(`Path option "${path}" not supported by uBO scriptlet syntax`);
    }

    return `${domainsPattern}${marker}:matches-path(${path})${content}`;
};

module.exports = {
    isAdgCosmeticRuleWithPathModifier,
    convertAdgPathModifierToUbo,
};
