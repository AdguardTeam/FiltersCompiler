// TODO: a lot of these masks can be imported from @adguard/agtree

/**
 * Rule masks constants
 */
export const RuleMasks = {
    MASK_REGEX_RULE: '/',
    MASK_RULE_SEPARATOR: '^',
    MASK_WHITE_LIST: '@@',
    MASK_BASE_RULE: '||',
    MASK_ELEMENT_HIDING: '##',
    MASK_ELEMENT_HIDING_EXCEPTION: '#@#',
    MASK_CSS: '#$#',
    MASK_CSS_EXCEPTION: '#@$#',
    MASK_CSS_EXTENDED_CSS_RULE: '#?#',
    MASK_CSS_EXCEPTION_EXTENDED_CSS_RULE: '#@?#',
    MASK_CSS_INJECT_EXTENDED_CSS_RULE: '#$?#',
    MASK_CSS_EXCEPTION_INJECT_EXTENDED_CSS_RULE: '#@$?#',
    MASK_SCRIPT: '#%#',
    MASK_SCRIPT_EXCEPTION: '#@%#',
    MASK_CONTENT: '$$',
    MASK_CONTENT_EXCEPTION: '$@$',
    MASK_COMMENT: '!',
    MASK_HOST_FILE_COMMENT: '#',
    MASK_HINT: '!+',
    MASK_DIRECTIVES: '!#',
    MASK_SCRIPTLET: '#%#//scriptlet',
    MASK_SCRIPTLET_EXCEPTION: '#@%#//scriptlet',
    MASK_TRUSTED_SCRIPTLET: 'trusted-',
    MASK_UBO_SCRIPTLET_PREFIX: 'ubo-',
};

/**
 * Hint that skips validation of the next rule.
 * https://github.com/AdguardTeam/FiltersCompiler/issues/245
 */
export const NOT_VALIDATE_HINT = 'NOT_VALIDATE';

/**
 * Hint that disables conversion of the next rule to AdGuard syntax.
 * https://github.com/AdguardTeam/FiltersCompiler/issues/269
 */
export const NOT_CONVERT_HINT = 'NOT_CONVERT';

/**
 * Checks whether a hint line contains the specified hint.
 *
 * @param {string|null|undefined} hintLine Line which may start with the hint mask,
 * e.g. `!+ PLATFORM(windows) NOT_VALIDATE`.
 * @param {string} hintName Hint name to search for, e.g. `NOT_VALIDATE`.
 *
 * @returns {boolean} `true` if `hintLine` is a hint line containing `hintName`.
 */
export const hasHint = (hintLine, hintName) => {
    if (!hintLine || !hintLine.startsWith(RuleMasks.MASK_HINT)) {
        return false;
    }

    return hintLine
        .substring(RuleMasks.MASK_HINT.length)
        .trim()
        .split(/\s+/)
        .includes(hintName);
};
