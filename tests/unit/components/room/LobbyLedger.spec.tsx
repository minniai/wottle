import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LobbyLedger } from "@/components/room/LobbyLedger";
import type { PlayerIdentity } from "@/lib/types/match";

const me: PlayerIdentity = { id: "me", username: "birna", displayName: "Birna", status: "available", lastSeenAt: "", eloRating: 1204 };
const players: PlayerIdentity[] = [
  me,
  { id: "k", username: "kari", displayName: "Kári", status: "available", lastSeenAt: "", eloRating: 1191 },
  { id: "e", username: "elin", displayName: "Elín", status: "in_match", lastSeenAt: "", eloRating: 1300 },
];

describe("LobbyLedger (design system §5.6)", () => {
  it("here now: other players with rating, ± versus you, and challenge ▸ (not for players in a match)", () => {
    const onAction = vi.fn();
    render(<LobbyLedger players={players} viewer={me} recentGames={[]} onAction={onAction} />);
    const rows = screen.getAllByTestId("ledger-here-now-row");
    expect(rows).toHaveLength(2);
    expect(screen.getByRole("link", { name: /Kári/ })).toHaveAttribute("href", "/en/profile/kari");
    expect(screen.getByRole("link", { name: /Elín/ })).toHaveAttribute("href", "/en/profile/elin");
    expect(rows[0]).toHaveTextContent("Kári");
    expect(rows[0]).toHaveTextContent("1191");
    expect(rows[0]).toHaveTextContent("-13");
    fireEvent.click(screen.getByTestId("ledger-challenge-k"));
    expect(onAction).toHaveBeenCalledWith({ challenge: "k" });
    expect(screen.queryByTestId("ledger-challenge-e")).toBeNull();
    expect(rows[1]).toHaveTextContent("in a match");
  });

  it("shows — while loading and when nobody else is here; recent matches list opponent, score and result", () => {
    const { rerender } = render(<LobbyLedger players={[me]} viewer={me} recentGames={null} loadingPlayers onAction={() => {}} />);
    expect(screen.getByTestId("ledger-here-now")).toHaveTextContent("—");
    expect(screen.getByTestId("ledger-last-matches")).toHaveTextContent("—");
    // Every role=row has at least one role=cell (axe aria-required-children).
    for (const row of screen.getAllByRole("row")) expect(row.querySelector('[role="cell"]')).not.toBeNull();
    rerender(<LobbyLedger players={[me]} viewer={me} recentGames={[{ matchId: "m", result: "win", opponentId: "k", opponentUsername: "kari", opponentDisplayName: "Kári", yourScore: 170, opponentScore: 127, wordsFound: 10, completedAt: "" }]} onAction={() => {}} />);
    expect(screen.getByTestId("ledger-here-now-empty")).toBeInTheDocument();
    expect(screen.getByTestId("ledger-last-match-row")).toHaveTextContent("Kári");
    expect(screen.getByRole("link", { name: "Kári" })).toHaveAttribute("href", "/en/profile/kari");
    expect(screen.getByTestId("ledger-last-match-row")).toHaveTextContent("170–127");
  });

  it("signed out: no challenge buttons and no recent matches table", () => {
    render(<LobbyLedger players={players} viewer={null} recentGames={null} onAction={() => {}} />);
    expect(screen.queryByTestId("ledger-challenge-k")).toBeNull();
    expect(screen.queryByTestId("ledger-last-matches")).toBeNull();
  });

  it("a player's name opens their profile: here now and your last matches", () => {
    const game = { matchId: "m1", result: "win" as const, opponentId: "k", opponentUsername: "kari", opponentDisplayName: "Kári", yourScore: 40, opponentScore: 30, wordsFound: 0, completedAt: "" };
    render(<LobbyLedger players={players} viewer={me} recentGames={[game]} onAction={() => {}} />);
    expect(screen.getAllByTestId("ledger-here-now-row")[0].querySelector("a")).toHaveAttribute("href", "/en/profile/kari");
    expect(screen.getByTestId("ledger-last-match-row").querySelector("a")).toHaveAttribute("href", "/en/profile/kari");
  });
});

