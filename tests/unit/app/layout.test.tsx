import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const layoutSource = readFileSync(
  resolve(__dirname, "../../../app/layout.tsx"),
  "utf-8",
);

describe("app/layout.tsx font wiring", () => {
  test("imports JetBrains_Mono from next/font/google", () => {
    expect(layoutSource).toMatch(
      /import\s*\{\s*[^}]*JetBrains_Mono[^}]*\}\s*from\s*"next\/font\/google"/,
    );
  });

  test("constructs jetbrainsMono with variable --font-jetbrains-mono", () => {
    expect(layoutSource).toMatch(/variable:\s*"--font-jetbrains-mono"/);
  });

  test("html element uses both font variables", () => {
    expect(layoutSource).toMatch(
      /className=\{`\$\{fraunces\.variable\}[^`]*\$\{jetbrainsMono\.variable\}`\}/,
    );
  });

  test("imports and renders TopBar", () => {
    expect(layoutSource).toMatch(
      /import\s*\{\s*TopBar\s*\}\s*from\s*"@\/components\/ui\/TopBar"/,
    );
    expect(layoutSource).toMatch(/<TopBar\s*\/>/);
  });
});
