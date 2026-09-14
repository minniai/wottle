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
  afterEach(() => vi.unstubAllGlobals());

  it("defaults: sound on, haptics on, preview off", () => {
    expect(readStoredPreferences()).toEqual({ soundEnabled: true, hapticsEnabled: true, previewEnabled: false });
  });

  it("a legacy stored object without previewEnabled reads as preview off", () => {
    store[SENSORY_PREFS_STORAGE_KEY] = JSON.stringify({ soundEnabled: false, hapticsEnabled: true });
    usePreferencesStore.getState().hydrate();
    const s = usePreferencesStore.getState();
    expect(s.soundEnabled).toBe(false);
    expect(s.previewEnabled).toBe(false);
  });

  it("two subscribers see one toggle and it persists", () => {
    const seen: boolean[] = [];
    const unsubscribe = usePreferencesStore.subscribe((s) => seen.push(s.previewEnabled));
    usePreferencesStore.getState().setPreviewEnabled(true);
    expect(usePreferencesStore.getState().previewEnabled).toBe(true);
    expect(seen).toContain(true);
    expect(JSON.parse(store[SENSORY_PREFS_STORAGE_KEY]).previewEnabled).toBe(true);
    unsubscribe();
  });
});
