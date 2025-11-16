const truthyValues = new Set(["1", "true", "on", "yes", "enabled"]);

function readFlag(name: string, fallback = false): boolean {
  const raw = process.env[name]?.toLowerCase();
  if (!raw) return fallback;
  return truthyValues.has(raw);
}

export const featureFlags = {
  playtestLobby: readFlag("NEXT_PUBLIC_ENABLE_PLAYTEST_LOBBY", false),
  playtestMatchView: readFlag("NEXT_PUBLIC_ENABLE_PLAYTEST_MATCH", false),
};

export const isPlaytestUiEnabled = (): boolean =>
  featureFlags.playtestLobby || featureFlags.playtestMatchView;
