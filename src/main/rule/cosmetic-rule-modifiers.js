const { findCosmeticRuleMarker } = require('@adguard/tsurlfilter/dist/es/cosmetic-rule-marker');
const { SimpleRegex } = require('@adguard/tsurlfilter');

/**
 * Adguard cosmetic rule modifiers syntax constants
 */
const CosmeticRuleModifiersSyntax = {
    OPEN_BRACKET: '[',
    CLOSE_BRACKET: ']',
    SPECIAL_SYMBOL: '$',
    DELIMITER: ',',
    ASSIGNER: '=',
    ESCAPE_CHARACTER: '\\',
};

/**
 * Adguard cosmetic rule modifiers keys
 */
const CosmeticRuleModifiersKeys = {
    PATH: 'path',
    DOMAIN: 'domian',
};

const avalableCosmeticRuleModifiersKeysList = Object.values(CosmeticRuleModifiersKeys);

const parseCosmeticRuleWithModifiers = (rule) => {
    const [markerStartIndex, marker] = findCosmeticRuleMarker(rule);

    if (!marker) {
        return null;
    }

    const expression = rule.substring(markerStartIndex + marker.length);

    if (!expression) {
        return null;
    }

    const leftPart = rule.substring(0, markerStartIndex);

    const {
        OPEN_BRACKET,
        SPECIAL_SYMBOL,
        CLOSE_BRACKET,
        ESCAPE_CHARACTER,
        DELIMITER,
        ASSIGNER,
    } = CosmeticRuleModifiersSyntax;

    if (!leftPart.startsWith(`${OPEN_BRACKET + SPECIAL_SYMBOL}`)) {
        return null;
    }

    // The first two characters cannot be start of modifier expression
    const modifiersStartIndex = 2;

    let modifierCloseBracketIndex;

    for (let i = modifiersStartIndex; i < rule.length; i += 1) {
        if (rule[i] === CLOSE_BRACKET && rule[i - 1] !== ESCAPE_CHARACTER) {
            modifierCloseBracketIndex = i;
            break;
        }
    }

    if (!modifierCloseBracketIndex || modifierCloseBracketIndex === modifiersStartIndex) {
        return null;
    }

    const modifiers = leftPart.slice(modifiersStartIndex, modifierCloseBracketIndex);
    let domains = leftPart.slice(modifierCloseBracketIndex + 1, markerStartIndex);

    const modifiersExpressions = modifiers
        .split(new RegExp(`(?<!${ESCAPE_CHARACTER})${DELIMITER}`, 'g'));

    const modifiersDict = Object.create(null);

    for (let i = 0; i < modifiersExpressions; i += 1) {
        const modifierExpression = modifiersExpressions[i];

        const assignerIndex = modifierExpression.indexOf(ASSIGNER);

        if (assignerIndex === -1) {
            return null;
        }

        const modifierKey = modifierExpression.substring(0, assignerIndex);

        if (avalableCosmeticRuleModifiersKeysList.includes(modifierKey)) {
            const modifierValue = modifierExpression.substring(assignerIndex + 1);

            modifiersDict[modifierKey] = modifierValue;
        } else {
            return null;
        }
    }

    const pathModifier = modifiersDict[CosmeticRuleModifiersKeys.PATH];

    if (!pathModifier) {
        return null;
    }

    const domainModifier = modifiersDict[CosmeticRuleModifiersKeys.DOMAIN];

    if (domains && domainModifier) {
        return null;
    }

    domains = domains || domainModifier;

    return {
        path: pathModifier,
        domains,
        marker,
        expression,
    };
};

const isAdgCosmeticRuleWithPathModifier = (rule) => !!parseCosmeticRuleWithModifiers(rule);

const convertAdgPathModifierToUbo = (rule) => {
    const parts = parseCosmeticRuleWithModifiers(rule);

    if (!parts) {
        return rule;
    }

    let { path } = parts;

    if (SimpleRegex.isRegexPattern(path)) {
        path = SimpleRegex.unescapeRegexSpecials(
            path,
            SimpleRegex.reModifierPatternEscapedSpecialCharacters
        );
    }

    const {
        domains,
        marker,
        expression,
    } = parts;

    return `${domains}${marker}${expression}:matches-path(${path})`;
};

module.exports = {
    isAdgCosmeticRuleWithPathModifier,
    convertAdgPathModifierToUbo,
};
