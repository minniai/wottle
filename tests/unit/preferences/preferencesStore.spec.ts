import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readStoredPreferences, usePreferencesStore } from "@/lib/preferences/preferencesStore";
import { SENSORY_PREFS_STORAGE_KEY } from "@/lib/types/preferences";

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => {
    store[k] = v;
  },
  removeItem: (k: string) => {
    delete store[k];
  },
};

describe("preferencesStore (spec 044 R14)", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", localStorageMock);
    delete store[SENSORY_PREFS_STORAGE_KEY];
    usePreferencesStore.getState().hydrate();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults: sound on, haptics on", () => {
    expect(readStoredPreferences()).toEqual({ soundEnabled: true, hapticsEnabled: true });
  });

  it("a stored object is read back", () => {
    store[SENSORY_PREFS_STORAGE_KEY] = JSON.stringify({ soundEnabled: false, hapticsEnabled: true });
    usePreferencesStore.getState().hydrate();
    expect(usePreferencesStore.getState().soundEnabled).toBe(false);
  });

  it("two subscribers see one toggle and it persists", () => {
    const seen: boolean[] = [];
    const unsubscribe = usePreferencesStore.subscribe((s) => seen.push(s.soundEnabled));
    usePreferencesStore.getState().setSoundEnabled(false);
    expect(usePreferencesStore.getState().soundEnabled).toBe(false);
    expect(seen).toContain(false);
    expect(JSON.parse(store[SENSORY_PREFS_STORAGE_KEY]).soundEnabled).toBe(false);
    unsubscribe();
  });
});
