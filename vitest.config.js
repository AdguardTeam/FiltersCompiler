import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['test/*.test.js'],
        watch: false,
        silent: true,
    },
});
