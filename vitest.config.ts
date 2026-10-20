import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'edge-runtime',
    include: ['convex/**/*.spec.ts'],
    server: { deps: { inline: ['convex-test'] } },
  },
})
