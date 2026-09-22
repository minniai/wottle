import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/app/actions/auth/logout", () => ({ logoutAction: vi.fn().mockResolvedValue({ status: "ok" }) }));

import { ProfilePage } from "@/components/profile/ProfilePage";
import { ProfileRatingChart } from "@/components/profile/ProfileRatingChart";
import type { PlayerProfile } from "@/lib/types/match";

const profile: PlayerProfile = {
  identity: { id: "me", username: "birna", displayName: "Birna", status: "available", lastSeenAt: "", eloRating: 1204, createdAt: "2026-03-05T10:00:00Z" },
  stats: { eloRating: 1204, gamesPlayed: 14, wins: 8, losses: 5, draws: 1, winRate: 8 / 13 },
  ratingTrend: [1180, 1190, 1204],
  bestWord: { word: "skáldskapur", points: 61 },
  form: ["W", "L", "W"],
  peakRating: 1210,
  ratingHistory: [
    { recordedAt: new Date(Date.now() - 20 * 86_400_000).toISOString(), rating: 1180 },
    { recordedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(), rating: 1204 },
  ],
};
const words = [{ word: "skáldskapur", points: 61, opponentName: "Kári" }, { word: "borða", points: 24, opponentName: "Elín" }];
const matches = [{ matchId: "m1", result: "win" as const, opponentId: "k", opponentUsername: "kari", opponentDisplayName: "Kári", yourScore: 170, opponentScore: 127, wordsFound: 10, completedAt: "" }];

describe("ProfilePage (design system Fig. 9, spec 044 US10)", () => {
  it("own profile: teal seat, identity row, rating with peak and weekly change, record row", () => {
    render(<ProfilePage profile={profile} words={words} matches={matches} isSelf />);
    expect(screen.getByTestId("profile-page")).toHaveAttribute("data-seat", "you");
    expect(screen.getByTestId("profile-identity")).toHaveTextContent("Birna");
    expect(screen.getByTestId("profile-handle")).toHaveTextContent("@birna · playing since march 2026 · 14 matches");
    expect(screen.getByTestId("profile-rating")).toHaveTextContent("1204");
    expect(screen.getByTestId("profile-identity")).toHaveTextContent("rating · peak 1210 · +24 this week");
    const record = screen.getByTestId("profile-record");
    expect(record).toHaveTextContent("8");
    expect(record).toHaveTextContent("won");
    expect(record).toHaveTextContent("62%");
    expect(record).toHaveTextContent("win rate");
  });

  it("right column: best words with points and vs opponent; recent matches link to the final room", () => {
    render(<ProfilePage profile={profile} words={words} matches={matches} isSelf />);
    const best = screen.getAllByTestId("profile-best-word");
    expect(best[0]).toHaveTextContent("skáldskapur");
    expect(best[0]).toHaveTextContent("61");
    expect(best[0]).toHaveTextContent("vs Kári");
    const match = screen.getByTestId("profile-recent-match");
    expect(match).toHaveAttribute("role", "row");
    expect(match.tagName).not.toBe("A");
    expect(match.querySelector("a")).toHaveAttribute("href", "/en/match/m1");
    expect(match).toHaveTextContent("170–127");
  });

  it("table semantics: every role=table holds role=row children and every row holds cells (axe)", () => {
    render(<ProfilePage profile={profile} words={[]} matches={[]} isSelf />);
    for (const table of screen.getAllByRole("table")) {
      const rows = table.querySelectorAll(':scope > [role="row"]');
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) expect(row.querySelector('[role="cell"]')).not.toBeNull();
      expect(table.querySelector(':scope > [role="cell"]')).toBeNull();
    }
  });

  it("foot: ◂ lobby, and change name · sign out only for the owner", () => {
    const { rerender } = render(<ProfilePage profile={profile} words={[]} matches={[]} isSelf />);
    expect(screen.getByTestId("profile-back-lobby")).toHaveAttribute("href", "/en/lobby");
    expect(screen.getByTestId("profile-change-name")).toBeInTheDocument();
    expect(screen.getByTestId("profile-sign-out")).toBeInTheDocument();
    rerender(<ProfilePage profile={profile} words={[]} matches={[]} isSelf={false} />);
    expect(screen.getByTestId("profile-page")).toHaveAttribute("data-seat", "opp");
    expect(screen.queryByTestId("profile-sign-out")).toBeNull();
    expect(screen.getByTestId("profile-best-words")).toHaveTextContent("—");
  });
});

/**
 * Spec 045 B9 (FR-038). `preserveAspectRatio="none"` on a fixed 600x180 viewBox
 * stretches everything the SVG draws — including the mono axis labels — at any
 * other aspect. The chart measures its container instead.
 */
describe("ProfileRatingChart labels (spec 045 B9)", () => {
  class RO {
    static instances: RO[] = [];
    cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb;
      RO.instances.push(this);
    }
    observe() {}
    disconnect() {}
    unobserve() {}
  }

  beforeEach(() => {
    RO.instances = [];
    vi.stubGlobal("ResizeObserver", RO);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const history = [1188, 1204, 1216].map((rating, i) => ({
    rating,
    recordedAt: `2026-09-0${i + 1}T12:00:00.000Z`,
  }));

  it("never stretches what it draws", () => {
    render(<ProfileRatingChart history={history} seat="you" />);
    expect(screen.getByTestId("profile-rating-chart")).toHaveAttribute("preserveAspectRatio", "xMinYMin meet");
  });

  it("takes its coordinate width from the container, so one unit is one pixel", () => {
    const { container } = render(<ProfileRatingChart history={history} seat="you" />);
    const wrapper = container.querySelector(".profile-chart__frame")!;
    Object.defineProperty(wrapper, "clientWidth", { value: 420, configurable: true });
    act(() => RO.instances[0].cb([], RO.instances[0] as unknown as ResizeObserver));

    expect(screen.getByTestId("profile-rating-chart")).toHaveAttribute("viewBox", "0 0 420 180");
  });
});
