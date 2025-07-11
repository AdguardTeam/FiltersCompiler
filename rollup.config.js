import copy from 'rollup-plugin-copy';

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
        copy({
            targets: [
                { src: 'schemas/*', dest: 'dist/schemas' },
            ],
        }),
    ],
};
