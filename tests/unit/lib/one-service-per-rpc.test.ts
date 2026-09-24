import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Spec 070 T114: each database function of this feature has one TypeScript
 * door, the service that parses its reply and logs it.
 */
const DOORS: Record<string, string[]> = {
  "lib/presence/presenceService.ts": ["beat_tab", "leave_tab", "beat_match_from_page", "player_presence", "lobby_counts"],
  "lib/matchmaking/challengeService.ts": ["send_challenge", "withdraw_challenge", "expire_challenges"],
  "lib/matchmaking/lobbyLanguage.ts": ["enter_lobby", "confirm_lobby_switch"],
  "lib/lobby/sweepLobby.ts": ["settle_gone_players"],
  "lib/matchmaking/headToHead.ts": ["head_to_head"],
  "lib/match/unseenResult.ts": ["mark_unseen_result", "clear_unseen_result"],
  // Spec 071: accept_rematch stays with the other creation functions in lib/match/createMatch.ts.
  // Spec 072: accept_link stays with the other creation functions in lib/match/createMatch.ts.
  "lib/matchmaking/linkService.ts": ["create_link", "read_link", "cancel_link", "expire_links"],
  "lib/match/createMatch.ts": ["accept_link"],
  "lib/profile/profileRepository.ts": ["best_words", "presence_word"],
  "lib/match/rematchService.ts": ["request_rematch", "decline_rematch", "withdraw_rematch", "expire_due_rematches", "pair_cooldown_until", "player_on_match", "rematch_series"],
};

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : sources(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const root = process.cwd();
const files = ["app", "lib", "components"].flatMap((d) => sources(join(root, d))).map((p) => ({ path: relative(root, p), text: readFileSync(p, "utf8") }));

describe("one service per RPC (spec 070 T114)", () => {
  for (const [door, fns] of Object.entries(DOORS)) {
    for (const fn of fns) {
      it(`${fn} is called only from ${door}`, () => {
        const callers = files.filter((f) => f.text.includes(`"${fn}"`)).map((f) => f.path);
        expect(callers.filter((p) => p !== door)).toEqual([]);
      });
    }
  }
});
