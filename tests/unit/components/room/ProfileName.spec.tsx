import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RoomProfilesProvider, SeatName } from "@/components/room/ProfileName";
import { Ledger } from "@/components/room/Ledger";
import { Slip } from "@/components/room/Slip";
import { EMPTY_TERRITORY, emptyRows, type LedgerModel } from "@/lib/room/ledgerTypes";
import type { SlipState } from "@/lib/room/slip";

vi.mock("@/app/actions/auth/login", () => ({ loginAction: vi.fn(async () => ({ status: "idle" })) }));

const PROFILES = { you: "/en/profile/birna", opp: "/en/profile/k%C3%A1ri" };
const LIVE = { ...PROFILES, newTab: true };
const OVER = { ...PROFILES, newTab: false };

const model: LedgerModel = { caption: "", rows: emptyRows(), territory: EMPTY_TERRITORY, hint: "" };

const READY: SlipState = {
  kind: "ready",
  model: {
    label: "opponent found · 0:14",
    headline: { name: "Kári", rating: 1187 },
    facts: "english words · 10 moves each · one 5:00 clock",
    stakes: null,
    seats: [
      { seat: "opp", name: "Kári", status: "on the way", seated: false },
      { seat: "you", name: "Birna · you", status: "ready", seated: true },
    ],
    actions: "ready+leave",
    drain: 0.7,
  },
};

const MATCH_OVER: SlipState = {
  kind: "matchOver",
  verdict: { winnerSeat: "opp", scoreLine: "Kári wins 170–127", detailLine: "by 43 points" },
  durationMmSs: "4:52",
  scores: { you: 127, opp: 170 },
  viewerName: "Birna",
  opponentName: "Kári",
  ratings: [
    { seat: "opp", name: "Kári", line: "1187 → 1199 · +12" },
    { seat: "you", name: "Birna · you", line: "1204 → 1192 · −12" },
  ],
  rematch: null,
  readOnly: false,
};

/** Every name in the match room is a way to that player's profile; a live match is never left. */
describe("a player's name in the room", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is plain text where the room knows no profile", () => {
    render(<SeatName seat="opp" name="Kári" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Kári")).toBeTruthy();
  });

  it("opens the profile in a new tab while the match is not over, and says so", () => {
    render(
      <RoomProfilesProvider value={LIVE}>
        <SeatName seat="opp" name="Kári" />
      </RoomProfilesProvider>,
    );
    const link = screen.getByRole("link", { name: "Kári, profile opens in a new tab" });
    expect(link).toHaveAttribute("href", PROFILES.opp);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener");
  });

  it("opens the profile in the same tab once the match is over", () => {
    render(
      <RoomProfilesProvider value={OVER}>
        <SeatName seat="you" name="Birna" />
      </RoomProfilesProvider>,
    );
    const link = screen.getByRole("link", { name: "Birna" });
    expect(link).toHaveAttribute("href", PROFILES.you);
    expect(link).not.toHaveAttribute("target");
  });

  it("links both names in the ledger's face-off header, not the `you` beside yours", () => {
    render(
      <RoomProfilesProvider value={LIVE}>
        <Ledger variant="match" model={model} viewerName="Birna" opponentName="Kári" onAction={() => {}} />
      </RoomProfilesProvider>,
    );
    const header = screen.getByTestId("ledger-header");
    const links = header.querySelectorAll("a");
    expect([...links].map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Birna", PROFILES.you],
      ["Kári", PROFILES.opp],
    ]);
  });

  it("links the table's opponent and both seats, in a new tab so the table is never left", () => {
    render(
      <RoomProfilesProvider value={LIVE}>
        <Slip slip={READY} onAction={() => {}} />
      </RoomProfilesProvider>,
    );
    const links = screen.getByTestId("slip").querySelectorAll("a");
    expect([...links].map((a) => [a.textContent, a.getAttribute("href"), a.getAttribute("target")])).toEqual([
      ["Kári", PROFILES.opp, "_blank"],
      ["Kári", PROFILES.opp, "_blank"],
      ["Birna · you", PROFILES.you, "_blank"],
    ]);
  });

  it("links both players' rating rows on the match-over slip", () => {
    render(
      <RoomProfilesProvider value={OVER}>
        <Slip slip={MATCH_OVER} onAction={() => {}} />
      </RoomProfilesProvider>,
    );
    const links = screen.getByTestId("slip-ratings").querySelectorAll("a");
    expect([...links].map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Kári", PROFILES.opp],
      ["Birna · you", PROFILES.you],
    ]);
  });

  it("on a slip, ignores a click in the 500ms after it appears (game flow §5.0)", () => {
    render(
      <RoomProfilesProvider value={OVER}>
        <Slip slip={MATCH_OVER} onAction={() => {}} />
      </RoomProfilesProvider>,
    );
    const link = screen.getByTestId("slip-ratings").querySelector("a")!;
    expect(fireEvent.click(link)).toBe(false);
    vi.advanceTimersByTime(500);
    expect(fireEvent.click(link)).toBe(true);
  });
});
