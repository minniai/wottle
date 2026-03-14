import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { SettingsPanel } from "@/components/ui/SettingsPanel";
import { SENSORY_PREFERENCES_DEFAULT } from "@/lib/types/preferences";

describe("SettingsPanel", () => {
  it("renders Sound Effects and Haptic Feedback toggle controls", () => {
    render(
      <SettingsPanel
        preferences={SENSORY_PREFERENCES_DEFAULT}
        setSoundEnabled={vi.fn()}
        setHapticsEnabled={vi.fn()}
      />,
    );

    expect(screen.getByText(/sound effects/i)).toBeInTheDocument();
    expect(screen.getByText(/haptic feedback/i)).toBeInTheDocument();
  });

  it("calls setSoundEnabled when Sound Effects toggle is clicked", () => {
    const setSoundEnabled = vi.fn();

    render(
      <SettingsPanel
        preferences={{ soundEnabled: true, hapticsEnabled: true }}
        setSoundEnabled={setSoundEnabled}
        setHapticsEnabled={vi.fn()}
      />,
    );

    const soundToggle = screen.getByRole("switch", { name: /sound effects/i });
    fireEvent.click(soundToggle);

    expect(setSoundEnabled).toHaveBeenCalledWith(false);
  });

  it("calls setHapticsEnabled when Haptic Feedback toggle is clicked", () => {
    const setHapticsEnabled = vi.fn();

    render(
      <SettingsPanel
        preferences={{ soundEnabled: true, hapticsEnabled: true }}
        setSoundEnabled={vi.fn()}
        setHapticsEnabled={setHapticsEnabled}
      />,
    );

    const hapticsToggle = screen.getByRole("switch", { name: /haptic feedback/i });
    fireEvent.click(hapticsToggle);

    expect(setHapticsEnabled).toHaveBeenCalledWith(false);
  });

  it("reflects the current preference state in toggle checked state", () => {
    render(
      <SettingsPanel
        preferences={{ soundEnabled: false, hapticsEnabled: true }}
        setSoundEnabled={vi.fn()}
        setHapticsEnabled={vi.fn()}
      />,
    );

    const soundToggle = screen.getByRole("switch", { name: /sound effects/i });
    const hapticsToggle = screen.getByRole("switch", { name: /haptic feedback/i });

    expect(soundToggle).toHaveAttribute("aria-checked", "false");
    expect(hapticsToggle).toHaveAttribute("aria-checked", "true");
  });
});
