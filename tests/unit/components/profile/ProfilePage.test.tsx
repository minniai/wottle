import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/components/profile/ProfileSidebar", () => ({
  ProfileSidebar: () => <div data-testid="stub-sidebar" />,
}));
vi.mock("@/components/profile/ProfileRatingChart", () => ({
  ProfileRatingChart: () => <div data-testid="stub-chart" />,
}));
vi.mock("@/components/profile/ProfileWordCloud", () => ({
  ProfileWordCloud: () => <div data-testid="stub-cloud" />,
}));
vi.mock("@/components/profile/ProfileMatchHistoryList", () => ({
  ProfileMatchHistoryList: () => <div data-testid="stub-matches" />,
}));

import { ProfilePage } from "@/components/profile/ProfilePage";
import type { PlayerProfile } from "@/lib/types/match";

const PROFILE = {
  identity: {
    id: "p1",
    username: "ari",
    displayName: "Ari",
    avatarUrl: null,
    status: "available",
    lastSeenAt: "2025-09-01T00:00:00Z",
    eloRating: 1234,
  },
  stats: {
    eloRating: 1234,
    gamesPlayed: 9,
    wins: 5,
    losses: 3,
    draws: 1,
    winRate: 5 / 8,
  },
  ratingTrend: [1200, 1234],
  bestWord: null,
  form: [],
  peakRating: 1250,
  ratingHistory: [],
} as PlayerProfile;

describe("ProfilePage", () => {
  test("mounts sidebar + chart + cloud + matches", () => {
    render(<ProfilePage profile={PROFILE} words={[]} matches={[]} />);
    expect(screen.getByTestId("profile-page")).toBeInTheDocument();
    expect(screen.getByTestId("stub-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("stub-chart")).toBeInTheDocument();
    expect(screen.getByTestId("stub-cloud")).toBeInTheDocument();
    expect(screen.getByTestId("stub-matches")).toBeInTheDocument();
  });

  test("renders at-a-glance stats grid with win-rate percentage", () => {
    render(<ProfilePage profile={PROFILE} words={[]} matches={[]} />);
    expect(screen.getByText(/63%|62%/)).toBeInTheDocument(); // 5/8 = 62.5% rounds to 63
    expect(screen.getByText("9")).toBeInTheDocument(); // games played
    expect(screen.getByText("5")).toBeInTheDocument(); // wins
    expect(screen.getByText("1250")).toBeInTheDocument(); // peak rating
  });
});
