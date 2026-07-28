import copy from 'rollup-plugin-copy';
import typescript from '@rollup/plugin-typescript';

export default {
    input: 'src/index.js',
    output: [
        {
            file: 'dist/index.js',
            format: 'esm',
        },
        {
            file: 'dist/index.cjs',
            format: 'cjs',
            exports: 'auto',
        },
    ],
    plugins: [
        typescript(),
        copy({
            targets: [
                { src: 'schemas/*', dest: 'dist/schemas' },
                // Trust-level exclusion files are required for filtering rules
                // based on filter list trust level (low, high, full)
                { src: 'src/main/utils/trust-levels/*', dest: 'dist/utils/trust-levels' },
                // Hand-written declarations live outside dist/types/ to avoid
                // collisions with compiler-generated declarations.
                { src: 'src/index.d.ts', dest: 'dist' },
            ],
        }),
        copy({
            // 'writeBundle' runs after @rollup/plugin-typescript has flushed its
            // declaration files to dist/types, so there's something to copy from.
            // A separate plugin instance (vs. adding this target above, which runs
            // on the default 'buildEnd' hook) keeps it from firing before the
            // declarations exist.
            hook: 'writeBundle',
            targets: [
                // src/index.d.ts re-exports from './main/optimization', which must
                // resolve relative to dist/index.d.ts — mirror the generated
                // declaration there instead of leaving it under dist/types/src/main.
                { src: 'dist/types/src/main/optimization.d.ts', dest: 'dist/main' },
            ],
        }),
    ],
};
