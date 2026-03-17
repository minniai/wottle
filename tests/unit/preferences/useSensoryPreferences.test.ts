import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useSensoryPreferences } from "@/lib/preferences/useSensoryPreferences";
import { SENSORY_PREFS_STORAGE_KEY, SENSORY_PREFERENCES_DEFAULT } from "@/lib/types/preferences";

// Provide a real localStorage-like store since jsdom's localStorage may be limited
const localStorageStore: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => localStorageStore[key] ?? null,
  setItem: (key: string, value: string) => { localStorageStore[key] = value; },
  removeItem: (key: string) => { delete localStorageStore[key]; },
};

describe("useSensoryPreferences", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", localStorageMock);
    delete localStorageStore[SENSORY_PREFS_STORAGE_KEY];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete localStorageStore[SENSORY_PREFS_STORAGE_KEY];
  });

  it("returns defaults when no localStorage entry exists", () => {
    const { result } = renderHook(() => useSensoryPreferences());

    expect(result.current.preferences.soundEnabled).toBe(true);
    expect(result.current.preferences.hapticsEnabled).toBe(true);
  });

  it("restores persisted preferences on mount", () => {
    localStorageStore[SENSORY_PREFS_STORAGE_KEY] = JSON.stringify({
      soundEnabled: false,
      hapticsEnabled: true,
    });

    const { result } = renderHook(() => useSensoryPreferences());

    expect(result.current.preferences.soundEnabled).toBe(false);
    expect(result.current.preferences.hapticsEnabled).toBe(true);
  });

  it("falls back to defaults when localStorage contains malformed JSON", () => {
    localStorageStore[SENSORY_PREFS_STORAGE_KEY] = "not-valid-json";

    const { result } = renderHook(() => useSensoryPreferences());

    expect(result.current.preferences).toEqual(SENSORY_PREFERENCES_DEFAULT);
  });

  it("persists soundEnabled change to localStorage", () => {
    const { result } = renderHook(() => useSensoryPreferences());

    act(() => {
      result.current.setSoundEnabled(false);
    });

    const stored = JSON.parse(localStorageStore[SENSORY_PREFS_STORAGE_KEY]);
    expect(stored.soundEnabled).toBe(false);
    expect(result.current.preferences.soundEnabled).toBe(false);
  });

  it("persists hapticsEnabled change to localStorage", () => {
    const { result } = renderHook(() => useSensoryPreferences());

    act(() => {
      result.current.setHapticsEnabled(false);
    });

    const stored = JSON.parse(localStorageStore[SENSORY_PREFS_STORAGE_KEY]);
    expect(stored.hapticsEnabled).toBe(false);
    expect(result.current.preferences.hapticsEnabled).toBe(false);
  });

  it("propagates changes immediately to all consumers via React state", () => {
    const { result } = renderHook(() => useSensoryPreferences());

    act(() => {
      result.current.setSoundEnabled(false);
    });

    expect(result.current.preferences.soundEnabled).toBe(false);
    expect(result.current.preferences.hapticsEnabled).toBe(true);
  });

  it("restores updated preferences after remount", () => {
    const { result, unmount } = renderHook(() => useSensoryPreferences());

    act(() => {
      result.current.setSoundEnabled(false);
      result.current.setHapticsEnabled(false);
    });

    unmount();

    const { result: result2 } = renderHook(() => useSensoryPreferences());
    expect(result2.current.preferences.soundEnabled).toBe(false);
    expect(result2.current.preferences.hapticsEnabled).toBe(false);
  });
});
