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
    <header className="lobby-hero-halo relative space-y-6 pt-10 sm:pt-16">
      <div className="space-y-3">
        <p className="font-display text-xs uppercase tracking-[0.4em] text-accent-focus/80">
          ORÐUSTA
        </p>
        <h1 className="font-display text-6xl font-bold leading-none tracking-tight text-text-primary sm:text-7xl md:text-8xl">
          Wottle
        </h1>
        <p className="max-w-xl text-base text-text-secondary sm:text-lg">
          The Icelandic word duel. Swap two tiles, build words your opponent
          can&apos;t take back, and outrun the chess clock.
        </p>
      </div>
      <div
        data-testid="lobby-hero-motif"
        aria-hidden="true"
        className="flex flex-wrap gap-2 sm:gap-3"
      >
        {currentWord.letters.map((letter, i) => (
          <span
            key={`${wordIndex}-${i}`}
            className={`lobby-hero-tile lobby-hero-cascade inline-flex h-12 w-12 items-center justify-center rounded-lg font-display text-2xl font-bold text-text-inverse sm:h-14 sm:w-14 sm:text-3xl md:h-16 md:w-16 md:text-4xl ${
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
