"use client";

import type { SensoryPreferences } from "@/lib/types/preferences";

interface SettingsPanelProps {
  preferences: SensoryPreferences;
  setSoundEnabled: (enabled: boolean) => void;
  setHapticsEnabled: (enabled: boolean) => void;
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4"
      style={{ padding: "12px 0" }}
    >
      <span className="text-sm text-ink-3">{label}</span>
      <button
        type="button"
        role="switch"
        aria-label={label}
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
        style={{ backgroundColor: checked ? "#10b981" : "rgba(255,255,255,0.2)" }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform"
          style={{ transform: checked ? "translateX(1.25rem)" : "translateX(0)" }}
        />
      </button>
    </div>
  );
}

export function SettingsPanel({
  preferences,
  setSoundEnabled,
  setHapticsEnabled,
}: SettingsPanelProps) {
  return (
    <div
      className="w-64 rounded-2xl border border-hair shadow-2xl bg-paper"
      style={{ padding: "20px 24px" }}
      role="dialog"
      aria-label="Settings"
    >
      <h2
        className="text-sm font-semibold uppercase tracking-wider text-ink-soft"
        style={{ marginBottom: "8px" }}
      >
        Settings
      </h2>
      <Toggle
        label="Sound Effects"
        checked={preferences.soundEnabled}
        onChange={setSoundEnabled}
      />
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />
      <Toggle
        label="Haptic Feedback"
        checked={preferences.hapticsEnabled}
        onChange={setHapticsEnabled}
      />
    </div>
  );
}
