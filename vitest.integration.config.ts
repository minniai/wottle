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
    // The database suites share one queue and one lobby (spec 067 race tests put
    // searchers in it); run files one at a time so no suite pairs with another's players.
    fileParallelism: false,
    setupFiles: ["./tests/setup.ts"],
    include: [
      "tests/integration/**/*.{test,spec}.ts?(x)",
      "tests/integration/**/*.{test,spec}.mts",
    ],
    exclude: ["tests/integration/ui/**/*"],
    reporters: process.env.CI ? ["default", "junit"] : ["default"],
    outputFile: process.env.CI ? "reports/vitest-integration.xml" : undefined,
  },
});


