/* globals require */

module.exports = (() => {

    'use strict';

    const RuleMasks = require('../rule/rule-masks.js');

    /**
     * CSS rules with width and height attributes break SVG rendering
     * https://github.com/AdguardTeam/AdguardBrowserExtension/issues/683
     *
     * @param ruleText Rule text
     */
    const fixCssRuleAttributesForEdge = function (ruleText) {

        if (ruleText.includes(RuleMasks.MASK_CSS) ||
            ruleText.includes(RuleMasks.MASK_CSS_EXCEPTION) ||
            ruleText.includes(RuleMasks.MASK_ELEMENT_HIDING) ||
            ruleText.includes(RuleMasks.MASK_ELEMENT_HIDING_EXCEPTION)) {

            ruleText = ruleText.replace(/\[width=/gi, "[Width=");
            ruleText = ruleText.replace("/\[height=/gi", "[Height=");
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

    return {
        overrideRule: overrideRule
    };
})();