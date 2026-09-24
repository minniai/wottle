import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { Slip } from "@/components/room/Slip";
import { outranks, slipPrecedence, type SlipState } from "@/lib/room/slip";

const LEAVE: SlipState = { kind: "leave", move: 4, limit: 10, clockMs: 192_000 };

/** Spec 070 US8 (T101): the leave slip ranks below resign, above the table's, and never resigns. */
describe("the leave slip", () => {
  it("ranks match over > end early > resign > leave > ready or void", () => {
    expect(slipPrecedence("resign")).toBeGreaterThan(slipPrecedence("leave"));
    expect(slipPrecedence("leave")).toBeGreaterThan(slipPrecedence("ready"));
    expect(slipPrecedence("leave")).toBeGreaterThan(slipPrecedence("void"));
    expect(outranks({ kind: "resign", move: 4, clockMs: 1, opponentName: "K" }, LEAVE)).toBe(true);
  });

  it("says the clock keeps running and focuses stay; going to the lobby is the secondary", () => {
    render(
      <LocaleProvider locale="en">
        <Slip slip={LEAVE} onAction={vi.fn()} />
      </LocaleProvider>,
    );
    expect(screen.getByText("move 4 of 10 · 3:12 left")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Leave the match?" })).toBeTruthy();
    expect(screen.getByText("the clock keeps running · you can come back")).toBeTruthy();
    expect(screen.getByText("each unplayed move costs up to 5 at 0:00")).toBeTruthy();
    expect(screen.getByRole("button", { name: "stay ▸" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "go to the lobby" })).toBeTruthy();
    expect(screen.queryByText(/resign/i)).toBeNull();
  });

  it("writes Icelandic", () => {
    render(
      <LocaleProvider locale="is">
        <Slip slip={LEAVE} onAction={vi.fn()} />
      </LocaleProvider>,
    );
    expect(screen.getByRole("heading", { name: "Fara úr viðureigninni?" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "vera áfram ▸" })).toBeTruthy();
    expect(screen.getByText("leikur 4 af 10 · 3:12 eftir")).toBeTruthy();
  });
});
