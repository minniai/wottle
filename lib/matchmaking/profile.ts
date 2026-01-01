import "server-only";

import { cookies } from "next/headers";
import { z } from "zod";

import { listCachedPresence, rememberPresence } from "./presenceCache";
import { upsertLobbyPresence, upsertPlayerIdentity } from "./service";
import type { LobbyStatus, PlayerIdentity } from "@/lib/types/match";
import { getServiceRoleClient } from "@/lib/supabase/server";

export interface LoginResult {
  player: PlayerIdentity;
  sessionToken: string;
}

export interface LobbySession {
  token: string;
  player: PlayerIdentity;
  issuedAt: number;
}

type CookieStore = Awaited<ReturnType<typeof cookies>>;

const SESSION_COOKIE_NAME = "wottle-playtest-session";
const SESSION_TTL_SECONDS = 4 * 60 * 60;
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
  .regex(/^[A-Za-z0-9_-]+$/, "Use only letters, numbers, underscores, or hyphens.");

const lobbyStatusSchema = z.enum(["available", "matchmaking", "in_match", "offline"]);

const sessionSchema: z.ZodType<LobbySession> = z.object({
  token: z.string().min(1),
  player: z.object({
    id: z.string().uuid(),
    username: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable().optional(),
    status: lobbyStatusSchema,
    lastSeenAt: z.string(),
    eloRating: z.number().nullable().optional(),
  }),
  issuedAt: z.number().int(),
});

export class LoginValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoginValidationError";
  }
}

export async function performUsernameLogin(usernameInput: string): Promise<LoginResult> {
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
  const presence = await createPresenceRecord(supabase, player.id);
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

  rememberPresence(player);
  console.log("[performUsernameLogin] Player added to server cache");

  return {
    player,
    sessionToken: crypto.randomUUID(),
  };
}

export async function persistLobbySession(
  result: LoginResult,
  store?: CookieStore
): Promise<LobbySession> {
  const session: LobbySession = {
    token: result.sessionToken,
    player: result.player,
    issuedAt: Date.now(),
  };

  const encoded = encodeSession(session);
  const cookieStore = store ?? (await cookies());
  cookieStore.set(SESSION_COOKIE_NAME, encoded, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });

  return session;
}

export async function readLobbySession(
  store?: CookieStore
): Promise<LobbySession | null> {
  const cookieStore = store ?? (await cookies());
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) {
    return null;
  }

  try {
    const decoded = decodeSession(raw);
    return sessionSchema.parse(decoded);
  } catch {
    return null;
  }
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

export async function fetchLobbySnapshot(): Promise<PlayerIdentity[]> {
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

  const cachedPlayers = listCachedPresence();

  return sortPlayers(dedupePlayers([...players, ...cachedPlayers]));
}

function encodeSession(session: LobbySession): string {
  return Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
}

function decodeSession(value: string): unknown {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

function formatDisplayName(username: string): string {
  if (!username) {
    return "Player";
  }

  return username.charAt(0).toUpperCase() + username.slice(1);
}

async function createPresenceRecord(supabase: ReturnType<typeof getServiceRoleClient>, playerId: string) {
  const connectionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + PRESENCE_TTL_SECONDS * 1_000);

  return upsertLobbyPresence(supabase, {
    playerId,
    connectionId,
    mode: "auto",
    inviteToken: null,
    expiresAt,
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

function shouldUseSecureCookies(): boolean {
  const raw = process.env.PLAYTEST_SESSION_SECURE;
  if (raw) {
    const normalized = raw.trim().toLowerCase();
    if (["1", "true", "on", "yes", "enabled"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "off", "no", "disabled"].includes(normalized)) {
      return false;
    }
  }
  return process.env.NODE_ENV === "production";
}



