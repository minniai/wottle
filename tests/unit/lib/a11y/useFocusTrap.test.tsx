import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useRef, useState } from "react";

import { useFocusTrap } from "@/lib/a11y/useFocusTrap";

function TrapHarness({
  active,
  onEscape,
}: {
  active: boolean;
  onEscape?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap({
    isActive: active,
    containerRef,
    onEscape,
  });

  return (
    <div>
      <button data-testid="before">Outside</button>
      <div ref={containerRef} data-testid="trap">
        <button data-testid="first">First</button>
        <button data-testid="second">Second</button>
      </div>
      <button data-testid="after">Outside 2</button>
    </div>
  );
}

function ToggleHarness({ onEscape }: { onEscape?: () => void }) {
  const [active, setActive] = useState(false);
  return (
    <>
      <button
        data-testid="toggle"
        onClick={() => setActive((prev) => !prev)}
        type="button"
      >
        Toggle
      </button>
      <TrapHarness active={active} onEscape={onEscape} />
    </>
  );
}

describe("useFocusTrap", () => {
  it("focuses the first focusable element when activated", () => {
    const { getByTestId } = render(<TrapHarness active onEscape={vi.fn()} />);
    expect(document.activeElement).toBe(getByTestId("first"));
  });

  it("wraps focus when tabbing forward and backward", () => {
    const { getByTestId } = render(<TrapHarness active />);
    const first = getByTestId("first");
    const second = getByTestId("second");

    second.focus();
    fireEvent.keyDown(second, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(second);
  });

  it("invokes the escape handler when pressing Escape", () => {
    const onEscape = vi.fn();
    const { getByTestId } = render(<TrapHarness active onEscape={onEscape} />);
    const first = getByTestId("first");
    fireEvent.keyDown(first, { key: "Escape" });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("restores focus to the previously focused element when deactivated", () => {
    const { getByTestId } = render(<ToggleHarness />);
    const toggle = getByTestId("toggle");
    const before = getByTestId("before");

    before.focus();
    act(() => {
      fireEvent.click(toggle);
    });
    expect(document.activeElement).toBe(getByTestId("first"));

    act(() => {
      fireEvent.click(toggle);
    });
    expect(document.activeElement).toBe(before);
  });
});


