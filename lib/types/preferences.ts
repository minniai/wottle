export interface PlayerPreferences {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
}

/** @deprecated Use PlayerPreferences. Kept as an alias while callers migrate. */
export type SensoryPreferences = PlayerPreferences;

export const PLAYER_PREFERENCES_DEFAULT: PlayerPreferences = {
  soundEnabled: true,
  hapticsEnabled: true,
};

/** @deprecated Use PLAYER_PREFERENCES_DEFAULT. */
export const SENSORY_PREFERENCES_DEFAULT = PLAYER_PREFERENCES_DEFAULT;

export const SENSORY_PREFS_STORAGE_KEY = "wottle-sensory-prefs" as const;
