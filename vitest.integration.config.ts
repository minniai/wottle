import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./tests/helpers/stubs/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: [
      "tests/integration/**/*.{test,spec}.ts?(x)",
      "tests/integration/**/*.{test,spec}.mts",
    ],
    reporters: process.env.CI ? ["default", "junit"] : ["default"],
    outputFile: process.env.CI ? "reports/vitest-integration.xml" : undefined,
  },
});


