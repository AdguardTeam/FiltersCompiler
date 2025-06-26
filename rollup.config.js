import copy from 'rollup-plugin-copy';

export default {
    input: 'src/index.js',
    output: {
        dir: 'dist',
        format: 'esm',
    },
    plugins: [
        copy({
            targets: [
                { src: 'schemas/*', dest: 'dist/schemas' },
            ],
        }),
    ],
};
