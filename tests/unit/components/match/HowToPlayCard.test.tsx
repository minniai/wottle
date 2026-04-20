import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { HowToPlayCard } from "@/components/match/HowToPlayCard";

describe("HowToPlayCard", () => {
  test("renders the 'How to play' eyebrow", () => {
    render(<HowToPlayCard />);
    expect(screen.getByText("How to play")).toBeInTheDocument();
  });

  test("renders an ordered list with four steps", () => {
    render(<HowToPlayCard />);
    const list = screen.getByRole("list");
    expect(list.tagName).toBe("OL");
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);
  });

  test("steps describe the swap-and-form-words flow", () => {
    render(<HowToPlayCard />);
    expect(screen.getByText(/Tap any unfrozen tile/i)).toBeInTheDocument();
    expect(screen.getByText(/Tap a second tile to swap/i)).toBeInTheDocument();
    expect(
      screen.getByText(/New 3\+ letter words in any direction score/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Claimed letters freeze in your color/i),
    ).toBeInTheDocument();
  });

  test("root has the wottle card styling", () => {
    render(<HowToPlayCard />);
    const card = screen.getByTestId("how-to-play-card");
    expect(card.className).toMatch(/bg-paper/);
    expect(card.className).toMatch(/border-hair/);
  });
});
