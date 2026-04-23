/**
 * Ambient module declarations for JavaScript files imported from TypeScript.
 *
 * During gradual TypeScript migration, `.ts` files may import from `.js`
 * modules that don't have type declarations yet. Instead of a blanket
 * `declare module '*.js'` wildcard (which would type every JS import as `any`
 * and silently disable type checking across all TS↔JS boundaries), we declare
 * each imported JS module explicitly.
 *
 * When adding a new TS file that imports from JS, add a matching declaration
 * here. When a JS module is migrated to TS, remove its declaration below.
 *
 * Remove this file once all source modules have been migrated to TypeScript.
 */

declare module '*/utils/log.js' {
    export const logger: {
        initialize(logFilePath: string): void;
        info(message: string): void;
        error(message: string): void;
        warn(message: string): void;
    };
}
