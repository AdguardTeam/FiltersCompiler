/* eslint-disable global-require */
module.exports = (() => {
    const RuleMasks = require('../rule/rule-masks');

    const SCRIPTLET_MASK = '//scriptlet';

    // Based on: https://github.com/github/linguist/pull/5968/commits/f7c5c39139945576a5f9ff0b41c990e6b6019232
    // eslint-disable-next-line max-len
    const ADBLOCK_AGENT_PATTERN = /^(?:!|#)?\s*\[(?<AdblockInfo>\s*(?:[Aa]d[Bb]lock(?:\s+[Pp]lus)?|u[Bb]lock(?:\s+[Oo]rigin)?|[Aa]d[Gg]uard)(?:\s+(?:\d\.?)+)?\s*)(?:;\g<AdblockInfo>)*\]\s*$/;

    /**
     * CSS rules with width and height attributes break SVG rendering
     * https://github.com/AdguardTeam/AdguardBrowserExtension/issues/683
     *
     * @param ruleText Rule text
     */
    const fixCssRuleAttributesForEdge = function (ruleText) {
        if (ruleText.includes(RuleMasks.MASK_CSS)
            || ruleText.includes(RuleMasks.MASK_CSS_EXCEPTION)
            || ruleText.includes(RuleMasks.MASK_ELEMENT_HIDING)
            || ruleText.includes(RuleMasks.MASK_ELEMENT_HIDING_EXCEPTION)) {
            ruleText = ruleText.replace(/\[width=/gi, '[Width=');
            ruleText = ruleText.replace('/[height=/gi', '[Height=');
        }

        return ruleText;
    };

    /**
     * Updates rule text
     */
    const overrideRule = function (ruleText, platform) {
        if (platform === 'ext_edge') {
            ruleText = fixCssRuleAttributesForEdge(ruleText);
        }

        return ruleText;
    };

    /**
     * Modifies header for AdGuard Base filter
     * https://github.com/AdguardTeam/FiltersCompiler/issues/78
     * @param {array} header
     * @param {boolean} optimized
     */
    const modifyBaseFilterHeader = (header, optimized) => {
        header[0] = `! Title: AdGuard Base filter + EasyList${optimized ? ' (Optimized)' : ''}`;
    };

    /**
     * Rewrites title and description
     * https://github.com/AdguardTeam/AdguardFilters/issues/5138#issuecomment-328847738
     */
    const rewriteHeader = function (header) {
        const result = [];
        header.forEach((line) => {
            if (line.startsWith('! Title: ')) {
                line = '! Title: AdGuard Base filter';
            } else if (line.startsWith('! Description: ')) {
                line = '! Description: This filter is necessary for quality ad blocking.';
            }

            result.push(line);
        });

        return result;
    };

    /**
     * Filters easylist block from list of rules
     * https://github.com/AdguardTeam/AdguardFilters/issues/5138#issuecomment-328847738
     */
    const rewriteRules = function (rules) {
        const filtered = [];
        let flag = -1;
        for (let i = 0; i < rules.length; i += 1) {
            const rule = rules[i];

            if (flag >= 0 && rule.startsWith('!------------------')) {
                if (flag !== i - 1) {
                    // we skip next line after block header
                    // looking for the end of easylist block
                    flag = -1;
                }

                continue;
            }

            if (rule.startsWith('!------------------ EasyList rules')) {
                flag = i;
                continue;
            }

            if (flag < 0) {
                filtered.push(rule);
            }
        }

        return filtered;
    };

    /**
     * Replaces Version: with OriginalVersion: comments in case of some client cannot afford it.
     *
     * @param rules
     */
    const fixVersionComments = function (rules) {
        return rules.map((x) => {
            if (x.startsWith('! Version:')) {
                return x.replace('! Version:', '! OriginalVersion:');
            }

            return x;
        });
    };

    /**
     * Removes adblock agent strings, for example:
     *  - [AdBlock],
     *  - [Adblock Plus],
     *  - [Adblock Plus 2.0],
     *  - [AdGuard],
     *  - [uBlock] / [uBlock Origin], etc.
     *
     * @param lines
     */
    const removeAdblockVersion = function (lines) {
        return lines.filter((line) => !line.trim().match(ADBLOCK_AGENT_PATTERN));
    };

    /**
     * Corrects metadata for backward compatibility with old clients on MAC platform
     * Hides tag fields
     *
     * @param metadata
     */
    const rewriteMetadataForOldMac = function (metadata) {
        const result = {};

        result.groups = metadata.groups.slice(0);
        result.filters = [];

        // eslint-disable-next-line no-restricted-syntax
        for (const f of metadata.filters) {
            const copy = { ...f };
            delete copy.tags;
            delete copy.timeAdded;
            delete copy.trustLevel;
            delete copy.downloadUrl;
            result.filters.push(copy);
        }

        return result;
    };

    /**
     * Removes scriptlet rules
     * @param {array} rules
     * @return {array} rules
     */
    const removeScriptletRules = (rules) => rules.filter((rule) => !rule.script.startsWith(SCRIPTLET_MASK));

    return {
        overrideRule,
        rewriteHeader,
        rewriteRules,
        fixVersionComments,
        removeAdblockVersion,
        rewriteMetadataForOldMac,
        modifyBaseFilterHeader,
        removeScriptletRules,
    };
})();
