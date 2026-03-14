"use client";

import { useState, useCallback } from "react";
import {
  type SensoryPreferences,
  SENSORY_PREFERENCES_DEFAULT,
  SENSORY_PREFS_STORAGE_KEY,
} from "@/lib/types/preferences";

function readFromStorage(): SensoryPreferences {
  if (typeof window === "undefined") {
    return SENSORY_PREFERENCES_DEFAULT;
  }
  try {
    const raw = localStorage.getItem(SENSORY_PREFS_STORAGE_KEY);
    if (!raw) return SENSORY_PREFERENCES_DEFAULT;
    return { ...SENSORY_PREFERENCES_DEFAULT, ...JSON.parse(raw) };
  } catch {
    return SENSORY_PREFERENCES_DEFAULT;
  }
}

function writeToStorage(prefs: SensoryPreferences): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SENSORY_PREFS_STORAGE_KEY, JSON.stringify(prefs));
}

export function useSensoryPreferences(): {
  preferences: SensoryPreferences;
  setSoundEnabled: (enabled: boolean) => void;
  setHapticsEnabled: (enabled: boolean) => void;
} {
  const [preferences, setPreferences] = useState<SensoryPreferences>(readFromStorage);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    setPreferences((prev) => {
      const next = { ...prev, soundEnabled: enabled };
      writeToStorage(next);
      return next;
    });
  }, []);

  const setHapticsEnabled = useCallback((enabled: boolean) => {
    setPreferences((prev) => {
      const next = { ...prev, hapticsEnabled: enabled };
      writeToStorage(next);
      return next;
    });
  }, []);

  return { preferences, setSoundEnabled, setHapticsEnabled };
}
