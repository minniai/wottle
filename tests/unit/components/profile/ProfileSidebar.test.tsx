import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ProfileSidebar } from "@/components/profile/ProfileSidebar";
import type { PlayerProfile } from "@/lib/types/match";

const BASE: PlayerProfile = {
  identity: {
    id: "p1",
    username: "ari",
    displayName: "Ari",
    avatarUrl: null,
    status: "available",
    lastSeenAt: "2026-04-22T00:00:00Z",
    createdAt: "2025-03-10T08:00:00Z",
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

describe("ProfileSidebar (self)", () => {
  test("renders avatar, eyebrow, display name, handle", () => {
    render(<ProfileSidebar profile={BASE} isSelf />);
    expect(screen.getByTestId("profile-sidebar")).toBeInTheDocument();
    expect(screen.getByText("Your profile")).toBeInTheDocument();
    expect(screen.getByText("Ari")).toBeInTheDocument();
    expect(screen.getByText(/@ari · member since Mar 2025/)).toBeInTheDocument();
  });

  test("renders rating card with ELO", () => {
    render(<ProfileSidebar profile={BASE} isSelf />);
    expect(screen.getByTestId("rating-card")).toHaveTextContent("1,234");
  });

  test("omits `member since` when createdAt is missing", () => {
    const profile: PlayerProfile = {
      ...BASE,
      identity: { ...BASE.identity, createdAt: undefined },
    };
    render(<ProfileSidebar profile={profile} isSelf />);
    expect(screen.queryByText(/member since/i)).not.toBeInTheDocument();
    expect(screen.getByText(/@ari/)).toBeInTheDocument();
  });

  test("shows today's rating delta when history includes today", () => {
    const today = new Date().toISOString().slice(0, 10);
    const profile: PlayerProfile = {
      ...BASE,
      ratingHistory: [
        { recordedAt: "2026-04-10T12:00:00Z", rating: 1210 },
        { recordedAt: `${today}T09:00:00Z`, rating: 1234 },
      ],
    };
    render(<ProfileSidebar profile={profile} isSelf />);
    expect(screen.getByTestId("today-delta")).toHaveTextContent("+24 TODAY");
  });

  test("hides today delta when no entries fall on today", () => {
    render(<ProfileSidebar profile={BASE} isSelf />);
    expect(screen.queryByTestId("today-delta")).not.toBeInTheDocument();
  });

  test("renders Play now + Edit profile CTAs", () => {
    render(<ProfileSidebar profile={BASE} isSelf />);
    const playNow = screen.getByTestId("play-now-cta");
    expect(playNow).toHaveAttribute("href", "/matchmaking?mode=ranked");
    expect(screen.getByRole("button", { name: /edit profile/i })).toBeDisabled();
  });
});

describe("ProfileSidebar (other)", () => {
  test("renders Player profile eyebrow and Challenge CTA", () => {
    render(<ProfileSidebar profile={BASE} isSelf={false} />);
    expect(screen.getByText("Player profile")).toBeInTheDocument();
    const challenge = screen.getByTestId("challenge-cta");
    expect(challenge).toHaveTextContent("Challenge @ari");
    expect(challenge).toHaveAttribute("href", "/lobby");
    expect(screen.queryByRole("button", { name: /edit profile/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId("play-now-cta")).not.toBeInTheDocument();
  });
});
