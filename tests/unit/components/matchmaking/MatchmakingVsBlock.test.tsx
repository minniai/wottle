import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { MatchmakingVsBlock } from "@/components/matchmaking/MatchmakingVsBlock";
import type { PlayerIdentity } from "@/lib/types/match";

const SELF: PlayerIdentity = {
  id: "self",
  username: "ari",
  displayName: "Ari",
  avatarUrl: null,
  status: "matchmaking",
  lastSeenAt: new Date().toISOString(),
  eloRating: 1234,
};

const OPPONENT: PlayerIdentity = {
  id: "opp",
  username: "birna",
  displayName: "Birna",
  avatarUrl: null,
  status: "matchmaking",
  lastSeenAt: new Date().toISOString(),
  eloRating: 1198,
};

describe("MatchmakingVsBlock", () => {
  test("renders both display names and ratings", () => {
    render(
      <MatchmakingVsBlock self={SELF} opponent={OPPONENT} phase="found" />,
    );
    expect(screen.getByText("Ari")).toBeInTheDocument();
    expect(screen.getByText("Birna")).toBeInTheDocument();
    expect(screen.getByText("1234")).toBeInTheDocument();
    expect(screen.getByText("1198")).toBeInTheDocument();
  });

  test("uses 'Opponent found' eyebrow + 'Both players ready.' subtitle for phase=found", () => {
    render(
      <MatchmakingVsBlock self={SELF} opponent={OPPONENT} phase="found" />,
    );
    expect(screen.getByText(/Opponent found/i)).toBeInTheDocument();
    expect(screen.getByText(/Both players ready\./i)).toBeInTheDocument();
  });

  test("uses 'Starting match…' eyebrow + assigning-roles subtitle for phase=starting", () => {
    render(
      <MatchmakingVsBlock self={SELF} opponent={OPPONENT} phase="starting" />,
    );
    expect(screen.getByText(/Starting match…/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Assigning roles · generating board…/i),
    ).toBeInTheDocument();
  });
});
