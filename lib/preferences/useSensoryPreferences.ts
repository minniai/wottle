"use client";

import { useEffect } from "react";

import type { PlayerPreferences } from "@/lib/types/preferences";
import { usePreferencesStore } from "./preferencesStore";

/**
 * Thin selector over the shared preferences store (spec 044, R14). Every
 * consumer sees the same values, so a toggle in the ⋯ menu reaches the field
 * and the sound hooks immediately.
 */
export function useSensoryPreferences(): {
  preferences: PlayerPreferences;
  setSoundEnabled: (enabled: boolean) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setPreviewEnabled: (enabled: boolean) => void;
} {
  const soundEnabled = usePreferencesStore((s) => s.soundEnabled);
  const hapticsEnabled = usePreferencesStore((s) => s.hapticsEnabled);
  const previewEnabled = usePreferencesStore((s) => s.previewEnabled);
  const setSoundEnabled = usePreferencesStore((s) => s.setSoundEnabled);
  const setHapticsEnabled = usePreferencesStore((s) => s.setHapticsEnabled);
  const setPreviewEnabled = usePreferencesStore((s) => s.setPreviewEnabled);
  const hydrate = usePreferencesStore((s) => s.hydrate);

  // The store is created at module load, possibly before a test stubs
  // localStorage; re-read on mount so persisted values win.
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return {
    preferences: { soundEnabled, hapticsEnabled, previewEnabled },
    setSoundEnabled,
    setHapticsEnabled,
    setPreviewEnabled,
  };
}
