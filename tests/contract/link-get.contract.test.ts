/**
 * Spec 072 T032 (FR-010, research R4): opening a link only reads it. A chat
 * app's preview, a prefetch or a crawler fetching `/c/:token` any number of
 * times uses nothing and writes nothing; only the POST of `accept ▸` does.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const redirect = vi.fn((to: string) => {
  throw Object.assign(new Error("NEXT_REDIRECT"), { to });
});
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to), notFound: vi.fn() }));
const linkService = vi.hoisted(() => ({ readLink: vi.fn(), acceptLink: vi.fn(), createLink: vi.fn(), cancelLink: vi.fn(), expireDueLinks: vi.fn() }));
vi.mock("@/lib/matchmaking/linkService", () => linkService);
const session = vi.hoisted(() => ({ current: null as { player: { id: string } } | null }));
vi.mock("@/lib/matchmaking/profile", () => ({ readLobbySession: vi.fn(async () => session.current) }));
vi.mock("@/lib/matchmaking/service", () => ({ findActiveMatchForPlayer: vi.fn(async () => null) }));
const writes = vi.hoisted(() => [] as string[]);
vi.mock("@/lib/supabase/server", () => ({
  getServiceRoleClient: () => ({
    rpc: (fn: string) => {
      writes.push(`rpc:${fn}`);
      return Promise.resolve({ data: null, error: null });
    },
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      for (const m of ["insert", "update", "upsert", "delete"]) chain[m] = () => (writes.push(`${m}:${table}`), chain);
      for (const m of ["select", "eq", "in", "or", "order", "limit", "gt"]) chain[m] = () => chain;
      chain.maybeSingle = () => Promise.resolve({ data: null, error: null });
      chain.then = (r: (v: unknown) => void) => r({ data: [], error: null });
      return chain;
    },
  }),
}));
vi.mock("@/lib/lobby/overview", () => ({ publicOverview: vi.fn(async () => ({ counts: { here: 0, searching: 0, playersInMatch: 0, matchesOn: 0, other: { language: "en", here: 0 } }, here: [], more: 0 })) }));
vi.mock("@/lib/auth/returningPlayer", () => ({ readReturningPlayer: vi.fn(async () => null) }));

import InvitePage, { generateMetadata } from "@/app/[locale]/(pages)/c/[token]/page";
import nextConfig from "@/next.config";

const TOKEN = "Xq7Vt2pLm9KcR4sWn8BjYd3HfA6gZe1uQo5iNw0bTyE";
const VIEW = { valid: true, senderId: "00000000-0000-4000-8000-000000000002", senderName: "Kári", senderHandle: "kári", senderRating: 1265, language: "en" as const, expiresAt: new Date(Date.now() + 500_000).toISOString() };

async function open(locale: string, token = TOKEN): Promise<{ to?: string }> {
  try {
    await InvitePage({ params: { locale, token } });
    return {};
  } catch (error) {
    return { to: (error as { to?: string }).to };
  }
}

describe("GET /c/:token (spec 072)", () => {
  beforeEach(() => {
    writes.length = 0;
    session.current = null;
    Object.values(linkService).forEach((fn) => fn.mockReset());
    linkService.readLink.mockResolvedValue(VIEW);
  });

  it("reads the link twenty times and uses nothing, writes nothing", async () => {
    for (let i = 0; i < 20; i += 1) await open("en");
    expect(linkService.readLink).toHaveBeenCalledTimes(20);
    expect(linkService.acceptLink).not.toHaveBeenCalled();
    expect(linkService.createLink).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
  });

  it("reads a malformed token as expired without a query", async () => {
    expect(await open("en", "not-a-token")).toEqual({});
    expect(linkService.readLink).not.toHaveBeenCalled();
  });

  it("sends a link opened under the other locale to its own", async () => {
    expect((await open("is")).to).toBe(`/en/c/${TOKEN}`);
  });

  it("sends a signed-in player to the lobby with the link's call, never using it", async () => {
    session.current = { player: { id: "birna" } };
    expect((await open("en")).to).toBe(`/en?invite=${TOKEN}`);
    expect(linkService.acceptLink).not.toHaveBeenCalled();
  });

  it("is never indexed, and its title names only the sender", async () => {
    const meta = await generateMetadata({ params: { locale: "en", token: TOKEN } });
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(meta.title).toBe("Kári challenges you · Wottle");
  });

  it("is never cached, and sends no Referer", async () => {
    const rules = await nextConfig.headers!();
    for (const source of ["/c/:token", "/en/c/:token"]) {
      const rule = rules.find((r) => r.source === source);
      expect(rule?.headers).toEqual(expect.arrayContaining([{ key: "Cache-Control", value: "private, no-store" }, { key: "Referrer-Policy", value: "no-referrer" }]));
    }
  });
});
