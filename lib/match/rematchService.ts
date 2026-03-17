import type { RematchRequest, SeriesContext } from "@/lib/types/match";

/**
 * Checks if an existing pending request from the opponent constitutes
 * a simultaneous rematch (both players clicked Rematch).
 */
export function detectSimultaneousRematch(
  existingRequest: RematchRequest | null,
  callerId: string,
): boolean {
  if (!existingRequest) return false;
  return (
    existingRequest.status === "pending" &&
    existingRequest.responderId === callerId
  );
}

/**
 * Validates that a rematch request can be created for the given match.
 * Returns an error message or null if valid.
 */
export function validateRematchRequest(
  matchState: string,
  playerAId: string,
  playerBId: string,
  callerId: string,
  existingRequest: RematchRequest | null,
): string | null {
  if (matchState !== "completed") {
    return "Match is not finished yet. Rematch unavailable.";
  }

  const isParticipant =
    callerId === playerAId || callerId === playerBId;
  if (!isParticipant) {
    return "Only participants in the finished match can request a rematch.";
  }

  if (
    existingRequest &&
    existingRequest.status !== "pending" &&
    existingRequest.responderId !== callerId
  ) {
    return "A rematch has already been processed for this match.";
  }

  if (
    existingRequest &&
    existingRequest.requesterId === callerId &&
    existingRequest.status === "pending"
  ) {
    return "You have already requested a rematch for this match.";
  }

  if (
    existingRequest &&
    (existingRequest.status === "declined" ||
      existingRequest.status === "expired" ||
      existingRequest.status === "accepted")
  ) {
    return "A rematch has already been processed for this match.";
  }

  return null;
}

interface MatchChainEntry {
  id: string;
  rematchOf: string | null;
  winnerId: string | null;
}

/**
 * Walks the rematch_of chain backward from the given match to find all
 * matches in the series. Returns match IDs from oldest to newest.
 */
export function walkRematchChain(
  matches: MatchChainEntry[],
  startMatchId: string,
): string[] {
  const byId = new Map(matches.map((m) => [m.id, m]));
  const chain: string[] = [];
  let current = startMatchId;

  // Walk backward through rematch_of links
  const visited = new Set<string>();
  while (current) {
    if (visited.has(current)) break;
    visited.add(current);
    chain.unshift(current);
    const match = byId.get(current);
    if (!match?.rematchOf) break;
    current = match.rematchOf;
  }

  return chain;
}

/**
 * Derives series context (game number, wins) from a chain of matches.
 */
export function deriveSeriesContext(
  matches: MatchChainEntry[],
  chain: string[],
  currentPlayerId: string,
): SeriesContext {
  const byId = new Map(matches.map((m) => [m.id, m]));

  let currentPlayerWins = 0;
  let opponentWins = 0;
  let draws = 0;

  for (const matchId of chain) {
    const match = byId.get(matchId);
    if (!match) continue;
    if (match.winnerId === null) {
      draws++;
    } else if (match.winnerId === currentPlayerId) {
      currentPlayerWins++;
    } else {
      opponentWins++;
    }
  }

  return {
    gameNumber: chain.length,
    currentPlayerWins,
    opponentWins,
    draws,
  };
}
