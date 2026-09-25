import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh, push: vi.fn() }), usePathname: () => "/" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
const loginAction = vi.fn();
vi.mock("@/app/actions/auth/login", () => ({ loginAction: (...args: unknown[]) => loginAction(...args) }));
const enterAsReturningAction = vi.fn();
vi.mock("@/app/actions/auth/enterAsReturning", () => ({ enterAsReturningAction: (...args: unknown[]) => enterAsReturningAction(...args) }));

import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { Door } from "@/components/page/door/Door";

const HERE = [
  { displayName: "Embla", rating: 1242, state: "here" as const },
  { displayName: "Ragnar", rating: 1096, state: "searching" as const },
];

function renderDoor(locale: "is" | "en", props: Partial<React.ComponentProps<typeof Door>> = {}) {
  return render(
    <LocaleProvider locale={locale}>
      <Door here={HERE} more={0} returning={null} next={null} {...props} />
    </LocaleProvider>,
  );
}

/** Spec 070 US1 (A1): the door. */
describe("Door", () => {
  beforeEach(() => {
    replace.mockClear();
    refresh.mockClear();
    loginAction.mockReset();
    enterAsReturningAction.mockReset();
  });

  it("welcomes the player in one h1 under the strip, with no lockup", () => {
    renderDoor("is");
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toBe("Velkomin í Orðustu.");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText("Orðaeinvígi fyrir tvo.")).toBeTruthy();
    expect(screen.queryByTestId("lockup")).toBeNull();
  });

  it("asks for a username, never autofocuses it, and points it at the format rule", () => {
    renderDoor("en");
    const input = screen.getByLabelText("pick a username");
    expect(input).not.toHaveFocus();
    expect(input.getAttribute("autofocus")).toBeNull();
    const described = input.getAttribute("aria-describedby")!.split(" ");
    expect(described.map((id) => document.getElementById(id)?.textContent)).toContain("3 to 24 letters, digits, - or _");
    expect(input.getAttribute("aria-invalid")).toBe("false");
  });

  it.each([
    ["invalid_name", "3 to 24 letters, digits, - or _"],
    ["name_taken", "that name is taken · pick another"],
    ["rate_limited", "too many tries · wait a minute"],
    ["login_failed", "could not sign in · try again"],
  ])("shows %s in the polite line and marks the input invalid", async (code, text) => {
    loginAction.mockResolvedValue({ status: "error", code });
    renderDoor("en");
    const input = screen.getByLabelText("pick a username");
    fireEvent.change(input, { target: { value: "birna" } });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });
    const line = await screen.findByTestId("door-error");
    expect(line.textContent).toBe(text);
    expect(line.getAttribute("aria-live")).toBe("polite");
    expect(line.getAttribute("data-error")).toBe("true");
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  it("enters the lobby at the same URL, replacing the door's history entry, or the validated next", async () => {
    loginAction.mockResolvedValue({ status: "success", player: { id: "p" } });
    renderDoor("en", { next: "/en/rules" });
    fireEvent.change(screen.getByLabelText("pick a username"), { target: { value: "birna" } });
    await act(async () => {
      fireEvent.submit(screen.getByLabelText("pick a username").closest("form")!);
    });
    expect(replace).toHaveBeenCalledWith("/en/rules");
    expect(refresh).toHaveBeenCalled();
  });

  it("keeps the primary grey until the name passes the rule, and names what broke it", () => {
    renderDoor("en");
    const input = screen.getByLabelText("pick a username");
    const button = screen.getByTestId("door-enter");
    expect(button).toBeDisabled();
    fireEvent.change(input, { target: { value: "ari jo" } });
    expect(button).toBeDisabled();
    expect(screen.getByTestId("door-error").textContent).toBe("no spaces or symbols · letters, digits, - and _");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    fireEvent.change(input, { target: { value: "arijo" } });
    expect(button).not.toBeDisabled();
    expect(input.getAttribute("aria-invalid")).toBe("false");
  });

  it("says a short name is short only once the field is left", () => {
    renderDoor("en");
    const input = screen.getByLabelText("pick a username");
    fireEvent.change(input, { target: { value: "ab" } });
    expect(screen.getByTestId("door-error").getAttribute("data-error")).toBe("false");
    fireEvent.blur(input);
    expect(screen.getByTestId("door-error").textContent).toBe("at least 3 characters");
  });

  it("does not send a name that breaks the rule", async () => {
    renderDoor("en");
    const input = screen.getByLabelText("pick a username");
    fireEvent.change(input, { target: { value: "a b" } });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });
    expect(loginAction).not.toHaveBeenCalled();
  });

  it("says the lobby is opening from the press until the lobby lands", async () => {
    let resolve: (value: unknown) => void = () => {};
    loginAction.mockReturnValue(new Promise((r) => (resolve = r)));
    renderDoor("en");
    const input = screen.getByLabelText("pick a username");
    fireEvent.change(input, { target: { value: "birna" } });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });
    const button = screen.getByTestId("door-enter");
    expect(button).toBeDisabled();
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.textContent).toContain("opening the lobby");
    expect(input).toHaveAttribute("readonly");
    await act(async () => {
      resolve({ status: "success", player: { id: "p" } });
    });
    // The refresh reads the page again as the lobby; the door holds its state until it is replaced.
    expect(refresh).toHaveBeenCalled();
    expect(screen.getByTestId("door-enter").getAttribute("aria-busy")).toBe("true");
  });

  it("lets the name be pressed again after a refusal", async () => {
    loginAction.mockResolvedValue({ status: "error", code: "name_taken" });
    renderDoor("en");
    const input = screen.getByLabelText("pick a username");
    fireEvent.change(input, { target: { value: "birna" } });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });
    const button = screen.getByTestId("door-enter");
    expect(button).not.toBeDisabled();
    expect(button.getAttribute("aria-busy")).toBe("false");
    fireEvent.change(input, { target: { value: "birna2" } });
    expect(screen.getByTestId("door-error").getAttribute("data-error")).toBe("false");
  });

  it("greets a returning browser by name, enters with nothing typed, and offers another name", async () => {
    enterAsReturningAction.mockResolvedValue({ status: "success", player: { id: "p" } });
    renderDoor("en", { returning: { displayName: "Birna", rating: 1310 } });
    expect(screen.getByText("welcome back")).toBeTruthy();
    expect(screen.queryByLabelText("pick a username")).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "enter the lobby ▸" }));
    });
    expect(enterAsReturningAction).toHaveBeenCalledWith("en");
    // The lobby is the same page: it reads again signed in.
    expect(refresh).toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    replace.mockClear();
  });

  it("shows the empty name field after 'not Birna? · use another name'", () => {
    renderDoor("en", { returning: { displayName: "Birna", rating: 1310 } });
    fireEvent.click(screen.getByRole("button", { name: "not Birna? · use another name" }));
    expect(screen.getByLabelText("pick a username")).toBeTruthy();
  });

  it("says how it plays and links the rules once", () => {
    renderDoor("en");
    expect(screen.getByText("Swap two letters.")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "how to play ▸" })).toHaveLength(1);
  });
});
