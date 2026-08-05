import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    setupFiles: ['./tests/setup.ts'],
    // Money-path integration tests hit the real dev database and
    // create/delete their own rows; they must not run concurrently
    // against each other or they'll see each other's uncommitted state.
    fileParallelism: false,
    testTimeout: 30000,
  },
});
