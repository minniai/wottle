import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useRoomHotkeys } from "@/components/room/hooks/useRoomHotkeys";
import type { LedgerAction } from "@/lib/room/ledgerTypes";

function Harness({ onAction }: { onAction: (action: LedgerAction) => void }) {
  useRoomHotkeys(onAction);
  return (
    <>
      <input data-testid="name" />
      <textarea data-testid="note" />
      <div contentEditable data-testid="rich" />
    </>
  );
}

/** Design system §9, spec 045 FR-026. */
describe("useRoomHotkeys", () => {
  const setup = () => {
    const onAction = vi.fn();
    render(<Harness onAction={onAction} />);
    return onAction;
  };

  it("? does nothing: the rules left the room (spec 048 US5)", () => {
    const onAction = setup();
    fireEvent.keyDown(document, { key: "?" });
    expect(onAction).not.toHaveBeenCalled();
  });

  it("m and M both toggle sound", () => {
    const onAction = setup();
    fireEvent.keyDown(document, { key: "m" });
    fireEvent.keyDown(document, { key: "M" });
    expect(onAction).toHaveBeenNthCalledWith(1, "toggleSound");
    expect(onAction).toHaveBeenNthCalledWith(2, "toggleSound");
  });

  it("ignores every other key", () => {
    const onAction = setup();
    for (const key of ["a", "Enter", "Escape", "1"]) fireEvent.keyDown(document, { key });
    expect(onAction).not.toHaveBeenCalled();
  });

  it("stays out of the way while a name is being typed", () => {
    const onAction = vi.fn();
    const { getByTestId } = render(<Harness onAction={onAction} />);
    for (const id of ["name", "note", "rich"]) {
      fireEvent.keyDown(getByTestId(id), { key: "m" });
      fireEvent.keyDown(getByTestId(id), { key: "?" });
    }
    expect(onAction).not.toHaveBeenCalled();
  });

  it("leaves browser and system shortcuts alone", () => {
    const onAction = setup();
    fireEvent.keyDown(document, { key: "m", metaKey: true });
    fireEvent.keyDown(document, { key: "m", ctrlKey: true });
    fireEvent.keyDown(document, { key: "m", altKey: true });
    expect(onAction).not.toHaveBeenCalled();
  });

  it("stops listening on unmount", () => {
    const onAction = vi.fn();
    const { unmount } = render(<Harness onAction={onAction} />);
    unmount();
    fireEvent.keyDown(document, { key: "m" });
    expect(onAction).not.toHaveBeenCalled();
  });
});
