import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Spec 072 T009: links are written only by linkService (and a search's
 * withdrawal in challengeService), and every SQL path that withdraws a
 * challenge withdraws a link too (§7.5 invariant 1).
 */
const ROOTS = ["app", "lib", "components"];
const ALLOWED = new Set(["lib/matchmaking/linkService.ts", "lib/matchmaking/challengeService.ts"]);
const LINK_WRITE = /from\(\s*["']match_links["']\s*\)[^;]*?\.(insert|update|upsert|delete)\(/s;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

/** The body of the latest `create or replace function public.<name>(` across the migrations. */
function latestDefinition(name: string): string {
  const dir = "supabase/migrations";
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  let body = "";
  for (const file of files) {
    const text = readFileSync(join(dir, file), "utf8");
    const at = text.lastIndexOf(`create or replace function public.${name}(`);
    if (at < 0) continue;
    const end = text.indexOf("$$;", text.indexOf("$$", at) + 2);
    body = text.slice(at, end);
  }
  return body;
}

describe("links (spec 072)", () => {
  it("are written only by linkService and a search's withdrawal", () => {
    const offenders = ROOTS.flatMap(sourceFiles)
      .filter((file) => !ALLOWED.has(file))
      .filter((file) => LINK_WRITE.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it.each(["send_challenge", "create_match_between", "sign_out_player", "confirm_lobby_switch", "create_link"])(
    "are withdrawn by %s",
    (fn) => {
      const body = latestDefinition(fn);
      expect(body).not.toBe("");
      expect(/match_links|withdraw_links_of/.test(body)).toBe(true);
    },
  );
});
