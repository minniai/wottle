import "server-only";

import { lobbyCounts } from "@/lib/lobby/overview";
import { headToHead } from "@/lib/matchmaking/headToHead";
import { readTableStatus } from "@/lib/matchmaking/tableStatus";
import { playerPresence } from "@/lib/presence/presenceService";
import { topicFor } from "@/lib/realtime/pokes";
import { readEloRatings, readRatings } from "@/lib/rating/playerRatings";
import { getServiceRoleClient } from "@/lib/supabase/server";
import type { OutgoingLink } from "@/lib/types/link";
import type { HeadToHead, InviteStatus, LobbyLanguage, LobbyRow, MatchFact, PresenceState, StandingFacts } from "@/lib/types/standing";

/**
 * Everything the line slot can show, for one viewer (spec 070 R5, contract
 * routes-and-actions GET /api/standing): calls, the outgoing challenge and
 * its outcome, decline cooldowns, the search, the table cooldown, the match,
 * and the viewer's player topic. The slot's precedence is the client's.
 */
type Client = ReturnType<typeof getServiceRoleClient>;
const NEWCOMER_RATING = 1200;
const OUTCOME_WINDOW_MS = 10_000;
const DECLINE_COOLDOWN_MS = 60_000;

interface PersonRow {
  id: string;
  username: string;
  display_name: string;
}

interface InviteRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  status: InviteStatus;
  created_at: string;
  expires_at: string;
  responded_at: string | null;
  match_id: string | null;
}

interface Context {
  client: Client;
  viewerId: string;
  language: LobbyLanguage;
}

async function rowsFor(ctx: Context, ids: string[]): Promise<Map<string, LobbyRow>> {
  if (ids.length === 0) return new Map();
  const [people, ratings, records, presence] = await Promise.all([
    ctx.client.from("players").select("id, username, display_name").in("id", ids),
    readEloRatings(ctx.client, ids, ctx.language),
    headToHead(ctx.viewerId, ctx.language),
    playerPresence(ctx.language),
  ]);
  const stateOf = new Map(presence.map((p) => [p.playerId, p]));
  return new Map(
    ((people.data ?? []) as PersonRow[]).map((p) => {
      const facts = stateOf.get(p.id);
      const record: HeadToHead | null = records.get(p.id) ?? null;
      const state: PresenceState = facts?.state ?? "here";
      return [p.id, { playerId: p.id, displayName: p.display_name, handle: p.username, rating: ratings.get(p.id) ?? NEWCOMER_RATING, state, movesPlayed: facts?.movesPlayed ?? null, record }];
    }),
  );
}

async function invites(ctx: Context): Promise<{ incoming: InviteRow[]; outgoing: InviteRow | null; declines: InviteRow[] }> {
  const now = Date.now();
  const since = new Date(now - DECLINE_COOLDOWN_MS).toISOString();
  const [incoming, outgoing, declines] = await Promise.all([
    ctx.client.from("match_invitations").select("*").eq("recipient_id", ctx.viewerId).eq("status", "pending").gt("expires_at", new Date(now).toISOString()).order("created_at", { ascending: true }),
    ctx.client.from("match_invitations").select("*").eq("sender_id", ctx.viewerId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ctx.client.from("match_invitations").select("*").eq("sender_id", ctx.viewerId).eq("status", "declined").eq("auto_declined", false).gt("responded_at", since),
  ]);
  const last = outgoing.data as InviteRow | null;
  const current = last && (last.status === "pending" || (last.responded_at && now - Date.parse(last.responded_at) < OUTCOME_WINDOW_MS)) ? last : null;
  return { incoming: (incoming.data ?? []) as InviteRow[], outgoing: current, declines: (declines.data ?? []) as InviteRow[] };
}

async function matchFact(ctx: Context, unseen: string | null): Promise<MatchFact | null> {
  const { data: live } = await ctx.client
    .from("matches")
    .select("id, state, player_a_id, player_b_id, player_a_moves, player_b_moves, move_limit, deadline_at, player_a:player_a_id (display_name), player_b:player_b_id (display_name)")
    .in("state", ["pending", "in_progress"])
    .or(`player_a_id.eq.${ctx.viewerId},player_b_id.eq.${ctx.viewerId}`)
    .limit(1)
    .maybeSingle();
  if (live) {
    const isA = live.player_a_id === ctx.viewerId;
    const opponent = ((isA ? live.player_b : live.player_a) as unknown as { display_name: string } | null)?.display_name ?? "";
    return { kind: live.state === "pending" ? "table" : "running", matchId: live.id as string, opponent, movesPlayed: (isA ? live.player_a_moves : live.player_b_moves) as number, moveLimit: live.move_limit as number, deadlineAt: (live.deadline_at as string | null) ?? null };
  }
  return unseen ? overFact(ctx, unseen) : null;
}

async function overFact(ctx: Context, matchId: string): Promise<MatchFact | null> {
  const { data: m } = await ctx.client
    .from("matches")
    .select("id, state, ended_reason, winner_id, player_a_id, player_a_score, player_b_score, player_a:player_a_id (display_name), player_b:player_b_id (display_name)")
    .eq("id", matchId)
    .maybeSingle();
  if (!m || m.ended_reason === "void") return null;
  const isA = m.player_a_id === ctx.viewerId;
  const names = { a: (m.player_a as unknown as { display_name: string } | null)?.display_name ?? "", b: (m.player_b as unknown as { display_name: string } | null)?.display_name ?? "" };
  const winner = m.winner_id === null ? "draw" : m.winner_id === ctx.viewerId ? "you" : "opponent";
  const winnerName = m.winner_id === null ? null : m.winner_id === m.player_a_id ? names.a : names.b;
  return {
    kind: "over",
    matchId: m.id as string,
    opponent: isA ? names.b : names.a,
    winner,
    winnerName,
    you: ((isA ? m.player_a_score : m.player_b_score) as number | null) ?? 0,
    them: ((isA ? m.player_b_score : m.player_a_score) as number | null) ?? 0,
    endedReason: (m.ended_reason as string | null) ?? null,
  };
}

/** Spec 072: the viewer's newest link, while pending or within 10s of ending; never its hash. */
async function linkFact(ctx: Context): Promise<OutgoingLink | null> {
  const { data } = await ctx.client
    .from("match_links")
    .select("id, status, expires_at, responded_at")
    .eq("sender_id", ctx.viewerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const respondedAt = (data.responded_at as string | null) ?? null;
  const standing = data.status === "pending" || (respondedAt !== null && Date.now() - Date.parse(respondedAt) < OUTCOME_WINDOW_MS);
  return standing ? { id: data.id as string, status: data.status as OutgoingLink["status"], expiresAt: data.expires_at as string, respondedAt } : null;
}

export async function readStanding(viewerId: string): Promise<StandingFacts> {
  const client = getServiceRoleClient();
  const { data: me } = await client.from("players").select("status, lobby_language, queued_at, search_paused, unseen_result_match_id").eq("id", viewerId).single();
  const language: LobbyLanguage = me?.lobby_language === "en" ? "en" : "is";
  const ctx: Context = { client, viewerId, language };
  const [mine, match, table, counts, link] = await Promise.all([
    invites(ctx),
    matchFact(ctx, (me?.unseen_result_match_id as string | null) ?? null),
    readTableStatus(client, viewerId),
    lobbyCounts(language),
    linkFact(ctx),
  ]);
  const own = (await readRatings(client, [viewerId], language)).get(viewerId);
  const ids = [...new Set([...mine.incoming.map((i) => i.sender_id), ...(mine.outgoing ? [mine.outgoing.recipient_id] : [])])];
  const rows = await rowsFor(ctx, ids);
  return {
    now: new Date().toISOString(),
    topic: topicFor(viewerId),
    lobbyLanguage: (me?.lobby_language as LobbyLanguage | null) ?? null,
    incoming: mine.incoming.flatMap((i) => {
      const from = rows.get(i.sender_id);
      return from ? [{ inviteId: i.id, from, expiresAt: i.expires_at }] : [];
    }),
    outgoing: mine.outgoing && rows.get(mine.outgoing.recipient_id)
      ? { inviteId: mine.outgoing.id, to: rows.get(mine.outgoing.recipient_id)!, status: mine.outgoing.status, createdAt: mine.outgoing.created_at, expiresAt: mine.outgoing.expires_at, respondedAt: mine.outgoing.responded_at, matchId: mine.outgoing.match_id }
      : null,
    cooldowns: mine.declines.map((d) => ({ playerId: d.recipient_id, until: new Date(Date.parse(d.responded_at!) + DECLINE_COOLDOWN_MS).toISOString() })),
    search: me?.status === "matchmaking" && me.queued_at ? { queuedAt: me.queued_at as string, paused: Boolean(me.search_paused) } : null,
    tableCooldownUntil: table.cooldownUntil,
    match,
    switchPending: null,
    link,
    notice: table.notice,
    counts: { here: counts.here, searching: counts.searching, playing: counts.playersInMatch, otherHere: counts.other.here },
    viewer: { rating: own?.eloRating ?? NEWCOMER_RATING, gamesPlayed: own?.gamesPlayed ?? 0 },
  };
}
