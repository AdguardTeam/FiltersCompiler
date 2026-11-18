import copy from 'rollup-plugin-copy';
import typescript from '@rollup/plugin-typescript';

export default {
    input: 'src/index.js',
    output: {
        file: 'dist/index.js',
        format: 'esm',
    },
    plugins: [
        // Test files are type-checked by `pnpm lint:types` (tsc), but their
        // declarations must not ship in the npm package.
        typescript({ exclude: ['test/**'] }),
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
                // src/index.d.ts re-exports which must resolve relative to
                // dist/index.d.ts — mirror the generated declarations there
                // instead of leaving them under dist/types/src/main.
                { src: 'dist/types/src/main/optimization.d.ts', dest: 'dist/main' },
                { src: 'dist/types/src/main/platforms-config.d.ts', dest: 'dist/main' },
                // Keep the internal declaration with the public declarations
                // that may reference it.
                { src: 'dist/types/src/main/utils/deep-freeze.d.ts', dest: 'dist/main/utils' },
            ],
        }),
    ],
};
