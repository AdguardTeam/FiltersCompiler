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
};
