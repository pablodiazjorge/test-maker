import { defineConfig } from 'vitest/config';

// Plain Vitest runs the Node-side tests in tests/ (the API function and the scripts).
// The Angular specs under src/ run with `ng test`, which does not read this file.
// The tests live outside api/ because Vercel deploys every api/**/*.ts file as a function.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
