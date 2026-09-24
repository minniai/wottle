import { act, fireEvent, render, screen, within } from "@testing-library/react";
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

  it("has one h1, the headline, and a lockup that is an image with no link inside", () => {
    renderDoor("is");
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toContain("Tveir leikmenn, eitt borð,");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const lockup = screen.getByRole("img", { name: "Orðusta, Wottle á ensku" });
    expect(within(lockup).queryByRole("link")).toBeNull();
    expect(screen.getByText("orð + orusta · orðaeinvígi fyrir tvo")).toBeTruthy();
  });

  it("labels the name, never autofocuses it, and points it at the format rule", () => {
    renderDoor("en");
    const input = screen.getByLabelText("your name");
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
    const input = screen.getByLabelText("your name");
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
    fireEvent.change(screen.getByLabelText("your name"), { target: { value: "birna" } });
    await act(async () => {
      fireEvent.submit(screen.getByLabelText("your name").closest("form")!);
    });
    expect(replace).toHaveBeenCalledWith("/en/rules");
    expect(refresh).toHaveBeenCalled();
  });

  it("greets a returning browser by name, enters with nothing typed, and offers another name", async () => {
    enterAsReturningAction.mockResolvedValue({ status: "success", player: { id: "p" } });
    renderDoor("en", { returning: { displayName: "Birna", rating: 1310 } });
    expect(screen.getByText("welcome back")).toBeTruthy();
    expect(screen.queryByLabelText("your name")).toBeNull();
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
    expect(screen.getByLabelText("your name")).toBeTruthy();
  });

  it("says how it plays and links the rules once", () => {
    renderDoor("en");
    expect(screen.getByText("Swap two letters.")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "how to play ▸" })).toHaveLength(1);
  });
});
