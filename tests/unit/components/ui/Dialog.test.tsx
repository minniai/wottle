import { act, fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, test, vi } from "vitest";

import { Dialog } from "@/components/ui/Dialog";

function Harness({
  initialOpen = false,
  onCloseSpy,
}: {
  initialOpen?: boolean;
  onCloseSpy?: () => void;
}) {
  const [open, setOpen] = useState(initialOpen);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        data-testid="trigger"
      >
        Open
      </button>
      <Dialog
        open={open}
        onClose={() => {
          onCloseSpy?.();
          setOpen(false);
        }}
        ariaLabelledBy="dlg-title"
      >
        <h2 id="dlg-title">Title</h2>
        <button type="button" data-testid="primary">
          Primary
        </button>
        <button type="button" data-testid="secondary">
          Secondary
        </button>
      </Dialog>
    </div>
  );
}

describe("Dialog", () => {
  test("does not render when closed", () => {
    render(<Harness />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("renders with role, aria-modal, and aria-labelledby when open", () => {
    render(<Harness initialOpen />);
    const dlg = screen.getByRole("dialog");
    expect(dlg.getAttribute("aria-modal")).toBe("true");
    expect(dlg.getAttribute("aria-labelledby")).toBe("dlg-title");
  });

  test("applies bottom-sheet data attribute by default", () => {
    render(<Harness initialOpen />);
    expect(screen.getByRole("dialog").getAttribute("data-bottom-sheet")).toBe(
      "true",
    );
  });

  test("Escape key invokes onClose (dialog unmounts)", () => {
    const spy = vi.fn();
    render(<Harness initialOpen onCloseSpy={spy} />);
    fireEvent.keyDown(screen.getByTestId("primary"), { key: "Escape" });
    expect(spy).toHaveBeenCalled();
  });

  test("backdrop click invokes onClose", async () => {
    render(<Harness initialOpen />);
    const backdrop = screen.getByTestId("dialog-backdrop");
    await act(async () => {
      backdrop.click();
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
