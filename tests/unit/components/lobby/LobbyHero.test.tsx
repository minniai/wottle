import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { LobbyHero } from "@/components/lobby/LobbyHero";
import { HERO_WORDS } from "@/lib/lobby/heroWords";

function firstWordText(): string {
  return HERO_WORDS[0]!.letters.join("");
}

function secondWordText(): string {
  return HERO_WORDS[1]!.letters.join("");
}

function installMatchMedia(prefersReducedMotion: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql = {
    matches: prefersReducedMotion,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: (
      _event: "change",
      listener: (e: MediaQueryListEvent) => void,
    ) => listeners.add(listener),
    removeEventListener: (
      _event: "change",
      listener: (e: MediaQueryListEvent) => void,
    ) => listeners.delete(listener),
    dispatchEvent: () => true,
    addListener: () => {},
    removeListener: () => {},
  };
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation(() => mql),
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("LobbyHero", () => {
  test("renders the Wottle wordmark with display font class", () => {
    installMatchMedia(false);
    render(<LobbyHero />);
    const wordmark = screen.getByText("Wottle");
    expect(wordmark.className).toContain("font-display");
  });

  test("surfaces ORÐUSTA as the Icelandic counterpart", () => {
    installMatchMedia(false);
    render(<LobbyHero />);
    expect(screen.getByText("ORÐUSTA")).toBeInTheDocument();
    expect(screen.getByText(/Icelandic word duel/i)).toBeInTheDocument();
  });

  test("renders the first hero word in the tile motif", () => {
    installMatchMedia(false);
    render(<LobbyHero />);
    const motif = screen.getByTestId("lobby-hero-motif");
    expect(motif.textContent).toContain(firstWordText());
  });

  test("advances to the next hero word after HERO_WORD_CYCLE_MS", async () => {
    installMatchMedia(false);
    render(<LobbyHero />);
    const motif = screen.getByTestId("lobby-hero-motif");
    expect(motif.textContent).toContain(firstWordText());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(motif.textContent).toContain(secondWordText());
  });

  test("does not cycle words under prefers-reduced-motion: reduce", async () => {
    installMatchMedia(true);
    render(<LobbyHero />);
    const motif = screen.getByTestId("lobby-hero-motif");
    expect(motif.textContent).toContain(firstWordText());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(motif.textContent).toContain(firstWordText());
    expect(motif.textContent).not.toContain(secondWordText());
  });
});
