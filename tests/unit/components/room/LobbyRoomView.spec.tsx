import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LobbyRoomView } from "@/components/room/LobbyRoomView";
import { NO_OPPONENT, FIND_OPPONENT } from "@/lib/constants/copy";
import type { PlayerIdentity } from "@/lib/types/match";

const me: PlayerIdentity = { id: "me", username: "birna", displayName: "Birna", status: "available", lastSeenAt: "", eloRating: 1204 };
const kari: PlayerIdentity = { id: "k", username: "kari", displayName: "Kári", status: "available", lastSeenAt: "", eloRating: 1191 };

const FIELD = <div data-testid="field-slot" />;

function view(overrides: Partial<Parameters<typeof LobbyRoomView>[0]> = {}) {
  return (
    <LobbyRoomView
      viewer={me}
      players={[me, kari]}
      recentGames={null}
      loadingPlayers={false}
      hint="tap a second letter"
      notices={[]}
      onAction={vi.fn()}
      onSignedIn={vi.fn()}
      {...overrides}
    >
      {FIELD}
    </LobbyRoomView>
  );
}

/**
 * The lobby view is presentational, as `MatchRoomView` is: the fixture route
 * (spec 045 US1) mounts it from static data, so a screenshot of the fixture is
 * evidence about the live room. State, transport and timers stay in the controller.
 */
describe("LobbyRoomView (spec 045 US1, FR-003)", () => {
  it("renders both bars, the field slot and the ledger from props alone", () => {
    render(view());
    expect(screen.getByTestId("room-slot-top")).toBeTruthy();
    expect(screen.getByTestId("field-slot")).toBeTruthy();
    expect(screen.getByTestId("room-slot-bottom")).toBeTruthy();
    expect(screen.getByTestId("room-slot-ledger")).toBeTruthy();
  });

  it("shows the empty opponent bar with the find-an-opponent action", () => {
    render(view());
    expect(screen.getByText(NO_OPPONENT)).toBeTruthy();
    expect(screen.getByTestId("player-bar-action-find").textContent).toContain(FIND_OPPONENT);
  });

  it("captions the ledger with the count of other players, not including the viewer", () => {
    render(view());
    expect(screen.getByTestId("ledger-caption").textContent).toContain("1");
  });

  // Spec 048 US4: signed out, the bars are empty and carry no action; the slip holds the input.
  it("signed out: the bottom bar says sign in to set the field; no find-an-opponent action; no input in a bar", () => {
    render(view({ viewer: null }));
    const bottom = screen.getByTestId("room-slot-bottom");
    expect(bottom.textContent).not.toContain("Birna");
    expect(bottom.textContent).toContain("sign in to set the field");
    expect(bottom.querySelector('[data-testid="name-input-form"]')).toBeNull();
    expect(screen.queryByTestId("player-bar-action-find")).toBeNull();
  });

  it("reports the find-an-opponent action to its parent rather than routing itself", () => {
    const onAction = vi.fn();
    render(view({ onAction }));
    fireEvent.click(screen.getByTestId("player-bar-action-find"));
    expect(onAction).toHaveBeenCalledWith("findOpponent");
  });

  it("imports no store, transport, router or Server Action", () => {
    const src = readFileSync(resolve(__dirname, "../../../../components/room/LobbyRoomView.tsx"), "utf8");
    for (const banned of ["roomStore", "presenceStore", "next/navigation", "@/app/actions", "useFieldInteraction", "useLobbyInvites"]) {
      expect(src, `LobbyRoomView must not import ${banned}`).not.toContain(banned);
    }
  });
});
