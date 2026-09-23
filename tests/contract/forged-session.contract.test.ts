/**
 * Spec 067 SC-001: a forged, edited or pre-067 session cookie is no session at all.
 * Every route handler and the write-path server actions go through the real
 * readLobbySession. A forged cookie must produce exactly the no-cookie outcome and
 * never reach the database as the player it names; a valid cookie must reach it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: vi.fn(),
    delete: vi.fn(),
  })),
  headers: vi.fn(async () => new Headers({ "x-forwarded-for": "203.0.113.9" })),
}));

const reachedDatabase = vi.hoisted(() => ({ count: 0 }));
vi.mock("@/lib/supabase/server", () => ({
  getServiceRoleClient: vi.fn(() => {
    reachedDatabase.count += 1;
    throw new Error("database reached");
  }),
}));

import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";
import { requireSessionSecret } from "@/lib/auth/sessionSecret";
import { signSession } from "@/lib/auth/sessionToken";
import { resetRateLimitStoreForTests } from "@/lib/rate-limiting/middleware";

const PLAYER_ID = "0b4ee0a1-7d25-4b2c-9a39-1a2b3c4d5e6f";
const MATCH_ID = "5f0e3c1a-2b4d-4e6f-8a9b-0c1d2e3f4a5b";
const INVITE_ID = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

function validCookie(): string {
  const now = Date.now();
  return signSession(
    { playerId: PLAYER_ID, username: "birna", displayName: "Birna", issuedAt: now, expiresAt: now + 60_000 },
    requireSessionSecret(),
  );
}

function legacyCookie(): string {
  const session = { token: "t", issuedAt: Date.now(), player: { id: PLAYER_ID, username: "birna", displayName: "Birna", status: "available", lastSeenAt: "" } };
  return Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
}

function editedCookie(): string {
  const value = validCookie();
  const i = 8;
  return value.slice(0, i) + (value[i] === "A" ? "B" : "A") + value.slice(i + 1);
}

type Outcome = { status?: number; body?: unknown; error?: string };

async function outcomeOf(call: () => Promise<unknown>): Promise<Outcome> {
  try {
    const result = await call();
    if (result instanceof Response) return { status: result.status, body: await result.text() };
    return { body: result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

const params = <T extends Record<string, string>>(value: T) => ({ params: Promise.resolve(value) });
const json = (body: unknown) => new Request("http://localhost/", { method: "POST", body: JSON.stringify(body) });

const CALLERS: Array<[string, () => Promise<unknown>]> = [
  ["GET /api/match/[id]/state", async () => (await import("@/app/api/match/[matchId]/state/route")).GET(new Request("http://localhost/"), params({ matchId: MATCH_ID }))],
  ["GET /api/match/[id]/words", async () => (await import("@/app/api/match/[matchId]/words/route")).GET(new Request("http://localhost/"), params({ matchId: MATCH_ID }))],
  ["POST /api/match/[id]/disconnect", async () => (await import("@/app/api/match/[matchId]/disconnect/route")).POST(json({}), params({ matchId: MATCH_ID }))],
  ["GET /api/match/active", async () => (await import("@/app/api/match/active/route")).GET(new Request("http://localhost/"))],
  ["POST /api/match/start", async () => (await import("@/app/api/match/start/route")).POST()],
  ["GET /api/lobby/players", async () => (await import("@/app/api/lobby/players/route")).GET(new Request("http://localhost/api/lobby/players?language=en"))],
  ["POST /api/presence/beat", async () => (await import("@/app/api/presence/beat/route")).POST(json({ tabId: MATCH_ID, visible: true, inputAgoMs: 0, page: "lobby" }))],
  ["POST /api/presence/leave", async () => (await import("@/app/api/presence/leave/route")).POST(json({ tabId: MATCH_ID }))],
  ["POST /api/lobby/invite/withdraw", async () => (await import("@/app/api/lobby/invite/withdraw/route")).POST(json({ inviteId: INVITE_ID }))],
  ["POST /api/lobby/invite/[id]/respond", async () => (await import("@/app/api/lobby/invite/[inviteId]/respond/route")).POST(json({ decision: "accepted" }), params({ inviteId: INVITE_ID }))],
  ["POST /api/lobby/presence", async () => (await import("@/app/api/lobby/presence/route")).POST(json({ language: "en" }))],
  ["DELETE /api/lobby/presence", async () => (await import("@/app/api/lobby/presence/route")).DELETE()],
  ["submitMove", async () => (await import("@/app/actions/match/submitMove")).submitMove(MATCH_ID, { fromX: 0, fromY: 0, toX: 1, toY: 0 })],
  ["sendChallengeAction", async () => (await import("@/app/actions/challenge/send")).sendChallengeAction({ recipientId: MATCH_ID })],
  ["withdrawChallengeAction", async () => (await import("@/app/actions/challenge/withdraw")).withdrawChallengeAction({ inviteId: INVITE_ID })],
  ["respondChallengeAction", async () => (await import("@/app/actions/challenge/respond")).respondChallengeAction({ inviteId: INVITE_ID, answer: "accept" })],
  ["startQueueAction", async () => (await import("@/app/actions/matchmaking/startQueue")).startQueueAction({ language: "en" })],
  ["resignMatch", async () => (await import("@/app/actions/match/resignMatch")).resignMatch(MATCH_ID)],
];

async function outcomeWith(cookie: string | null, call: () => Promise<unknown>): Promise<{ outcome: Outcome; reached: number }> {
  jar.clear();
  if (cookie !== null) jar.set(SESSION_COOKIE_NAME, cookie);
  reachedDatabase.count = 0;
  const outcome = await outcomeOf(call);
  return { outcome, reached: reachedDatabase.count };
}

describe("a forged session is no session (spec 067 SC-001)", () => {
  beforeEach(() => {
    resetRateLimitStoreForTests();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  describe.each(CALLERS)("%s", (_name, call) => {
    it.each([
      ["an old unsigned cookie naming a real player", legacyCookie],
      ["a signed cookie with one character changed", editedCookie],
    ])("should treat %s exactly as no cookie", async (_label, forge) => {
      const none = await outcomeWith(null, call);
      const forged = await outcomeWith(forge(), call);
      expect(forged).toEqual(none);
      expect(forged.reached).toBe(0);
    });

    it("should let a valid signed cookie through to the player's data", async () => {
      const valid = await outcomeWith(validCookie(), call);
      const none = await outcomeWith(null, call);
      expect(valid.outcome).not.toEqual(none.outcome);
    });
  });
});
