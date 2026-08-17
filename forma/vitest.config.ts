import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Marking algorithm and other pure-logic unit tests live in src/__tests__/
// per CLAUDE.md's Testing Strategy. No React/DOM testing needed yet, so the
// default node environment is enough - add jsdom only if a component test
// is ever written.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['src/__tests__/**/*.test.ts'],
  },
});
