import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/auth/login", () => ({
  loginAction: vi.fn(async (_prev: unknown, formData: FormData) => {
    const name = String(formData.get("username") ?? "");
    if (name.length < 3) return { status: "error", code: "invalid_name", message: "Username must be at least 3 characters!" };
    return { status: "success", player: { id: "p1", username: name, displayName: name, status: "available", lastSeenAt: "" } };
  }),
}));

import { NameInput } from "@/components/room/NameInput";

describe("NameInput (design system §5.7)", () => {
  it("renders the underlined input with the fixed placeholder and play ▸", () => {
    render(<NameInput onSignedIn={() => {}} />);
    expect(screen.getByTestId("player-bar-name-input")).toHaveAttribute("placeholder", "your name");
    expect(screen.getByTestId("player-bar-action-play")).toHaveTextContent("play ▸");
  });

  it("submits the name and reports the signed-in player", async () => {
    const onSignedIn = vi.fn();
    render(<NameInput onSignedIn={onSignedIn} />);
    fireEvent.change(screen.getByTestId("player-bar-name-input"), { target: { value: "birna" } });
    fireEvent.submit(screen.getByTestId("name-input-form"));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(expect.objectContaining({ username: "birna" })));
  });

  it("shows the error in the page's words: a lowercase line without exclamation marks", async () => {
    render(<NameInput onSignedIn={() => {}} />);
    const input = screen.getByTestId("player-bar-name-input");
    input.removeAttribute("minlength");
    fireEvent.change(input, { target: { value: "ab" } });
    fireEvent.submit(screen.getByTestId("name-input-form"));
    await waitFor(() => expect(screen.getByTestId("name-input-error")).toHaveTextContent("3 to 24 letters, digits, - or _"));
    expect(screen.getByTestId("name-input-error").textContent).not.toContain("!");
  });
});
