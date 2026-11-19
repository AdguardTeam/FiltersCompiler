import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { getCanonicalRuleTexts } from '../converter.js';
import {
    RuleMasks,
    hasHint,
    isHint,
    NOT_CONVERT_HINT,
    SPACE,
} from '../rule/rule-masks.js';
import { logger } from './log';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SLASH = '/';
const TRUST_LEVEL_DIR = './trust-levels';
const DEFAULT_TRUST_LEVEL = 'low';

/**
 * Returns the path to the trust-level exclusions file for a filter.
 *
 * @param trustLevel Filter trust level. Defaults to `low`.
 *
 * @returns Absolute path to the exclusions file.
 */
export const getTrustLevelExclusionsFile = (trustLevel?: string): string => {
    return path.resolve(__dirname, TRUST_LEVEL_DIR, `exclusions-${trustLevel || DEFAULT_TRUST_LEVEL}.txt`);
};

/**
 * Sync reads file content.
 *
 * @param filePath Path to the file.
 *
 * @returns File content or `null` if the file does not exist.
 */
const readFile = (filePath: string): string | null => {
    if (!fs.existsSync(filePath)) {
        return null;
    }

    return fs.readFileSync(filePath, { encoding: 'utf-8' });
};

/**
 * Splits lines.
 *
 * @param content Content to split.
 *
 * @returns Lines.
 */
const splitLines = (content: string): string[] => content.split(/\r?\n/);

/**
 * Checks case when '#%#' rules are excluded to DON'T exclude '#%#//scriptlet' rules.
 *
 * @param line Line to check.
 * @param exclusion Exclusion pattern.
 *
 * @returns `true` if the rule is a scriptlet exception for the exclusion.
 */
const scriptletException = (line: string, exclusion: string): boolean => {
    return (exclusion === '#%#' && line.includes('#%#//scriptlet'))
        || (exclusion === '#@%#' && line.includes('#@%#//scriptlet'));
};

/**
 * Checks if a line is excluded with the specified set of exclusions.
 *
 * @param line Line to check.
 * @param exclusions Exclusion patterns.
 * @param excluded Collected excluded rules.
 * @param reason Source of the exclusions.
 * @param additionalLines Alternative representations of the line (for example,
 * canonical AdGuard syntax) which are checked against the exclusions as well.
 *
 * @returns The matching exclusion or `null`.
 */
const isExcluded = (
    line: string,
    exclusions: string[],
    excluded: string[],
    reason: string,
    additionalLines: string[] = [],
): string | null => {
    // eslint-disable-next-line no-restricted-syntax
    for (let exclusion of exclusions) {
        exclusion = exclusion.trim();

        if (exclusion && !exclusion.startsWith(RuleMasks.MASK_COMMENT)) {
            const message = `${line} is excluded by "${exclusion}" in ${reason}`;

            const matches = [line, ...additionalLines].some((candidate) => {
                const isExcludedByRegexp = exclusion.endsWith(SLASH) && exclusion.startsWith(SLASH)
                    && new RegExp(exclusion.substring(1, exclusion.length - 1)).test(candidate);

                return (isExcludedByRegexp || candidate.includes(exclusion))
                    && !scriptletException(candidate, exclusion);
            });

            if (matches) {
                logger.info(message);
                excluded.push(`${RuleMasks.MASK_COMMENT}${SPACE}${message}`);
                excluded.push(line);
                return exclusion;
            }
        }
    }

    return null;
};

/**
 * Applies exclusion from an exclusions file.
 *
 * @param lines Lines to process.
 * @param exclusionsFile Path to the exclusions file.
 * @param excluded Collected excluded rules.
 * @param previousLine Line preceding the first line of `lines`, so that a hint
 * on a separate line is honored when the lines are processed on their own.
 *
 * @returns Lines without the excluded rules.
 */
export const exclude = (
    lines: string[],
    exclusionsFile: string,
    excluded: string[],
    previousLine?: string,
): string[] => {
    logger.info('Applying exclusions..');

    const exclusionsContent = readFile(exclusionsFile);
    if (!exclusionsContent) {
        return lines;
    }

    const exclusions = splitLines(exclusionsContent);

    const exclusionsFileName = path.parse(exclusionsFile).base;
    const result: string[] = [];

    lines.forEach((line, pos) => {
        const hintLine = pos > 0 ? lines[pos - 1] : previousLine;
        const canonicalLines = hasHint(hintLine, NOT_CONVERT_HINT) ? getCanonicalRuleTexts(line) : [];
        const exclusion = isExcluded(line, exclusions, excluded, exclusionsFileName, canonicalLines);

        if (exclusion) {
            if (isHint(hintLine)) {
                result.push(`${RuleMasks.MASK_COMMENT} [excluded by ${exclusion}] ${line}`);
            }
        } else {
            result.push(line);
        }
    });

    return result;
};
