import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./tests/helpers/stubs/server-only.ts", import.meta.url)
      ),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: [
      "tests/unit/**/*.{test,spec}.ts?(x)",
      "tests/unit/**/*.{test,spec}.mts",
      "tests/contract/**/*.{test,spec}.ts?(x)",
      "tests/contract/**/*.{test,spec}.mts",
    ],
    exclude: [
      "tests/integration/**/*",
      "tests/perf/**/*",
    ],
    reporters: process.env.CI ? ["default", "junit"] : ["default"],
    outputFile: process.env.CI ? "reports/vitest.xml" : undefined,
  },
});
