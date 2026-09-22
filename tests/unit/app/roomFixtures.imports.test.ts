import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * The fixture route renders the room from static data (spec 045 FR-002). If it
 * could reach a database client, a Server Action or a controller, it would drag
 * in transport and timers and stop being deterministic — and the reference
 * images would drift. Enforced here rather than intended.
 */
const ROOT = resolve(__dirname, "../../..");
const FIXTURE_DIR = join(ROOT, "app/[locale]/dev/room");

const BANNED: { pattern: RegExp; why: string }[] = [
  { pattern: /from\s+["']@?\/?lib\/supabase\//, why: "a Supabase client" },
  { pattern: /from\s+["']@\/app\/actions\//, why: "a Server Action" },
  { pattern: /from\s+["'][^"']*Controller["']/, why: "a room controller" },
  { pattern: /\bcreateClient\b|\bgetServiceRoleClient\b/, why: "a database client factory" },
];

/** Comments may name what the code avoids ("never calls Date.now()"); scan code only. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function sourceFiles(dir: string): string[] {
  if (!statSync(dir, { throwIfNoEntry: false })) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(abs);
    return /\.tsx?$/.test(entry.name) ? [abs] : [];
  });
}

describe("app/dev/room — isolation from the database (spec 045 FR-002)", () => {
  const files = sourceFiles(FIXTURE_DIR);

  test("the fixture route exists", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  test.each(files.map((f) => [relative(ROOT, f)]))("%s imports nothing forbidden", (rel) => {
    const source = code(readFileSync(join(ROOT, rel), "utf8"));
    const hits = BANNED.filter(({ pattern }) => pattern.test(source)).map(({ why }) => why);
    expect(hits, `${rel} must not reach ${hits.join(", ")}`).toEqual([]);
  });

  test("the route guards production behind an explicit opt-in", () => {
    const page = readFileSync(join(FIXTURE_DIR, "page.tsx"), "utf8");
    expect(page).toContain("notFound");
    expect(page).toContain("NODE_ENV");
    expect(page).toContain("ROOM_FIXTURES");
  });

  test("fixtures are deterministic — no clock, randomness or locale", () => {
    for (const file of files) {
      const source = code(readFileSync(file, "utf8"));
      for (const banned of ["Date.now(", "Math.random(", "toLocaleString", "toLocaleDate"]) {
        expect(source, `${relative(ROOT, file)} must not call ${banned}`).not.toContain(banned);
      }
    }
  });
});
