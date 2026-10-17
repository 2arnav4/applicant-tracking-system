import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    // `server-only` throws outside Next's server bundler; tests import server modules directly.
    alias: { "server-only": new URL("./tests/helpers/empty-module.ts", import.meta.url).pathname },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "server",
          environment: "node",
          include: ["tests/unit/**/*.test.ts", "tests/server/**/*.test.ts", "tests/api/**/*.test.ts"],
          // PGlite boots a WASM Postgres per file; give it room on cold start.
          testTimeout: 20_000,
          hookTimeout: 30_000,
        },
      },
      {
        extends: true,
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["tests/ui/**/*.test.{ts,tsx}"],
          setupFiles: ["./tests/helpers/setup-dom.ts"],
        },
      },
    ],
  },
});
