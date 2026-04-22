import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { PlayerProfile } from "@/lib/types/match";

const getPlayerProfileMock = vi.fn();
vi.mock("@/app/actions/player/getPlayerProfile", () => ({
  getPlayerProfile: (...args: unknown[]) => getPlayerProfileMock(...args),
}));

import { PlayerProfileModal } from "@/components/player/PlayerProfileModal";

const SAMPLE: PlayerProfile = {
  identity: {
    id: "p1",
    username: "ari",
    displayName: "Ari",
    avatarUrl: null,
    status: "available",
    lastSeenAt: new Date().toISOString(),
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
  ratingTrend: [1200, 1210, 1234],
  bestWord: { word: "KAFFI", points: 42 },
  form: ["W", "W", "L", "D", "W"],
  peakRating: 1250,
  ratingHistory: [
    { recordedAt: "2026-04-01T10:00:00Z", rating: 1200 },
    { recordedAt: "2026-04-02T10:00:00Z", rating: 1250 },
    { recordedAt: "2026-04-03T10:00:00Z", rating: 1234 },
  ],
};

beforeEach(() => {
  getPlayerProfileMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PlayerProfileModal", () => {
  test("renders stats, sparkline, form chips, and Challenge CTA for non-self", async () => {
    getPlayerProfileMock.mockResolvedValue({ status: "ok", profile: SAMPLE });
    render(
      <PlayerProfileModal
        playerId="p1"
        viewerId="p2"
        onClose={vi.fn()}
        onChallenge={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("player-profile-modal")).toBeInTheDocument(),
    );
    expect(screen.getByText("Ari")).toBeInTheDocument();
    expect(screen.getByText("@ari")).toBeInTheDocument();
    expect(screen.getByText("KAFFI")).toBeInTheDocument();
    expect(screen.getByTestId("profile-sparkline")).toBeInTheDocument();
    expect(screen.getByTestId("profile-form-chips")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Challenge Ari/i }),
    ).toBeInTheDocument();
  });

  test("swaps Challenge for Close when viewerId === playerId", async () => {
    getPlayerProfileMock.mockResolvedValue({ status: "ok", profile: SAMPLE });
    render(
      <PlayerProfileModal
        playerId="p1"
        viewerId="p1"
        onClose={vi.fn()}
        onChallenge={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText(/Your profile/i)).toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: /Challenge/i })).toBeNull();
    expect(screen.getByRole("button", { name: /Close/i })).toBeInTheDocument();
  });

  test("Challenge invokes onChallenge with playerId", async () => {
    getPlayerProfileMock.mockResolvedValue({ status: "ok", profile: SAMPLE });
    const onChallenge = vi.fn();
    render(
      <PlayerProfileModal
        playerId="p1"
        viewerId="p2"
        onClose={vi.fn()}
        onChallenge={onChallenge}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("player-profile-modal")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /Challenge Ari/i }));
    expect(onChallenge).toHaveBeenCalledWith("p1");
  });

  test("shows error state when getPlayerProfile fails", async () => {
    getPlayerProfileMock.mockResolvedValue({
      status: "error",
      error: "Database offline",
    });
    render(
      <PlayerProfileModal
        playerId="p1"
        viewerId="p2"
        onClose={vi.fn()}
        onChallenge={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByTestId("player-profile-modal-error"),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText(/Database offline/i)).toBeInTheDocument();
  });
});
