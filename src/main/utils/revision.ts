import fs from 'fs';

import { Version } from './version';

/**
 * Filter revision data.
 */
export interface Revision {
    /**
     * Filter version.
     */
    version: string;

    /**
     * Last update time in milliseconds.
     */
    timeUpdated: number;

    /**
     * Hash of the filter content.
     */
    hash: string;
}

/**
 * Creates a revision object and increments the version when the hash changed.
 *
 * @param revisionFilePath Path to the revision file.
 * @param hash Hash of the filter content.
 *
 * @returns Revision data.
 */
export const makeRevision = (revisionFilePath: string, hash: string): Revision => {
    const result: Revision = {
        version: '1.0.0.0',
        timeUpdated: new Date().getTime(),
        hash,
    };

    const current = fs.existsSync(revisionFilePath)
        ? fs.readFileSync(revisionFilePath, { encoding: 'utf-8' })
        : null;

    if (current) {
        const currentRevision = JSON.parse(current);
        if (currentRevision.version) {
            result.version = currentRevision.version;

            if (currentRevision.timeUpdated) {
                result.timeUpdated = currentRevision.timeUpdated;
            }

            if (!currentRevision.hash || currentRevision.hash !== result.hash) {
                result.version = Version.increment(currentRevision.version);
                result.timeUpdated = new Date().getTime();
            }
        }
    }

    return result;
};
