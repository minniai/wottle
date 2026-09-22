import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Slip } from "@/components/room/Slip";

vi.mock("@/app/actions/auth/login", () => ({ loginAction: vi.fn(async () => ({ status: "error", message: "That name is taken!" })) }));

describe("Slip · sign in (spec 048 US4)", () => {
  it("carries the wordmark, the tagline, the name input, play ▸, no account needed and the rules link", () => {
    render(<Slip slip={{ kind: "signIn" }} onAction={() => {}} />);
    const slip = screen.getByTestId("slip");
    expect(slip).toHaveAttribute("aria-label", "wottle");
    expect(slip.querySelector(".slip__wordmark")).toHaveTextContent("wottle");
    expect(slip).toHaveTextContent("two players · one field · Icelandic words");
    expect(screen.getByTestId("player-bar-name-input")).toHaveAttribute("aria-label", "your name");
    expect(screen.getByTestId("player-bar-action-play")).toHaveTextContent("play ▸");
    expect(slip).toHaveTextContent("no account needed");
    expect(screen.getByTestId("slip-how-to-play")).toHaveAttribute("href", "/en/rules");
    expect(screen.getByTestId("slip-how-to-play")).toHaveTextContent("new here · how to play ▸");
  });

  it("focuses the input first", () => {
    render(<Slip slip={{ kind: "signIn" }} onAction={() => {}} />);
    expect(document.activeElement).toBe(screen.getByTestId("player-bar-name-input"));
  });
});
