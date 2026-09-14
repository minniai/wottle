import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

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
