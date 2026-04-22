import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ProfileSidebar } from "@/components/profile/ProfileSidebar";
import type { PlayerProfile } from "@/lib/types/match";

const SAMPLE: PlayerProfile = {
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
    gamesPlayed: 5,
    wins: 3,
    losses: 1,
    draws: 1,
    winRate: 0.75,
  },
  ratingTrend: [1200, 1234],
  bestWord: null,
  form: [],
  peakRating: 1250,
  ratingHistory: [],
};

describe("ProfileSidebar", () => {
  test("renders avatar, name, handle, and rating", () => {
    render(<ProfileSidebar profile={SAMPLE} />);
    expect(screen.getByTestId("profile-sidebar")).toBeInTheDocument();
    expect(screen.getByText("Ari")).toBeInTheDocument();
    expect(screen.getByText(/@ari/)).toBeInTheDocument();
    expect(screen.getByText("1234")).toBeInTheDocument();
  });

  test("renders peak rating badge", () => {
    render(<ProfileSidebar profile={SAMPLE} />);
    expect(screen.getByText(/peak\s+1250/i)).toBeInTheDocument();
  });

  test("renders joined year from lastSeenAt", () => {
    render(<ProfileSidebar profile={SAMPLE} />);
    expect(screen.getByText(/joined\s+2025/i)).toBeInTheDocument();
  });
});
