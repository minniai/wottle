export interface PlayerPreferences {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  /** Opt-in second-tap preview (spec 044, decision Q2). Default off. */
  previewEnabled: boolean;
}

/** @deprecated Use PlayerPreferences. Kept as an alias while callers migrate. */
export type SensoryPreferences = PlayerPreferences;

export const PLAYER_PREFERENCES_DEFAULT: PlayerPreferences = {
  soundEnabled: true,
  hapticsEnabled: true,
  previewEnabled: false,
};

/** @deprecated Use PLAYER_PREFERENCES_DEFAULT. */
export const SENSORY_PREFERENCES_DEFAULT = PLAYER_PREFERENCES_DEFAULT;

export const SENSORY_PREFS_STORAGE_KEY = "wottle-sensory-prefs" as const;
