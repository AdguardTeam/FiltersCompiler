import {
    describe,
    it,
    expect,
} from 'vitest';

const ENTRY_POINTS = [
    '../src/index.js',
];

describe('package entry points', () => {
    // The entry point loads the whole compiler. Under a full parallel run that
    // can exceed the 5 s default.
    it.each(ENTRY_POINTS)('does not install an unhandledRejection listener on import: %s', async (entryPoint) => {
        // The entry point must be imported dynamically so the listener list can
        // be sampled before the module is evaluated. A static import would be
        // hoisted and would hide a module-load side effect.
        const listenersBeforeImport = process.listeners('unhandledRejection');

        await import(entryPoint);

        expect(process.listeners('unhandledRejection')).toEqual(listenersBeforeImport);
    }, 15000);
});
