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
 * Canonical opening of a hint line: the hint mask plus the space that separates
 * it from the hint name, e.g. `!+ ` in `!+ PLATFORM(windows)`.
 *
 * The converter normalizes hint lines to this form, so the platform stage can
 * rely on it.
 */
export const HINT_MASK = `${RuleMasks.MASK_HINT} `;

/**
 * Hint that excludes the next rule from optimization.
 */
export const NOT_OPTIMIZED_HINT = 'NOT_OPTIMIZED';

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
 * Checks whether a line is a hint line, e.g. `!+ PLATFORM(windows)`.
 *
 * The space after `!+` is not required: the converter normalizes
 * `!+PLATFORM(ios)` and `!+\tNOT_CONVERT` to the canonical `!+ ` form before
 * the platform stage, so such lines are working hints.
 *
 * @param {string|null|undefined} line Line to check.
 *
 * @returns {boolean} `true` if the line starts with the hint mask.
 */
export const isHint = (line) => Boolean(line?.startsWith(RuleMasks.MASK_HINT));

/**
 * Filters lines while keeping hints attached to the lines they modify.
 *
 * Only the last hint line of a run applies: consumers look at the immediately
 * preceding line, so earlier hint lines have no effect. If the modified line is
 * filtered out, the hint lines are dropped with it instead of leaking to the
 * following line.
 *
 * @param {string[]} lines Lines to filter.
 * @param {(line: string, index: number, lines: string[]) => boolean} shouldKeep
 * Predicate for non-hint lines.
 *
 * @returns {string[]} Filtered lines.
 */
export const filterWithHints = (lines, shouldKeep) => {
    const result = [];
    let pendingHints = [];

    lines.forEach((line, index) => {
        if (isHint(line)) {
            pendingHints.push(line);
            return;
        }

        if (shouldKeep(line, index, lines)) {
            result.push(...pendingHints, line);
        }

        pendingHints = [];
    });

    // Trailing hints modify nothing, so they are kept as-is.
    result.push(...pendingHints);

    return result;
};

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
