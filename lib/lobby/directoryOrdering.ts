import { LOBBY_DIRECTORY_CAP } from "@/lib/constants/lobby";
import type { LobbyStatus, PlayerIdentity } from "@/lib/types/match";

export interface DirectoryOrderingInput {
  players: PlayerIdentity[];
  selfId: string;
  viewerRating: number;
  cap?: number;
}

export interface DirectoryOrderingOutput {
  visible: PlayerIdentity[];
  hidden: PlayerIdentity[];
}

const STATUS_RANK: Record<LobbyStatus, number> = {
  available: 0,
  matchmaking: 1,
  in_match: 2,
  offline: 3,
};

const DEFAULT_RATING = 1200;

function rank(
  a: PlayerIdentity,
  b: PlayerIdentity,
  viewerRating: number,
): number {
  const statusCmp = STATUS_RANK[a.status] - STATUS_RANK[b.status];
  if (statusCmp !== 0) {
    return statusCmp;
  }
  const aRating = a.eloRating ?? DEFAULT_RATING;
  const bRating = b.eloRating ?? DEFAULT_RATING;
  const diffCmp =
    Math.abs(aRating - viewerRating) - Math.abs(bRating - viewerRating);
  if (diffCmp !== 0) {
    return diffCmp;
  }
  return Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt);
}

export function orderDirectory({
  players,
  selfId,
  viewerRating,
  cap = LOBBY_DIRECTORY_CAP,
}: DirectoryOrderingInput): DirectoryOrderingOutput {
  const self = players.find((p) => p.id === selfId);
  const others = players.filter((p) => p.id !== selfId);
  const sorted = [...others].sort((a, b) => rank(a, b, viewerRating));
  const visibleOthersBudget = self ? Math.max(0, cap - 1) : cap;
  const visibleOthers = sorted.slice(0, visibleOthersBudget);
  const hidden = sorted.slice(visibleOthersBudget);
  const visible = self ? [self, ...visibleOthers] : visibleOthers;
  return { visible, hidden };
}
