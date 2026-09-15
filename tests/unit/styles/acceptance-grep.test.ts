import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Design plan §10 visual acceptance: nothing outside the seven tokens, no
 * radii/shadows/gradients, none of the retired font names. Scoped to the
 * P5 scope: all of `app/` and `components/`, plus the room's lib modules.
 */
const ROOT = resolve(__dirname, "../../..");
const SCOPE = ["app", "components", "lib/room", "lib/constants/seatColors.ts", "lib/constants/copy.ts"];
/**
 * Case-insensitive (spec 045 D1): the retired font aliases were declared in
 * lower case, so `/Fraunces|JetBrains/` passed over the very tokens it existed
 * to forbid. The retired colour families are named here for the same reason.
 */
const BANNED = /rounded-|shadow-|gradient|emerald|red-\d|amber|fraunces|\binter\b|jetbrains|--ochre|--p1-|--p2-|--good|--warn|--bad|--hair/i;
const ALLOWLIST: RegExp[] = [];

function files(path: string): string[] {
  const abs = join(ROOT, path);
  if (!statSync(abs, { throwIfNoEntry: false })) return [];
  if (statSync(abs).isFile()) return [abs];
  return readdirSync(abs, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(path, e.name)) : /\.(tsx?|css)$/.test(e.name) ? [join(abs, e.name)] : [],
  );
}

describe("acceptance grep (design plan §10)", () => {
  const all = SCOPE.flatMap(files);

  test("scope resolves to at least the token files", () => {
    expect(all.length).toBeGreaterThan(2);
  });

  test.each(all.map((f) => [f.replace(`${ROOT}/`, "")]))("%s has no banned pattern", (rel) => {
    const lines = readFileSync(join(ROOT, rel), "utf8").split("\n");
    const hits = lines
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => BANNED.test(line) && !ALLOWLIST.some((ok) => ok.test(line)));
    expect(hits, hits.map((h) => `${rel}:${h.n}: ${h.line.trim()}`).join("\n")).toEqual([]);
  });
});
