import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Slip } from "@/components/room/Slip";
import { useRoomStore } from "@/lib/room/roomStore";

vi.mock("@/app/actions/auth/login", () => ({ loginAction: vi.fn(async () => ({ status: "idle" })) }));
vi.mock("@/app/actions/auth/enterAsReturning", () => ({
  enterAsReturningAction: vi.fn(async () => ({ status: "success", player: { id: "p1", username: "birna", displayName: "Birna", status: "available", lastSeenAt: "" } })),
}));

import { enterAsReturningAction } from "@/app/actions/auth/enterAsReturning";

function returningAs(displayName: string, rating: number | null): void {
  useRoomStore.setState({ returning: { displayName, rating } });
}

describe("Slip · returning door (spec 067 US3, artboard DoorReturning)", () => {
  afterEach(() => {
    useRoomStore.setState({ returning: null });
    vi.clearAllMocks();
  });

  it("greets the browser's player by name, with their rating in this language, and offers one press back in", () => {
    returningAs("Birna", 1310);
    render(<Slip slip={{ kind: "signIn" }} onAction={() => {}} />);
    const slip = screen.getByTestId("slip");
    expect(slip).toHaveTextContent("welcome back");
    expect(screen.getByTestId("slip-returning-name")).toHaveTextContent("Birna");
    expect(slip.querySelector('.slip__square[data-seat="you"]')).not.toBeNull();
    expect(screen.getByTestId("slip-returning-line")).toHaveTextContent("1310 · english");
    expect(screen.getByTestId("slip-enter-returning")).toHaveTextContent("enter the lobby ▸");
    expect(screen.getByTestId("slip-use-another-name")).toHaveTextContent("not Birna? · use another name");
    expect(screen.queryByTestId("player-bar-name-input")).toBeNull();
  });

  it("shows only the language when the player has no rating in it", () => {
    returningAs("Birna", null);
    render(<Slip slip={{ kind: "signIn" }} onAction={() => {}} />);
    expect(screen.getByTestId("slip-returning-line")).toHaveTextContent(/^english$/);
  });

  it("focuses enter the lobby first", () => {
    returningAs("Birna", 1310);
    render(<Slip slip={{ kind: "signIn" }} onAction={() => {}} />);
    expect(document.activeElement).toBe(screen.getByTestId("slip-enter-returning"));
  });

  it("enters from the device key alone and hands the room its viewer", async () => {
    returningAs("Birna", 1310);
    const onSignedIn = vi.fn();
    render(<Slip slip={{ kind: "signIn" }} onAction={() => {}} onSignedIn={onSignedIn} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("slip-enter-returning"));
    });
    expect(enterAsReturningAction).toHaveBeenCalledWith("en");
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(expect.objectContaining({ id: "p1" })));
  });

  it("use another name shows the empty door with the name input", () => {
    returningAs("Birna", 1310);
    render(<Slip slip={{ kind: "signIn" }} onAction={() => {}} />);
    fireEvent.click(screen.getByTestId("slip-use-another-name"));
    expect(screen.getByTestId("player-bar-name-input")).toBeInTheDocument();
    expect(screen.getByTestId("slip")).toHaveTextContent("this browser keeps your name");
  });

  it("the empty door says the browser keeps the name (FR-012)", () => {
    render(<Slip slip={{ kind: "signIn" }} onAction={() => {}} />);
    expect(screen.getByTestId("slip")).toHaveTextContent("no account needed");
    expect(screen.getByTestId("slip")).toHaveTextContent("this browser keeps your name");
  });
});
