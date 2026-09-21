import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

/** `pnpm perf:move-resolve`: the in-process benchmarks under tests/perf (no server, no database). */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/helpers/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/perf/**/*.bench.ts"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
