"use client";

import { create } from "zustand";

import {
  PLAYER_PREFERENCES_DEFAULT,
  SENSORY_PREFS_STORAGE_KEY,
  type PlayerPreferences,
} from "@/lib/types/preferences";

/**
 * One store for every player preference so the ⋯ menu, the field and the
 * sound/haptics hooks always agree (spec 044, R14). Persisted under the
 * pre-existing localStorage key; objects written by older builds lack
 * `previewEnabled` and read as `false` (decision Q2).
 */
interface PreferencesState extends PlayerPreferences {
  setSoundEnabled: (enabled: boolean) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setPreviewEnabled: (enabled: boolean) => void;
  /** Re-read storage (tests, or after a sign-in on another tab). */
  hydrate: () => void;
}

export function readStoredPreferences(): PlayerPreferences {
  if (typeof window === "undefined") return PLAYER_PREFERENCES_DEFAULT;
  try {
    const raw = window.localStorage.getItem(SENSORY_PREFS_STORAGE_KEY);
    if (!raw) return PLAYER_PREFERENCES_DEFAULT;
    return { ...PLAYER_PREFERENCES_DEFAULT, ...(JSON.parse(raw) as Partial<PlayerPreferences>) };
  } catch {
    return PLAYER_PREFERENCES_DEFAULT;
  }
}

function persist(prefs: PlayerPreferences): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SENSORY_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage may be unavailable (private mode); the in-memory store still works.
  }
}

function pick(state: PreferencesState): PlayerPreferences {
  return {
    soundEnabled: state.soundEnabled,
    hapticsEnabled: state.hapticsEnabled,
    previewEnabled: state.previewEnabled,
  };
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  ...readStoredPreferences(),
  setSoundEnabled: (soundEnabled) => {
    set({ soundEnabled });
    persist(pick(get()));
  },
  setHapticsEnabled: (hapticsEnabled) => {
    set({ hapticsEnabled });
    persist(pick(get()));
  },
  setPreviewEnabled: (previewEnabled) => {
    set({ previewEnabled });
    persist(pick(get()));
  },
  hydrate: () => set(readStoredPreferences()),
}));
