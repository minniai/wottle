import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { DisconnectionModal } from "@/components/match/DisconnectionModal";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const WINDOW_MS = 90_000;

function renderModal(
  overrides: Partial<React.ComponentProps<typeof DisconnectionModal>> = {},
) {
  const baseTime = Date.now();
  return render(
    <DisconnectionModal
      opponentDisplayName="Birna"
      disconnectedAt={overrides.disconnectedAt ?? baseTime}
      windowMs={overrides.windowMs ?? WINDOW_MS}
      onClose={overrides.onClose ?? vi.fn()}
      onClaimWin={overrides.onClaimWin ?? vi.fn()}
      isClaiming={overrides.isClaiming ?? false}
    />,
  );
}

describe("DisconnectionModal", () => {
  test("renders opponent name + Connection lost eyebrow", () => {
    renderModal();
    expect(screen.getByText(/Connection lost/i)).toBeInTheDocument();
    expect(screen.getByText(/Birna dropped out/i)).toBeInTheDocument();
  });

  test("shows countdown starting near 90 seconds", () => {
    renderModal();
    expect(screen.getByText(/1:30/)).toBeInTheDocument();
  });

  test("Claim win is disabled while countdown has remaining time", () => {
    renderModal();
    const btn = screen.getByRole("button", { name: /Claim win/i });
    expect(btn).toBeDisabled();
  });

  test("Claim win becomes enabled after the window elapses", () => {
    renderModal();
    const btn = screen.getByRole("button", { name: /Claim win/i });
    expect(btn).toBeDisabled();
    // Advance 91 seconds to ensure the countdown hits 0.
    act(() => {
      vi.advanceTimersByTime(91_000);
    });
    expect(btn).not.toBeDisabled();
  });

  test("Claim win click invokes onClaimWin", () => {
    const onClaimWin = vi.fn();
    renderModal({
      disconnectedAt: Date.now() - WINDOW_MS - 1_000, // already expired
      onClaimWin,
    });
    fireEvent.click(screen.getByRole("button", { name: /Claim win/i }));
    expect(onClaimWin).toHaveBeenCalledTimes(1);
  });

  test("Keep waiting click invokes onClose", () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByRole("button", { name: /Keep waiting/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("Claim win button shows spinner copy while isClaiming", () => {
    renderModal({
      disconnectedAt: Date.now() - WINDOW_MS - 1_000,
      isClaiming: true,
    });
    expect(screen.getByRole("button", { name: /Claiming/i })).toBeDisabled();
  });
});
