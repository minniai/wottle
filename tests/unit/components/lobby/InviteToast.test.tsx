import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { InviteToast } from "@/components/lobby/InviteToast";

const baseInvite = {
  inviteId: "inv-1",
  fromDisplayName: "Sigríður",
  fromUsername: "sigga",
  fromElo: 1842,
  yourElo: 1728,
};

describe("InviteToast", () => {
  test("renders opponent name and 'Challenge received' eyebrow", () => {
    render(
      <InviteToast
        invite={baseInvite}
        onAccept={vi.fn()}
        onDecline={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Challenge received")).toBeInTheDocument();
    expect(screen.getByText("Sigríður")).toBeInTheDocument();
  });

  test("body shows both player ratings", () => {
    render(
      <InviteToast
        invite={baseInvite}
        onAccept={vi.fn()}
        onDecline={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/1,728/)).toBeInTheDocument();
    expect(screen.getByText(/1,842/)).toBeInTheDocument();
  });

  test("accept button fires onAccept with invite id", () => {
    const onAccept = vi.fn();
    render(
      <InviteToast
        invite={baseInvite}
        onAccept={onAccept}
        onDecline={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Accept/i }));
    expect(onAccept).toHaveBeenCalledWith("inv-1");
  });

  test("decline button fires onDecline with invite id", () => {
    const onDecline = vi.fn();
    render(
      <InviteToast
        invite={baseInvite}
        onAccept={vi.fn()}
        onDecline={onDecline}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Decline/i }));
    expect(onDecline).toHaveBeenCalledWith("inv-1");
  });

  test("close button fires onClose", () => {
    const onClose = vi.fn();
    render(
      <InviteToast
        invite={baseInvite}
        onAccept={vi.fn()}
        onDecline={vi.fn()}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
