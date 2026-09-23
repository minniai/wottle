import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { QueueRoomView } from "@/components/room/QueueRoomView";
import { copyEn } from "@/lib/i18n/copy/en";
import type { PlayerIdentity } from "@/lib/types/match";

const { CANCEL, FINDING_OPPONENT } = copyEn;

const me: PlayerIdentity = { id: "me", username: "birna", displayName: "Birna", status: "available", lastSeenAt: "", eloRating: 1204 };
const kari: PlayerIdentity = { id: "k", username: "kari", displayName: "Kári", status: "available", lastSeenAt: "", eloRating: 1191 };

const FIELD = <div data-testid="field-slot" />;

function view(overrides: Partial<Parameters<typeof QueueRoomView>[0]> = {}) {
  return (
    <QueueRoomView
      viewer={me}
      opponent={null}
      elapsed="0:07"
      live="setting the field · 58 of 100 letters"
      hint="searching · 0:07 · cancel ▸"
      onAction={vi.fn()}
      {...overrides}
    >
      {FIELD}
    </QueueRoomView>
  );
}

/**
 * The queue view is presentational, as `MatchRoomView` is: the fixture route
 * (spec 045 US1) mounts it for the `queue` and `searching-paused` phases from static data.
 * Polling, timers and the board swap stay in the controller.
 */
describe("QueueRoomView (spec 045 US1, FR-003)", () => {
  it("renders both bars, the field slot and the ledger from props alone", () => {
    render(view());
    expect(screen.getByTestId("room-slot-top")).toBeTruthy();
    expect(screen.getByTestId("field-slot")).toBeTruthy();
    expect(screen.getByTestId("room-slot-bottom")).toBeTruthy();
    expect(screen.getByTestId("room-slot-ledger")).toBeTruthy();
  });

  it("prints the queue's progress in a live row, above the hint", () => {
    render(view());
    expect(screen.getByTestId("ledger-live-row")).toHaveTextContent("setting the field · 58 of 100 letters");
    expect(screen.getByTestId("ledger-hint")).toHaveTextContent("searching · 0:07 · cancel ▸");
  });

  it("searching: the top bar hunts and offers cancel", () => {
    render(view());
    expect(screen.getByText(FINDING_OPPONENT)).toBeTruthy();
    expect(screen.getByTestId("player-bar-action-cancel").textContent).toContain(CANCEL);
  });

  it("a paused search says so in the top bar with its own action (spec 069 FR-021)", () => {
    render(view({ search: { name: FINDING_OPPONENT, subline: "search paused", action: <button type="button" data-testid="queue-resume">resume ▸</button> } }));
    expect(screen.getByTestId("player-bar-top")).toHaveTextContent("search paused");
    expect(screen.getByTestId("queue-resume")).toBeTruthy();
    expect(screen.queryByTestId("player-bar-action-cancel")).toBeNull();
  });

  it("reports cancel to its parent rather than routing itself", () => {
    const onAction = vi.fn();
    render(view({ onAction }));
    fireEvent.click(screen.getByTestId("player-bar-action-cancel"));
    expect(onAction).toHaveBeenCalledWith("cancelQueue");
  });

  it("imports no store, transport, router or Server Action", () => {
    const src = readFileSync(resolve(__dirname, "../../../../components/room/QueueRoomView.tsx"), "utf8");
    for (const banned of ["roomStore", "next/navigation", "@/app/actions", "useMatchmaking", "MatchRoomController"]) {
      expect(src, `QueueRoomView must not import ${banned}`).not.toContain(banned);
    }
  });
});
