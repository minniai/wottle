import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push }), usePathname: () => "/en/c/x" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
const acceptLinkAction = vi.fn();
vi.mock("@/app/actions/link/accept", () => ({ acceptLinkAction: (...args: unknown[]) => acceptLinkAction(...args) }));
const loginAction = vi.fn();
vi.mock("@/app/actions/auth/login", () => ({ loginAction: (...args: unknown[]) => loginAction(...args) }));
vi.mock("@/app/actions/auth/enterAsReturning", () => ({ enterAsReturningAction: vi.fn(async () => ({ status: "success" })) }));

import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { InviteEntry } from "@/components/page/door/InviteDoor";
import type { LinkView } from "@/lib/types/link";

const TOKEN = "Xq7Vt2pLm9KcR4sWn8BjYd3HfA6gZe1uQo5iNw0bTyE";
const view = (extra: Partial<LinkView> = {}): LinkView => ({
  valid: true,
  senderId: "00000000-0000-4000-8000-000000000002",
  senderName: "Kári",
  senderHandle: "kári",
  senderRating: 1265,
  language: "en",
  expiresAt: new Date(Date.now() + 552_000).toISOString(),
  ...extra,
});

function renderEntry(props: Partial<React.ComponentProps<typeof InviteEntry>> = {}) {
  return render(
    <LocaleProvider locale="en">
      <InviteEntry token={TOKEN} view={view()} returning={null} renderedAt={Date.now()} {...props} />
    </LocaleProvider>,
  );
}

/** Spec 072 T034: the invite door's column B (A2). */
describe("InviteEntry", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    push.mockClear();
    acceptLinkAction.mockReset().mockResolvedValue({ status: "created", matchId: "m1", language: "en" });
    loginAction.mockReset();
  });

  it("draws the band as a call, then the name, accept, the other way in and the consequence", () => {
    renderEntry();
    const band = screen.getByTestId("invite-band");
    expect(band.getAttribute("data-style")).toBe("call");
    expect(band.textContent).toContain("Kári challenges you");
    expect(band.textContent).toContain("1265 · english words · link valid 9:1");
    expect(band.querySelector(".page-square--opp")).not.toBeNull();
    const order = ["invite-band", "door-name", "door-error", "invite-accept", "invite-lobby-instead", "invite-consequence"].map((id) => screen.getByTestId(id));
    order.slice(1).forEach((el, i) => expect(order[i].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy());
  });

  it("accepts with the typed name after the 500ms guard, and goes to the table", async () => {
    renderEntry();
    fireEvent.change(screen.getByTestId("door-name"), { target: { value: "embla" } });
    fireEvent.click(screen.getByTestId("invite-accept"));
    expect(acceptLinkAction).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(600));
    await act(async () => void fireEvent.click(screen.getByTestId("invite-accept")));
    expect(acceptLinkAction).toHaveBeenCalledWith({ token: TOKEN, mode: "name", name: "embla" });
    expect(push).toHaveBeenCalledWith("/en/match/m1");
  });

  it("says why a name did not work, and keeps the band", async () => {
    acceptLinkAction.mockResolvedValue({ status: "sign_in_failed", code: "name_taken" });
    renderEntry();
    act(() => void vi.advanceTimersByTime(600));
    fireEvent.change(screen.getByTestId("door-name"), { target: { value: "birna" } });
    await act(async () => void fireEvent.click(screen.getByTestId("invite-accept")));
    expect(screen.getByTestId("door-error").textContent).toBe("that name is taken · pick another");
    expect(screen.getByTestId("door-name").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByTestId("invite-band").textContent).toContain("Kári challenges you");
  });

  it("greets a returning browser by name, and offers another name", async () => {
    renderEntry({ returning: { displayName: "Birna", rating: 1310 } });
    expect(screen.getByTestId("invite-returning").textContent).toContain("Birna");
    act(() => void vi.advanceTimersByTime(600));
    await act(async () => void fireEvent.click(screen.getByTestId("invite-accept")));
    expect(acceptLinkAction).toHaveBeenCalledWith({ token: TOKEN, mode: "returning" });
    fireEvent.click(screen.getByTestId("door-another-name"));
    expect(screen.queryByTestId("door-name")).not.toBeNull();
  });

  it("reads an expired link with enter the lobby as its primary and nothing else", () => {
    renderEntry({ view: view({ valid: false }) });
    expect(screen.getByTestId("invite-band").textContent).toBe("this link has expired");
    expect(screen.queryByTestId("invite-accept")).toBeNull();
    expect(screen.queryByTestId("invite-lobby-instead")).toBeNull();
    expect(screen.queryByTestId("invite-consequence")).toBeNull();
    expect(screen.getByTestId("invite-enter-lobby")).not.toBeNull();
  });

  it("turns expired when a refused accept says so", async () => {
    acceptLinkAction.mockResolvedValue({ status: "expired" });
    renderEntry({ returning: { displayName: "Birna", rating: 1310 } });
    act(() => void vi.advanceTimersByTime(600));
    await act(async () => void fireEvent.click(screen.getByTestId("invite-accept")));
    expect(screen.getByTestId("invite-band").textContent).toBe("this link has expired");
  });
});
