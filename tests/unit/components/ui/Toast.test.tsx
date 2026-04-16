import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { Toast, type ToastMessage } from "@/components/ui/Toast";
import { ToastProvider, useToast } from "@/components/ui/ToastProvider";

const baseMessage: ToastMessage = {
  id: "m1",
  tone: "success",
  title: "Hello",
  autoDismissMs: 4000,
};

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("renders role=status for success tone", () => {
    render(<Toast message={baseMessage} onDismiss={() => {}} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  test("renders role=alert for error tone", () => {
    render(
      <Toast
        message={{ ...baseMessage, tone: "error" }}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  test("auto-dismisses after autoDismissMs", () => {
    const onDismiss = vi.fn();
    render(<Toast message={baseMessage} onDismiss={onDismiss} />);
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  test("exposes a manual dismiss button", () => {
    const onDismiss = vi.fn();
    render(<Toast message={baseMessage} onDismiss={onDismiss} />);
    screen.getByRole("button", { name: /dismiss/i }).click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

function Enqueuer() {
  const { enqueue } = useToast();
  return (
    <button
      type="button"
      onClick={() => enqueue({ tone: "success", title: "Queued!" })}
    >
      fire
    </button>
  );
}

describe("ToastProvider", () => {
  test("useToast enqueues a toast visible in the DOM", () => {
    render(
      <ToastProvider>
        <Enqueuer />
      </ToastProvider>,
    );
    act(() => {
      screen.getByText("fire").click();
    });
    expect(screen.getByText("Queued!")).toBeInTheDocument();
  });
});
