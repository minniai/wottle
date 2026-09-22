import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Design plan §10 visual acceptance: nothing outside the seven tokens, no
 * radii/shadows/gradients, none of the retired font names. Scoped to the
 * P5 scope: all of `app/` and `components/`, plus the room's lib modules.
 */
const ROOT = resolve(__dirname, "../../..");
const SCOPE = ["app", "components", "lib/room", "lib/constants/seatColors.ts", "lib/i18n/copy/en.ts"];
/**
 * Case-insensitive (spec 045 D1): the retired font aliases were declared in
 * lower case, so `/Fraunces|JetBrains/` passed over the very tokens it existed
 * to forbid. The retired colour families are named here for the same reason.
 */
const BANNED = /rounded-|shadow-|gradient|emerald|red-\d|amber|fraunces|\binter\b|jetbrains|--ochre|--p1-|--p2-|--good|--warn|--bad|--hair/i;
const ALLOWLIST: RegExp[] = [];
/**
 * Spec 048: the strings and names retired with the unranked branch, the in-room
 * rules and the ledger's decision lines. `unranked` is matched as a word so that
 * `unranked` in a comment about its removal still trips — say "the retired rank
 * label" instead. The slip is the one component allowed over the field.
 * Spec 049: the `shared` cell state and `sharedCells` went with the ink rule —
 * a scored letter has one owner and one colour.
 */
const RETIRED = /\bunranked\b|no rating change|\? rules|FIRST_MATCH_RULES|firstMatchRules|resignConfirm|RESIGN_CONFIRM|claimWinLine|notice-claim-win|notice-confirm-resign|rankLabel|isMatchRated|sharedCells|seatOfCell|"shared"/;
const RETIRED_SCOPE = ["app", "components", "lib/room", "lib/i18n/copy/en.ts", "lib/matchmaking", "app/actions/match"];
/**
 * Spec 050: the names retired with rounds, per-player clocks, pins and
 * duplicate suppression. Matched in the room and in the server code that
 * replaced them (lib/match, lib/game-engine, lib/types).
 */
const RETIRED_050 = /roundState|advanceRound|roundEngine|instantScor|RoundSummary|partialSummary|pendingMoves|processRoundScoring|RoundScoreResult|is_duplicate|isDuplicate|SETTLE_HOLD_MS|currentRound|current_round|round_limit|timer_ms|TimerState|ClockLane|RoundRail|useClockTick|useSettleHold|useAccumulatedRounds|round-rail|round-indicator|player-bar-clock|opponentPinned|CLAIM_THE_WIN|scoreboard_snapshots|move_submissions/;
/** 2026-09-21: every match is rated, so nothing the player reads says "ranked". */
const RETIRED_RANKED = /play ranked|PLAY_RANKED|playRanked|action-ranked|ranked ·/;
const RETIRED_050_SCOPE = [...RETIRED_SCOPE, "lib/match", "lib/game-engine", "lib/types", "lib/realtime", "lib/scoring"];

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

describe("retired room strings (spec 048)", () => {
  const all = [...new Set(RETIRED_SCOPE.flatMap(files))];

  test.each(all.map((f) => [f.replace(`${ROOT}/`, "")]))("%s names nothing retired", (rel) => {
    const lines = readFileSync(join(ROOT, rel), "utf8").split("\n");
    const hits = lines.map((line, i) => ({ line, n: i + 1 })).filter(({ line }) => RETIRED.test(line));
    expect(hits, hits.map((h) => `${rel}:${h.n}: ${h.line.trim()}`).join("\n")).toEqual([]);
  });

  test("only the slip is positioned over the field", () => {
    const css = readFileSync(join(ROOT, "app/styles/room.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const absolute = [...css.matchAll(/([^{}]+)\{[^}]*position:\s*absolute[^}]*\}/g)].map((m) => m[1].trim());
    const overField = absolute.filter((sel) => !/^\.(field__|player-bar__lane|room-menu__list|ledger__|lobby-|profile|name-input|rail)/.test(sel));
    expect(overField).toEqual([".slip"]);
  });
});

describe("retired with rounds (spec 050)", () => {
  const all = [...new Set(RETIRED_050_SCOPE.flatMap(files))];

  test.each(all.map((f) => [f.replace(`${ROOT}/`, "")]))("%s names nothing retired with rounds", (rel) => {
    const lines = readFileSync(join(ROOT, rel), "utf8").split("\n");
    const hits = lines.map((line, i) => ({ line, n: i + 1 })).filter(({ line }) => RETIRED_050.test(line) || RETIRED_RANKED.test(line));
    expect(hits, hits.map((h) => `${rel}:${h.n}: ${h.line.trim()}`).join("\n")).toEqual([]);
  });
});
