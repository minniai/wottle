// Stub for the getPlayerProfile Server Action. There is no Wottle backend in
// Claude Design, so PlayerProfileModal resolves to a realistic sample profile
// instead of hanging in its loading state.
import type { PlayerProfile } from "@/lib/types/match";

export interface GetPlayerProfileResult {
  status: "ok" | "not_found" | "error";
  profile?: PlayerProfile;
  error?: string;
}

const SAMPLE_PROFILE: PlayerProfile = {
  identity: {
    id: "00000000-0000-4000-8000-000000000001",
    username: "birna",
    displayName: "Birna Jónsdóttir",
    avatarUrl: null,
    status: "available",
    lastSeenAt: new Date().toISOString(),
    eloRating: 1245,
    createdAt: "2026-05-01T12:00:00.000Z",
  },
  stats: {
    eloRating: 1245,
    gamesPlayed: 42,
    wins: 24,
    losses: 15,
    draws: 3,
    winRate: 24 / 39,
  },
  ratingTrend: [1198, 1210, 1224, 1232, 1245],
  bestWord: { word: "SKÁLDSKAPUR", points: 74 },
  form: ["W", "W", "L", "W", "D", "L", "W", "W", "L", "W"],
  peakRating: 1261,
  ratingHistory: [
    { recordedAt: "2026-06-01T18:00:00.000Z", rating: 1150 },
    { recordedAt: "2026-06-14T18:00:00.000Z", rating: 1183 },
    { recordedAt: "2026-07-02T18:00:00.000Z", rating: 1198 },
    { recordedAt: "2026-07-19T18:00:00.000Z", rating: 1224 },
    { recordedAt: "2026-08-10T18:00:00.000Z", rating: 1245 },
  ],
};

export async function getPlayerProfile(
  _playerId: string,
): Promise<GetPlayerProfileResult> {
  return { status: "ok", profile: SAMPLE_PROFILE };
}
