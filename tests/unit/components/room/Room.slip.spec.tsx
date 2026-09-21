import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { Room } from "@/components/room/Room";
import { useRoomStore } from "@/lib/room/roomStore";

describe("Room + slip (spec 048 FR-001)", () => {
  beforeEach(() => {
    useRoomStore.getState().leaveToLobby();
    useRoomStore.setState({ slip: null, slipDismissed: false });
  });

  it("renders nothing over the field when no slip is up", () => {
    render(<Room topBar={null} field={<span>FIELD</span>} bottomBar={null} ledger={null} />);
    expect(screen.queryByTestId("slip")).toBeNull();
    expect(screen.getByTestId("room-slot-field")).not.toHaveAttribute("data-slipped");
  });

  it("mounts the slip inside the field slot and marks the slot", () => {
    useRoomStore.getState().setSlip({ kind: "endEarly", opponentName: "Kári", opponentMoves: 8, clockMs: 72_000 });
    render(<Room topBar={null} field={<span>FIELD</span>} bottomBar={null} ledger={null} />);
    const slot = screen.getByTestId("room-slot-field");
    expect(slot).toHaveAttribute("data-slipped", "true");
    expect(slot).toContainElement(screen.getByTestId("slip"));
  });

  it("hides a dismissed slip without clearing it", () => {
    useRoomStore.getState().setSlip({ kind: "endEarly", opponentName: "Kári", opponentMoves: 8, clockMs: 72_000 });
    useRoomStore.getState().dismissSlip();
    render(<Room topBar={null} field={null} bottomBar={null} ledger={null} />);
    expect(screen.queryByTestId("slip")).toBeNull();
    expect(useRoomStore.getState().slip).not.toBeNull();
  });
});
