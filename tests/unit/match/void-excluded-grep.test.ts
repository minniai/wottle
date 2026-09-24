import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = ["app", "lib"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

/**
 * Files that read `matches` and name the `completed` state, but may skip the
 * void filter, each with why. Writers settle or end a live match (a void is
 * never live); the words route reads a match's words (a void has none).
 */
const ALLOWED: Record<string, string> = {
  "app/actions/match/resignMatch.ts": "writer: resigns a live match",
  "app/actions/match/claimWin.ts": "writer: ends a live match early",
  "app/actions/match/completeMatch.ts": "writer: completes a live match",
  "lib/match/matchSettlement.ts": "writer: settles a live match",
  "app/api/match/[matchId]/words/route.ts": "a void match has no words",
};

describe("a void is in no history (spec 069 FR-016)", () => {
  it("every reader of finished matches excludes voids", () => {
    const readers = ROOTS.flatMap(sourceFiles).filter((file) => {
      const text = readFileSync(file, "utf8");
      return /from\(\s*["']matches["']\s*\)/.test(text) && /["']completed["']/.test(text);
    });
    const offenders = readers.filter((file) => !(file in ALLOWED) && !/ended_reason[^\n]*\bvoid\b/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("a rematch of a void is refused", () => {
    // Spec 071: request_rematch decides, in the database.
    const sql = readFileSync("supabase/migrations/20260926001_result_rematch_review.sql", "utf8");
    const fn = sql.slice(sql.indexOf("function public.request_rematch"));
    expect(fn).toMatch(/ended_reason in \('void', 'abandoned', 'error'\)/);
  });
});
