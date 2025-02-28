// TODO: Replace this file with AGTree converter once it gets full toUBO support
import { CosmeticRuleParser, AdblockSyntax, RuleGenerator } from '@adguard/agtree';

export const isAdgCosmeticRuleWithPathModifier = (rule) => {
    return rule && rule.startsWith('[') && rule.indexOf('path=') !== -1;
};

export const convertAdgPathModifierToUbo = (rule) => {
    const ruleNode = CosmeticRuleParser.parse(rule);

    if (!ruleNode) {
        throw new Error(`Unable to parse rule as cosmetic: ${rule}`);
    }

    ruleNode.syntax = AdblockSyntax.Ubo;

    // eslint-disable-next-line no-restricted-syntax
    for (const modifier of ruleNode.modifiers.children) {
        if (modifier.name.value === 'path') {
            modifier.name.value = 'matches-path';

            // unescape `[`, `]`, `,`, `\` characters
            modifier.value.value = modifier.value.value.replace(/\\([,\[\]\\])/g, '$1');
        }
    }

    return RuleGenerator.generate(ruleNode);
};
