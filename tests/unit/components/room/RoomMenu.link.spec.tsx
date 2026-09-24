import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const MATCH_PATH = "/en/match/0b8f2a1c-3d4e-4f5a-8b6c-7d8e9f0a1b2c";
vi.mock("next/navigation", () => ({ usePathname: () => MATCH_PATH }));

import { RoomMenu } from "@/components/room/RoomMenu";

/** Spec 072 T082 (FR-060, FR-063): the rules know the match they came from; review copies its link. */
describe("RoomMenu · rules and the review link", () => {
  const writeText = vi.fn(async () => undefined);
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens the rules in a new tab that knows its match", () => {
    render(<RoomMenu variant="match" onAction={vi.fn()} />);
    fireEvent.click(screen.getByTestId("ledger-menu-trigger"));
    expect(screen.getByTestId("ledger-menu-item-howToPlay")).toHaveAttribute("href", `/en/rules?from=${encodeURIComponent(MATCH_PATH)}`);
    expect(screen.queryByTestId("ledger-menu-item-copyLink")).toBeNull();
  });

  it("copies the review's link from a finished match, and says so for 2s", () => {
    render(<RoomMenu variant="final" onAction={vi.fn()} />);
    fireEvent.click(screen.getByTestId("ledger-menu-trigger"));
    fireEvent.click(screen.getByTestId("ledger-menu-item-copyLink"));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}${MATCH_PATH}?review=last`);
    expect(screen.getByTestId("ledger-menu-item-copyLink")).toHaveTextContent("link copied");
    act(() => void vi.advanceTimersByTime(2_100));
    expect(screen.getByTestId("ledger-menu-item-copyLink")).toHaveTextContent("copy link ▸");
  });
});
