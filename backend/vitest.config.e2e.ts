import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    setupFiles: ['./test/gemini.mock.ts'],
    root: './',
    include: ['**/*.e2e-spec.ts'],
  },
});
