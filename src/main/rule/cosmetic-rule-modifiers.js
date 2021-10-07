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

    if (restrictedDomains) {
        domains.push(...restrictedDomains);
    }

    if (permittedDomains) {
        domains.push(...permittedDomains);
    }

    // TODO: handle scriplets rules with path modifier
    return `${domains.join(',')}${marker}:matches-path(${path})${content}`;
};

module.exports = {
    isAdgCosmeticRuleWithPathModifier,
    convertAdgPathModifierToUbo,
};
