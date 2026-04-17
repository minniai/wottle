import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { PlayerIdentity } from "@/lib/types/match";

const startQueueMock = vi.fn();
const pushMock = vi.fn();

const mockStoreState: {
  players: PlayerIdentity[];
  updateSelfStatus: (...args: unknown[]) => void;
} = {
  players: [],
  updateSelfStatus: vi.fn(),
};

vi.mock("@/app/actions/matchmaking/startQueue", () => ({
  startQueueAction: (...args: unknown[]) => startQueueMock(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/matchmaking/presenceStore", () => ({
  useLobbyPresenceStore: (selector: (s: typeof mockStoreState) => unknown) =>
    selector(mockStoreState),
}));

import { PlayNowCard } from "@/components/lobby/PlayNowCard";

const SELF: PlayerIdentity = {
  id: "me",
  username: "me",
  displayName: "Me",
  status: "available",
  lastSeenAt: new Date().toISOString(),
  eloRating: 1200,
};

function seedSelf(status: PlayerIdentity["status"] = "available") {
  mockStoreState.players = [{ ...SELF, status }];
}

beforeEach(() => {
  mockStoreState.players = [];
  mockStoreState.updateSelfStatus = vi.fn();
  startQueueMock.mockReset();
  pushMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PlayNowCard", () => {
  test("Ranked is pre-selected on mount", () => {
    render(<PlayNowCard currentPlayer={SELF} />);
    expect(
      screen.getByTestId("mode-pill-ranked").getAttribute("aria-pressed"),
    ).toBe("true");
  });

  test("Casual and Challenge are aria-disabled with Coming soon copy", () => {
    render(<PlayNowCard currentPlayer={SELF} />);
    const casual = screen.getByTestId("mode-pill-casual");
    const challenge = screen.getByTestId("mode-pill-challenge");
    expect(casual.getAttribute("aria-disabled")).toBe("true");
    expect(challenge.getAttribute("aria-disabled")).toBe("true");
    expect(casual.textContent?.toLowerCase()).toContain("coming soon");
    expect(challenge.textContent?.toLowerCase()).toContain("coming soon");
  });

  test("idle-available: Play Now button is enabled and carries legacy test id", () => {
    render(<PlayNowCard currentPlayer={SELF} />);
    const btn = screen.getByTestId("matchmaker-start-button");
    expect(btn).not.toBeDisabled();
    expect(btn.textContent?.toLowerCase()).toContain("play now");
  });

  test("queuing: after activation shows status region with legacy test id and elapsed readout", async () => {
    startQueueMock.mockResolvedValue({ status: "queued" });
    render(<PlayNowCard currentPlayer={SELF} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("matchmaker-start-button"));
    });
    expect(screen.getByTestId("matchmaker-queue-status")).toBeInTheDocument();
    expect(screen.getByTestId("matchmaker-queue-status").textContent).toMatch(
      /elapsed/i,
    );
  });

  test("cancelable: cancel control clears the queue state", async () => {
    startQueueMock.mockResolvedValue({ status: "queued" });
    render(<PlayNowCard currentPlayer={SELF} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("matchmaker-start-button"));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    });
    expect(screen.queryByTestId("matchmaker-queue-status")).toBeNull();
    expect(screen.getByTestId("matchmaker-start-button")).toBeInTheDocument();
  });

  test("disabled-while-in-match: Play Now is disabled with accessible explanation", () => {
    seedSelf("in_match");
    render(<PlayNowCard currentPlayer={SELF} />);
    const btn = screen.getByTestId("matchmaker-start-button");
    expect(btn).toBeDisabled();
    expect(btn.getAttribute("aria-label")?.toLowerCase()).toContain("already");
  });
});
