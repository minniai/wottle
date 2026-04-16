import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const sendInviteMock = vi.fn();
const respondInviteMock = vi.fn();

vi.mock("@/app/actions/matchmaking/sendInvite", () => ({
  sendInviteAction: (...args: unknown[]) => sendInviteMock(...args),
  respondInviteAction: (...args: unknown[]) => respondInviteMock(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const enqueueMock = vi.fn();

vi.mock("@/components/ui/ToastProvider", async () => {
  const actual = await vi.importActual<typeof import("@/components/ui/ToastProvider")>(
    "@/components/ui/ToastProvider",
  );
  return {
    ...actual,
    useToast: () => ({ enqueue: enqueueMock }),
  };
});

import { InviteDialog } from "@/components/lobby/InviteDialog";

beforeEach(() => {
  sendInviteMock.mockReset();
  respondInviteMock.mockReset();
  enqueueMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("InviteDialog — send variant", () => {
  test("renders with pre-selected opponent display name", () => {
    render(
      <InviteDialog
        variant="send"
        open
        onClose={() => {}}
        opponent={{
          id: "target",
          username: "gunna",
          displayName: "Gunna",
        }}
      />,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Gunna/)).toBeInTheDocument();
  });

  test("confirm button dispatches sendInviteAction with the opponent id", async () => {
    sendInviteMock.mockResolvedValue({ status: "sent", inviteId: "i1", expiresAt: "x" });
    render(
      <InviteDialog
        variant="send"
        open
        onClose={() => {}}
        opponent={{ id: "target", username: "g", displayName: "G" }}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /send invite/i }));
    });
    expect(sendInviteMock).toHaveBeenCalledWith("target");
  });

  test("cancel/backdrop close without dispatching", () => {
    render(
      <InviteDialog
        variant="send"
        open
        onClose={() => {}}
        opponent={{ id: "target", username: "g", displayName: "G" }}
      />,
    );
    fireEvent.keyDown(screen.getByRole("button", { name: /send invite/i }), {
      key: "Escape",
    });
    expect(sendInviteMock).not.toHaveBeenCalled();
  });
});

describe("InviteDialog — receive variant", () => {
  test("renders sender identity and expiry time", () => {
    render(
      <InviteDialog
        variant="receive"
        open
        onClose={() => {}}
        invite={{
          id: "inv1",
          sender: { id: "s", username: "ari", displayName: "Ari" },
          expiresAt: "2026-04-16T12:34:00Z",
        }}
      />,
    );
    expect(screen.getByText(/Ari/)).toBeInTheDocument();
    expect(screen.getByText(/respond/i)).toBeInTheDocument();
  });

  test("Accept calls respondInviteAction with accepted", async () => {
    respondInviteMock.mockResolvedValue({ status: "accepted", matchId: "m1" });
    render(
      <InviteDialog
        variant="receive"
        open
        onClose={() => {}}
        invite={{
          id: "inv1",
          sender: { id: "s", username: "ari", displayName: "Ari" },
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /accept/i }));
    });
    expect(respondInviteMock).toHaveBeenCalledWith("inv1", "accepted");
  });

  test("Decline calls respondInviteAction with declined", async () => {
    respondInviteMock.mockResolvedValue({ status: "declined" });
    render(
      <InviteDialog
        variant="receive"
        open
        onClose={() => {}}
        invite={{
          id: "inv1",
          sender: { id: "s", username: "ari", displayName: "Ari" },
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /decline/i }));
    });
    expect(respondInviteMock).toHaveBeenCalledWith("inv1", "declined");
  });
});

describe("InviteDialog — bottom-sheet", () => {
  test("applies bottom-sheet data attribute by default", () => {
    render(
      <InviteDialog
        variant="send"
        open
        onClose={() => {}}
        opponent={{ id: "t", username: "g", displayName: "G" }}
      />,
    );
    expect(screen.getByRole("dialog").getAttribute("data-bottom-sheet")).toBe(
      "true",
    );
  });
});
