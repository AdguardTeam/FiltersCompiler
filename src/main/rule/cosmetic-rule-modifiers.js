const { CosmeticRuleParser } = require('@adguard/tsurlfilter');
const scriptlets = require('scriptlets');

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

    const isScriplet = content.startsWith('//scriptlet');

    if (isScriplet) {
        const uboScriptletRule = scriptlets.convertAdgToUbo(`${domainsPattern}${marker}${content}`);
        return `${uboScriptletRule}:matches-path(${path})`;
    }

    return `${domainsPattern}${marker}:matches-path(${path})${content}`;
};

module.exports = {
    isAdgCosmeticRuleWithPathModifier,
    convertAdgPathModifierToUbo,
};
