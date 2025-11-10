import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { MoveFeedback, type MoveFeedbackDetails } from "../../../../components/game/MoveFeedback";

describe("MoveFeedback component", () => {
  test("renders nothing when feedback is null", () => {
    render(<MoveFeedback feedback={null} />);

    expect(screen.queryByTestId("move-feedback-toast")).toBeNull();

    const liveRegion = screen.getByTestId("move-feedback-live-region");
    expect(liveRegion).toHaveAttribute("aria-live", "polite");
  });

  test("renders success feedback with polite live region", () => {
    const feedback: MoveFeedbackDetails = {
      id: "success-1",
      variant: "success",
      message: "Swap accepted",
    };

    render(<MoveFeedback feedback={feedback} />);

    const toast = screen.getByTestId("move-feedback-toast");

    expect(toast).toHaveAttribute("role", "status");
    expect(toast).toHaveAttribute("aria-live", "polite");
    expect(toast).toHaveTextContent("Swap accepted");
    expect(toast).toHaveAttribute("data-variant", "success");
  });

  test("focuses the toast when feedback changes", async () => {
    const { rerender } = render(<MoveFeedback feedback={null} />);

    const success: MoveFeedbackDetails = {
      id: "success-1",
      variant: "success",
      message: "Swap accepted",
    };

    rerender(<MoveFeedback feedback={success} />);

    const successToast = await screen.findByTestId("move-feedback-toast");

    await waitFor(() => expect(successToast).toHaveFocus());

    const error: MoveFeedbackDetails = {
      id: "error-1",
      variant: "error",
      message: "Network error while submitting swap. Please try again.",
    };

    rerender(<MoveFeedback feedback={error} />);

    const errorToast = await screen.findByTestId("move-feedback-toast");

    expect(errorToast).toHaveAttribute("role", "alert");
    expect(errorToast).toHaveAttribute("aria-live", "assertive");
    await waitFor(() => expect(errorToast).toHaveFocus());
  });

  test("calls onDismiss when the dismiss button is activated", () => {
    const handleDismiss = vi.fn();

    const feedback: MoveFeedbackDetails = {
      id: "success-2",
      variant: "success",
      message: "Swap accepted",
    };

    render(<MoveFeedback feedback={feedback} onDismiss={handleDismiss} />);

    const dismissButton = screen.getByRole("button", { name: /dismiss move feedback/i });
    fireEvent.click(dismissButton);

    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });
});
