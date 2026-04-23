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
    ],
};
