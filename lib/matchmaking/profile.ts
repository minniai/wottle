import { readEloRatings } from "@/lib/rating/playerRatings";
import type { Language } from "@/lib/types/game-config";
import "server-only";

import { cookies } from "next/headers";
import { z } from "zod";

import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS, sessionCookieOptions } from "@/lib/auth/cookies";
import { requireSessionSecret } from "@/lib/auth/sessionSecret";
import { signSession, verifySession, type SessionRejection } from "@/lib/auth/sessionToken";

import { listCachedPresence, rememberPresence } from "./presenceCache";
import {
  findActiveMatchForPlayer,
  upsertLobbyPresence,
  upsertPlayerIdentity,
} from "./service";
import type { LobbyStatus, PlayerIdentity } from "@/lib/types/match";
import { getServiceRoleClient } from "@/lib/supabase/server";

export interface LoginResult {
  player: PlayerIdentity;
}

/** Who a session says the viewer is. Everything else about them is read fresh (spec 067 R1). */
export interface SessionPlayer {
  id: string;
  username: string;
  displayName: string;
}

export interface LobbySession {
  player: SessionPlayer;
  issuedAt: number;
  expiresAt: number;
}

type CookieStore = Awaited<ReturnType<typeof cookies>>;

export { SESSION_COOKIE_NAME };
// Increased from 30s to 5 minutes for more reliable presence tracking in CI
const PRESENCE_TTL_SECONDS = Number(
  process.env.PLAYTEST_PRESENCE_TTL_SECONDS ?? "300"
);

const usernameSchema = z
  .string({
    required_error: "Username is required.",
    invalid_type_error: "Username must be a string.",
  })
  .trim()
  .min(3, "Username must be at least 3 characters long.")
  .max(24, "Username must be fewer than 25 characters.")
  .regex(
    /^[A-Za-zÁÐÉÍÓÚÝÞÆÖáðéíóúýþæö0-9_-]+$/,
    "Use only letters (including Icelandic), numbers, underscores, or hyphens."
  );

export class LoginValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoginValidationError";
  }
}

/** `language` is the lobby the sign-in happened in (spec 060); the player is present there first. */
export async function performUsernameLogin(usernameInput: string, language: Language = "is"): Promise<LoginResult> {
  console.log("[performUsernameLogin] Starting login for:", usernameInput);
  
  const parsed = usernameSchema.safeParse(usernameInput);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid username.";
    throw new LoginValidationError(message);
  }

  const normalizedUsername = parsed.data.toLowerCase();
  const displayName = formatDisplayName(parsed.data);
  const supabase = getServiceRoleClient();

  console.log("[performUsernameLogin] Creating player identity...");
  const player = await upsertPlayerIdentity(supabase, {
    username: normalizedUsername,
    displayName,
    status: "available",
  });
  console.log("[performUsernameLogin] Player created:", player.id);

  console.log("[performUsernameLogin] Creating presence record...");
  const presence = await createPresenceRecord(supabase, player.id, language);
  console.log("[performUsernameLogin] Presence created:", {
    playerId: presence.playerId,
    expiresAt: presence.expiresAt,
    mode: presence.mode,
  });

  // Verify presence record was actually persisted
  const { data: verification, error: verifyError } = await supabase
    .from("lobby_presence")
    .select("*")
    .eq("player_id", player.id)
    .single();
  
  if (verifyError) {
    console.error("[performUsernameLogin] Failed to verify presence record:", verifyError);
    throw new Error(`Presence verification failed: ${verifyError.message}`);
  }
  
  console.log("[performUsernameLogin] Presence verified in database:", {
    playerId: verification.player_id,
    expiresAt: verification.expires_at,
    isExpired: new Date(verification.expires_at) <= new Date(),
  });

  rememberPresence(player, language);
  console.log("[performUsernameLogin] Player added to server cache");

  return { player };
}

export async function persistLobbySession(
  result: { player: SessionPlayer },
  store?: CookieStore
): Promise<LobbySession> {
  const issuedAt = Date.now();
  const session: LobbySession = {
    player: { id: result.player.id, username: result.player.username, displayName: result.player.displayName },
    issuedAt,
    expiresAt: issuedAt + SESSION_TTL_SECONDS * 1000,
  };
  const cookieStore = store ?? (await cookies());
  cookieStore.set(SESSION_COOKIE_NAME, signedValueOf(session), sessionCookieOptions());
  return session;
}

/** The one reader of the session cookie (FR-003): only a server-signed, unexpired session names a player. */
export async function readLobbySession(
  store?: CookieStore
): Promise<LobbySession | null> {
  const cookieStore = store ?? (await cookies());
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;
  const verified = verifySession(raw, requireSessionSecret(), Date.now());
  if (!verified.ok) {
    logRejectedSession(verified.reason);
    return null;
  }
  const { playerId, username, displayName, issuedAt, expiresAt } = verified.payload;
  return { player: { id: playerId, username, displayName }, issuedAt, expiresAt };
}

function signedValueOf(session: LobbySession): string {
  const { player, issuedAt, expiresAt } = session;
  return signSession(
    { playerId: player.id, username: player.username, displayName: player.displayName, issuedAt, expiresAt },
    requireSessionSecret(),
  );
}

// Every pre-067 cookie reads as legacy until its owner signs in again; sample those.
const LEGACY_LOG_SAMPLE = 0.1;

function logRejectedSession(reason: SessionRejection): void {
  if (reason === "legacy" && Math.random() >= LEGACY_LOG_SAMPLE) return;
  console.warn(JSON.stringify({ event: "auth.session.rejected", reason }));
}

type LobbySnapshotRow = {
  player: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    status: LobbyStatus;
    last_seen_at: string;
    elo_rating: number | null;
  } | null;
};

/** Who is here in one language's lobby (spec 060 FR-019). */
export async function fetchLobbySnapshot(language: Language = "is"): Promise<PlayerIdentity[]> {
  const supabase = getServiceRoleClient();

  const { data, error } = await supabase
    .from("lobby_presence")
    .select(
      `
        player:player_id (
          id,
          username,
          display_name,
          avatar_url,
          status,
          last_seen_at,
          elo_rating
        )
      `
    )
    .gt("expires_at", new Date().toISOString())
    .eq("language", language)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch lobby snapshot: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as Array<{
    player: LobbySnapshotRow["player"];
  }>;
  const players = rows
    .map((row) => row.player)
    .filter(
      (player): player is NonNullable<LobbySnapshotRow["player"]> => Boolean(player)
    )
    .map((playerRow) => ({
      id: playerRow.id,
      username: playerRow.username,
      displayName: playerRow.display_name,
      avatarUrl: playerRow.avatar_url,
      status: playerRow.status,
      lastSeenAt: playerRow.last_seen_at,
      eloRating: playerRow.elo_rating,
    }));

  const cachedPlayers = listCachedPresence(language);
  const everyone = dedupePlayers([...players, ...cachedPlayers]);
  // The rating beside each name is the lobby's language's (spec 060 US4).
  const ratings = await readEloRatings(supabase, everyone.map((p) => p.id), language);
  return sortPlayers(everyone.map((p) => ({ ...p, eloRating: ratings.get(p.id) ?? p.eloRating })));
}

// Heal `players.status` when it's stuck at "in_match" but no pending or
// in_progress match exists for the player. Root cause mirrors issue #117:
// completing a match flips matches.state, then resets player status in a
// separate step (completeMatchInternal); if that step errors or the process
// dies, players.status stays "in_match" forever. That stale row
// shows up in /api/lobby/players and fights the realtime-tracked value
// (status="available" from the session cookie) every ~500ms poll, so the
// PlayNowCard button visibly oscillates between "Play Now" and
// "Already in a match".
//
// This runs on every lobby page load, so it must NEVER throw — the lobby
// page crashing for a transient DB blip would be worse than leaving a stale
// status in place. All errors are swallowed and logged.
export async function healStuckInMatchStatus(playerId: string): Promise<void> {
  try {
    const supabase = getServiceRoleClient();
    const { data: player, error: selectError } = await supabase
      .from("players")
      .select("status")
      .eq("id", playerId)
      .maybeSingle();

    if (selectError || player?.status !== "in_match") {
      return;
    }

    const activeMatch = await findActiveMatchForPlayer(
      supabase,
      playerId,
    ).catch(() => null);
    if (activeMatch) {
      return;
    }

    const { error } = await supabase
      .from("players")
      .update({ status: "available", last_seen_at: new Date().toISOString() })
      .eq("id", playerId)
      .eq("status", "in_match");

    if (error) {
      console.error(
        JSON.stringify({
          event: "player.status.heal.failed",
          playerId,
          error: error.message,
        }),
      );
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "player.status.heal.threw",
        playerId,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

function formatDisplayName(username: string): string {
  if (!username) {
    return "Player";
  }

  return username.charAt(0).toUpperCase() + username.slice(1);
}

async function createPresenceRecord(supabase: ReturnType<typeof getServiceRoleClient>, playerId: string, language: Language) {
  const connectionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + PRESENCE_TTL_SECONDS * 1_000);

  return upsertLobbyPresence(supabase, {
    playerId,
    connectionId,
    mode: "auto",
    inviteToken: null,
    expiresAt,
    language,
  });
}

function dedupePlayers(players: PlayerIdentity[]): PlayerIdentity[] {
  const map = new Map<string, PlayerIdentity>();
  for (const player of players) {
    map.set(player.id, player);
  }
  return Array.from(map.values());
}

function sortPlayers(players: PlayerIdentity[]): PlayerIdentity[] {
  return [...players].sort((a, b) => a.username.localeCompare(b.username));
}

/**
 * The signed-in player with their status and their rating in `language` (spec 060 US4).
 * The session names only who they are (spec 067), so every page that shows the
 * viewer's own bar reads the rest fresh here.
 */
export async function viewerInLanguage(player: SessionPlayer, language: Language): Promise<PlayerIdentity> {
  const supabase = getServiceRoleClient();
  const [row, ratings] = await Promise.all([
    readViewerRow(supabase, player.id),
    readEloRatings(supabase, [player.id], language).catch((error) => {
      console.warn("[viewerInLanguage] rating read failed", error);
      return new Map<string, number>();
    }),
  ]);
  return {
    id: player.id,
    username: player.username,
    displayName: player.displayName,
    avatarUrl: row?.avatar_url ?? null,
    status: row?.status ?? "available",
    lastSeenAt: row?.last_seen_at ?? new Date().toISOString(),
    eloRating: ratings.get(player.id) ?? null,
  };
}

type ViewerRow = { status: LobbyStatus; avatar_url: string | null; last_seen_at: string };

async function readViewerRow(supabase: ReturnType<typeof getServiceRoleClient>, playerId: string): Promise<ViewerRow | null> {
  const { data, error } = await supabase.from("players").select("status, avatar_url, last_seen_at").eq("id", playerId).maybeSingle();
  if (error) console.warn("[viewerInLanguage] player read failed", error);
  return (data as ViewerRow | null) ?? null;
}
