"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { HERO_WORD_CYCLE_MS } from "@/lib/constants/lobby";
import { HERO_WORDS } from "@/lib/lobby/heroWords";

const MEDIA_QUERY = "(prefers-reduced-motion: reduce)";

function subscribePrefersReducedMotion(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) {
    return () => {};
  }
  const mql = window.matchMedia(MEDIA_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function getPrefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }
  return window.matchMedia(MEDIA_QUERY).matches;
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribePrefersReducedMotion,
    getPrefersReducedMotion,
    () => false,
  );
}

export function LobbyHero() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % HERO_WORDS.length);
    }, HERO_WORD_CYCLE_MS);
    return () => clearInterval(interval);
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (typeof performance !== "undefined" && performance.mark) {
      performance.mark("lobby:lcp-candidate");
    }
  }, []);

  const currentWord = HERO_WORDS[wordIndex] ?? HERO_WORDS[0]!;

  return (
    <header className="space-y-4">
      <div className="space-y-1">
        <h1 className="font-display text-4xl font-bold text-text-primary sm:text-5xl">
          Wottle
        </h1>
        <p className="text-sm text-text-secondary">
          <span className="font-display text-base text-accent-focus">
            ORÐUSTA
          </span>{" "}
          — the Icelandic word duel. Swap tiles, find words, race the clock.
        </p>
      </div>
      <div
        data-testid="lobby-hero-motif"
        aria-hidden="true"
        className="flex flex-wrap gap-1.5"
      >
        {currentWord.letters.map((letter, i) => (
          <span
            key={`${wordIndex}-${i}`}
            className={`lobby-hero-tile lobby-hero-cascade inline-flex h-10 w-10 items-center justify-center rounded-md bg-surface-2 font-display text-lg font-semibold text-text-primary sm:h-12 sm:w-12 sm:text-xl ${
              prefersReducedMotion ? "" : "lobby-hero-tile--flipping"
            }`}
            style={
              prefersReducedMotion
                ? undefined
                : { animationDelay: `${i * 40}ms` }
            }
          >
            {letter}
          </span>
        ))}
      </div>
      <p className="sr-only" role="status">
        Current hero word: {currentWord.letters.join("")}
      </p>
    </header>
  );
}
