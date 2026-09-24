import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Spec 070 T068: every challenge write goes through lib/matchmaking/challengeService.ts
 * (and the SQL it calls), so the gates and limits in send_challenge cannot be bypassed.
 */
const ROOTS = ["app", "lib", "components"];
const ALLOWED = new Set(["lib/matchmaking/challengeService.ts"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const INVITE_WRITE = /from\(\s*["']match_invitations["']\s*\)[^;]*?\.(insert|update|upsert|delete)\(/s;
const CHALLENGE_RPC = /rpc\(\s*["'](send_challenge|withdraw_challenge|expire_challenges)["']/;

describe("one writer of challenges (spec 070)", () => {
  it("writes match_invitations and calls the challenge functions only from challengeService", () => {
    const offenders = ROOTS.flatMap(sourceFiles)
      .filter((file) => !ALLOWED.has(file))
      .filter((file) => {
        const text = readFileSync(file, "utf8");
        return INVITE_WRITE.test(text) || CHALLENGE_RPC.test(text);
      });
    expect(offenders).toEqual([]);
  });
});
