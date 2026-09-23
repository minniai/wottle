import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Room } from "@/components/room/Room";
import { RoomShell } from "@/components/room/RoomShell";
import { useRoomStore } from "@/lib/room/roomStore";

describe("Room", () => {
  beforeEach(() => useRoomStore.getState().leaveToLobby());

  it("renders the four slots in order: top bar, field, bottom bar, ledger", () => {
    render(<Room topBar={<span>TOP</span>} field={<span>FIELD</span>} bottomBar={<span>BOTTOM</span>} ledger={<span>LEDGER</span>} />);
    const room = screen.getByTestId("room");
    const order = ["room-slot-top", "room-slot-field", "room-slot-bottom", "room-slot-ledger"].map((id) =>
      Array.from(room.querySelectorAll("[data-testid]")).findIndex((el) => el.getAttribute("data-testid") === id),
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(screen.getByTestId("room-slot-field")).toHaveTextContent("FIELD");
  });

  it("under a scoreboard sizes the field in whole cells and says so for the stylesheet (spec 068)", () => {
    class RO {
      static instances: RO[] = [];
      cb: ResizeObserverCallback;
      constructor(cb: ResizeObserverCallback) {
        this.cb = cb;
        RO.instances.push(this);
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal("ResizeObserver", RO);
    render(<Room layout="scoreboard" topBar={<span>BOARD</span>} field={null} bottomBar={null} ledger={null} />);
    const room = screen.getByTestId("room");
    Object.defineProperty(room, "clientWidth", { value: 1440, configurable: true });
    Object.defineProperty(room, "clientHeight", { value: 900, configurable: true });
    act(() => RO.instances[0].cb([], RO.instances[0] as unknown as ResizeObserver));
    expect(room).toHaveAttribute("data-layout", "scoreboard");
    expect(room.style.getPropertyValue("--field-size")).toBe("713px");
    expect(room.style.getPropertyValue("--room-cell")).toBe("71px");
    // No bottom bar under a scoreboard: the slot is not drawn at all.
    expect(screen.queryByTestId("room-slot-bottom")).toBeNull();
    vi.unstubAllGlobals();
  });

  it("keeps the bars layout by default, with no whole-cell override", () => {
    render(<Room topBar={null} field={null} bottomBar={<span>B</span>} ledger={null} />);
    expect(screen.getByTestId("room")).toHaveAttribute("data-layout", "bars");
    expect(screen.getByTestId("room").style.getPropertyValue("--room-cell")).toBe("");
  });

  it("flags a small cell so the value numeral can hide (spec 045 decision 3)", () => {
    // A 310px field is a 31px cell, where the design's 18% numeral is 5.6px.
    class RO {
      static instances: RO[] = [];
      cb: ResizeObserverCallback;
      constructor(cb: ResizeObserverCallback) {
        this.cb = cb;
        RO.instances.push(this);
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal("ResizeObserver", RO);
    const sizes = [310, 720];
    for (const size of sizes) {
      RO.instances = [];
      const { unmount } = render(<Room topBar={null} field={null} bottomBar={null} ledger={null} />);
      const room = screen.getByTestId("room");
      Object.defineProperty(room, "clientWidth", { value: size, configurable: true });
      Object.defineProperty(room, "clientHeight", { value: 2000, configurable: true });
      act(() => RO.instances[0].cb([], RO.instances[0] as unknown as ResizeObserver));
      expect(screen.getByTestId("room-slot-field")).toHaveAttribute(
        "data-cell-size",
        size < 320 ? "small" : "regular",
      );
      unmount();
    }
    vi.unstubAllGlobals();
  });

  it("exposes the store phase as data-phase", () => {
    useRoomStore.getState().startQueue();
    render(<Room topBar={null} field={null} bottomBar={null} ledger={null} />);
    expect(screen.getByTestId("room")).toHaveAttribute("data-phase", "queue");
  });

  it("RoomShell seeds the viewer into the store", () => {
    const viewer = { id: "p1", username: "birna", displayName: "Birna", status: "available" as const, lastSeenAt: "2026-01-01T00:00:00Z" };
    render(
      <RoomShell viewer={viewer}>
        <span>child</span>
      </RoomShell>,
    );
    expect(screen.getByTestId("room-shell")).toHaveTextContent("child");
    expect(useRoomStore.getState().viewer?.id).toBe("p1");
  });
});
