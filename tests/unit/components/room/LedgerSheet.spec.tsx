import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LedgerSheet } from "@/components/room/LedgerSheet";

describe("LedgerSheet", () => {
  it("renders nothing when closed and its children when open", () => {
    const { rerender } = render(<LedgerSheet open={false} onClose={() => {}}><span>rows</span></LedgerSheet>);
    expect(screen.queryByTestId("ledger-sheet")).toBeNull();
    rerender(<LedgerSheet open onClose={() => {}}><span>rows</span></LedgerSheet>);
    expect(screen.getByTestId("ledger-sheet")).toHaveTextContent("rows");
  });

  it("closes from the close control and Escape", () => {
    const onClose = vi.fn();
    render(<LedgerSheet open onClose={onClose}><button>x</button></LedgerSheet>);
    fireEvent.click(screen.getByTestId("ledger-sheet-close"));
    fireEvent.keyDown(screen.getByTestId("ledger-sheet"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
