import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { Lobby, type LobbyProps } from "@/components/page/lobby/Lobby";
import type { FormGame, LobbyRow } from "@/lib/types/standing";

const row = (n: number, name: string, rating: number, state: LobbyRow["state"] = "here", record: LobbyRow["record"] = null): LobbyRow => ({
  playerId: `00000000-0000-4000-8000-00000000000${n}`,
  displayName: name,
  handle: name.toLowerCase(),
  rating,
  state,
  movesPlayed: state === "in_match" ? 6 : null,
  record,
});

const FORM: FormGame[] = (["W", "W", "L", "W", "L", "W", "W", "L", "W", "W"] as const).map((result, i) => ({
  matchId: `m${i}`,
  result,
  opponent: i === 9 ? "Kári" : "Embla",
  you: 100 + i,
  them: 90,
  completedAt: new Date(Date.now() - 86_400_000).toISOString(),
}));

const BASE: LobbyProps = {
  viewer: { displayName: "Birna", handle: "birna", rating: 1212, gamesPlayed: 35, wins: 20, losses: 15, draws: 0 },
  rows: [row(1, "Embla", 1242, "here", { wins: 1, losses: 0, draws: 0 }), row(2, "Kári", 1179, "here", { wins: 3, losses: 1, draws: 0 }), row(3, "Jónas", 1163, "in_match")],
  overview: {
    counts: { here: 5, searching: 2, playersInMatch: 1, matchesOn: 1, other: { language: "en", here: 7 } },
    lastMatch: { matchId: "5d2c1c1e-8d0e-4b8e-9d5e-2d8f1d0c7a11", opponent: "Kári", you: 134, them: 88, durationMs: 292_000, completedAt: new Date(Date.now() - 86_400_000).toISOString(), youWon: true, bands: [{ tiles: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], seat: "you" }], board: [["S", "K", "Y", ...Array.from({ length: 7 }, () => "A")], ...Array.from({ length: 9 }, () => Array.from({ length: 10 }, () => "E"))] },
    form: FORM,
  },
  recent: [
    { matchId: "5d2c1c1e-8d0e-4b8e-9d5e-2d8f1d0c7a11", result: "win", opponentId: "k", opponentUsername: "kári", opponentDisplayName: "Kári", yourScore: 134, opponentScore: 88, wordsFound: 10, completedAt: new Date().toISOString() },
    { matchId: "m2", result: "loss", opponentId: "e", opponentUsername: "embla", opponentDisplayName: "Embla", yourScore: 150, opponentScore: 171, wordsFound: 9, completedAt: new Date().toISOString() },
  ],
  onFind: vi.fn(),
  onSend: vi.fn(async () => ({ status: "sent" as const, inviteId: "i" })),
};

function renderLobby(locale: "is" | "en", props: Partial<LobbyProps> = {}) {
  return render(
    <LocaleProvider locale={locale}>
      <Lobby {...BASE} {...props} />
    </LocaleProvider>,
  );
}

/** Spec 070 US2 (T050): the lobby page's content. */
describe("Lobby", () => {
  it("names you in the one h1, with your rating, language, matches and record", () => {
    renderLobby("is");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Birna");
    expect(document.querySelector(".lobby-block__sub")!.textContent).toBe("1212 · elo · íslenska · 35 viðureignir · 20–15–0");
  });

  it("puts find an opponent in the block, with how many are searching", () => {
    renderLobby("en");
    fireEvent.click(screen.getByRole("button", { name: "find an opponent ▸" }));
    expect(BASE.onFind).toHaveBeenCalled();
    expect(screen.getByText("2 searching now")).toBeTruthy();
  });

  it("draws your last matches as links, oldest first, the letter carrying the meaning", () => {
    renderLobby("is");
    const strip = screen.getByRole("list", { name: "síðustu 30: 7 sigrar, 3 töp" });
    expect(screen.getByText("síðustu 30")).toBeTruthy();
    const cells = within(strip).getAllByRole("link");
    expect(cells).toHaveLength(10);
    expect(cells.filter((c) => c.textContent === "S")).toHaveLength(7);
    expect(cells[9].getAttribute("aria-label")).toBe("sigur · Kári · 109–90 · í gær");
    expect(cells[9].getAttribute("href")).toBe("/match/m9?review=last");
  });

  it("opens a card with the opponent, score and date on hover or focus, and closes it on Escape", () => {
    renderLobby("en");
    const cell = within(screen.getByRole("list", { name: /^last 30/ })).getAllByRole("link")[9];
    expect(document.querySelector(".form-run__tip")).toBeNull();
    fireEvent.mouseEnter(cell);
    const tip = document.querySelector(".form-run__tip")!;
    expect(tip.textContent).toContain("Kári");
    expect(tip.textContent).toContain("109–90");
    expect(tip.textContent).toContain("yesterday · win");
    fireEvent.mouseLeave(cell);
    expect(document.querySelector(".form-run__tip")).toBeNull();
    fireEvent.focus(cell);
    expect(document.querySelector(".form-run__tip")).not.toBeNull();
    fireEvent.keyDown(cell, { key: "Escape" });
    expect(document.querySelector(".form-run__tip")).toBeNull();
  });

  it("lists who is here in a table, with record, status and a challenge labelled name first", () => {
    renderLobby("en");
    const table = screen.getByRole("table");
    expect(within(table).getByRole("columnheader", { name: "your record" })).toBeTruthy();
    expect(screen.getByText("2 players connected · 1 playing")).toBeTruthy();
    expect(within(table).getByText("3–1")).toBeTruthy();
    expect(within(table).getByRole("button", { name: "Kári · challenge" })).toBeTruthy();
    expect(within(table).getByText("in a match · 6 of 10")).toBeTruthy();
    expect(within(table).queryByRole("button", { name: "Jónas · challenge" })).toBeNull();
    expect(within(table).getByRole("link", { name: /Kári/ }).getAttribute("href")).toBe("/en/profile/k%C3%A1ri");
  });

  it("lists your last matches under one heading: the latest drawn as its board, the rest as rows without it", () => {
    renderLobby("en");
    const link = screen.getByRole("link", { name: "review your last match" });
    expect(link.getAttribute("href")).toBe("/en/match/5d2c1c1e-8d0e-4b8e-9d5e-2d8f1d0c7a11?review=last");
    expect(within(link).getByRole("img", { name: "Birna 134, Kári 88, yesterday" })).toBeTruthy();
    expect(screen.getByTestId("last-match-verdict").textContent).toBe("Birna wins 134–88");
    expect(screen.getAllByRole("heading", { name: "last matches" })).toHaveLength(1);
    expect(screen.queryByText("your last matches")).toBeNull();
    const rows = document.querySelectorAll(".last-match .recent__row");
    expect([...rows].map((r) => r.querySelector(".recent__name")!.textContent)).toEqual(["Embla"]);
  });

  it("links each opponent in the rows to their profile", () => {
    renderLobby("en");
    const name = document.querySelector(".last-match .recent__row .recent__name")!;
    expect(name.tagName).toBe("A");
    expect(name.getAttribute("href")).toBe("/en/profile/embla");
  });

  it("draws the final board's letters on the map, a scored letter in its owner's colour", () => {
    renderLobby("en");
    const letters = document.querySelectorAll(".band-map__letter");
    expect(letters).toHaveLength(100);
    expect(letters[0].textContent).toBe("S");
    expect(letters[0].getAttribute("class")).toContain("band-map__letter--you");
    expect(letters[3].getAttribute("class")).not.toContain("--you");
  });

  it("shows a new player the first-match state", () => {
    renderLobby("en", { viewer: { ...BASE.viewer, gamesPlayed: 0, wins: 0, losses: 0, rating: 1200 }, overview: { ...BASE.overview, lastMatch: null, form: [] }, recent: [] });
    expect(document.querySelector(".lobby-block__sub")!.textContent).toBe("1200 · rating · english · no matches yet");
    expect(screen.getByText("Your first match will show here.")).toBeTruthy();
    expect(screen.queryByTestId("rules-figure-swap")).toBeNull();
    expect(document.querySelector(".last-match--first .field")).toBeNull();
  });

  it("in an empty lobby says so, keeps find as the primary and offers to tell you when someone comes", () => {
    renderLobby("en", { rows: [] });
    expect(screen.getByText("No one else is here.")).toBeTruthy();
    expect(screen.getByText("you will be paired as soon as someone arrives")).toBeTruthy();
    expect(screen.getByRole("button", { name: "find an opponent ▸" }).className).toContain("action-primary");
  });

  it("shows eight rows, then the rest on request", () => {
    const many = Array.from({ length: 11 }, (_, i) => row(i, `P${i}`, 1200 + i));
    renderLobby("en", { rows: many });
    expect(screen.getAllByTestId("lobby-row")).toHaveLength(8);
    fireEvent.click(screen.getByRole("button", { name: "+ 3 more ▸" }));
    expect(screen.getAllByTestId("lobby-row")).toHaveLength(11);
  });
});
