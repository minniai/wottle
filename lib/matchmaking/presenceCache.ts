import type { PlayerIdentity } from "../types/match";

interface CachedPresence {
  player: PlayerIdentity;
  expiresAt: number;
}

// Increased from 30s to 5 minutes to match DB presence TTL
const CACHE_TTL_MS = Number(
  process.env.PLAYTEST_PRESENCE_CACHE_TTL_MS ?? 300_000
);

const CACHE_SYMBOL = Symbol.for("wottle.presenceCache");

type GlobalWithPresenceCache = typeof globalThis & {
  [CACHE_SYMBOL]?: Map<string, CachedPresence>;
};

const getCache = (): Map<string, CachedPresence> => {
  const globalWithCache = globalThis as GlobalWithPresenceCache;
  if (!globalWithCache[CACHE_SYMBOL]) {
    globalWithCache[CACHE_SYMBOL] = new Map<string, CachedPresence>();
  }
  return globalWithCache[CACHE_SYMBOL]!;
};

function pruneExpired(cache: Map<string, CachedPresence>) {
  const now = Date.now();
  for (const [playerId, entry] of cache.entries()) {
    if (entry.expiresAt <= now) {
      cache.delete(playerId);
    }
  }
}

export function rememberPresence(player: PlayerIdentity) {
  const cache = getCache();
  pruneExpired(cache);
  cache.set(player.id, {
    player: {
      ...player,
      lastSeenAt: new Date().toISOString(),
    },
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export function forgetPresence(playerId: string) {
  const cache = getCache();
  cache.delete(playerId);
}

export function listCachedPresence(): PlayerIdentity[] {
  const cache = getCache();
  pruneExpired(cache);
  return Array.from(cache.values()).map((entry) => entry.player);
}

