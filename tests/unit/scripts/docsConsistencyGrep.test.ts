import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { afterEach, describe, expect, test } from "vitest";

/**
 * `docs:check` forbids the retired design vocabulary in the living documentation.
 * A spec whose job is to *delete* a retired token has to name it (spec 045 T029,
 * T033), so a line carrying the exemption marker is not drift and must not fail.
 */
const ROOT = resolve(__dirname, "../../..");
const SCRIPT = join(ROOT, "scripts/docs/consistency-grep.sh");
const MARKER = "<!-- retired-name -->";

let tmpDir: string | null = null;

/** A scratch folder under `docs/` so the script's own target list picks it up. */
function writeDoc(body: string): string {
  tmpDir = mkdtempSync(join(ROOT, "docs", "tmp-docs-check-"));
  const file = join(tmpDir, "fixture.md");
  writeFileSync(file, body, "utf8");
  return relative(ROOT, file);
}

function runCheck(): { code: number; output: string } {
  try {
    const stdout = execFileSync("bash", [SCRIPT], { cwd: ROOT, encoding: "utf8" });
    return { code: 0, output: stdout };
  } catch (error) {
    const e = error as { status?: number; stdout?: string };
    return { code: e.status ?? 1, output: e.stdout ?? "" };
  }
}

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  tmpDir = null;
});

describe("scripts/docs/consistency-grep.sh — retired-name exemption", () => {
  test("a retired phrase used plainly still fails the check", () => {
    const rel = writeDoc("The lobby uses the ochre accent for totals.\n");
    const { code, output } = runCheck();
    expect(code).toBe(1);
    expect(output).toContain(rel);
    expect(output).toContain("[ochre]");
  });

  test("the same phrase is exempt on a line carrying the marker", () => {
    const rel = writeDoc(`Delete the ochre alias from globals.css. ${MARKER}\n`);
    const { code, output } = runCheck();
    expect(output).not.toContain(rel);
    expect(code).toBe(0);
  });

  test("the marker exempts its own line only, not the rest of the file", () => {
    const rel = writeDoc(
      [`Delete the --p1 alias. ${MARKER}`, "Player one is drawn in ochre.", ""].join("\n"),
    );
    const { code, output } = runCheck();
    expect(code).toBe(1);
    expect(output).toContain("[ochre]");
    expect(output).not.toContain("[--p1]");
    expect(output).toContain(rel);
  });

  test("the marker also exempts a whole-word phrase", () => {
    writeDoc(`Replace the Inter font stack with Zilla Slab. ${MARKER}\n`);
    expect(runCheck().code).toBe(0);
  });

  test("the living documentation is clean", () => {
    // No fixture: the repository as it stands must pass, markers included.
    expect(runCheck().code).toBe(0);
  });
});

describe("scripts/docs/consistency-grep.sh — the current design bundle", () => {
  const BUNDLE = join(ROOT, "docs/design_documentation/260914-wottle-new-design");

  test("the bundle says what the code does", () => {
    // Spec 045 T040 / FR-040. The bundle is binding on implementers, so its
    // drift is a CI failure — unlike the archived bundles, which keep their own
    // retired words on purpose.
    expect(runCheck().code).toBe(0);
  });

  test("a retired statement in the bundle fails the check", () => {
    const file = join(BUNDLE, "tmp-drift-check.md");
    try {
      writeFileSync(file, "The lane's full width is 10:00.\n", "utf8");
      const { code, output } = runCheck();
      expect(code).toBe(1);
      expect(output).toContain("[10:00]");
    } finally {
      rmSync(file, { force: true });
    }
  });

  test("the archived bundles keep their retired words", () => {
    // docs/design_documentation/2604* documents the previous look and must be
    // allowed to name it; only the current bundle is checked.
    const archived = join(ROOT, "docs/design_documentation");
    expect(existsSync(archived)).toBe(true);
    expect(runCheck().code).toBe(0);
  });
});
