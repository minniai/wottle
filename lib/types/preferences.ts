export interface SensoryPreferences {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
}

export const SENSORY_PREFERENCES_DEFAULT: SensoryPreferences = {
  soundEnabled: true,
  hapticsEnabled: true,
};

export const SENSORY_PREFS_STORAGE_KEY = "wottle-sensory-prefs" as const;
