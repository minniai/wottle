import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LogoutConfirmDialog } from "@/components/ui/LogoutConfirmDialog";

describe("<LogoutConfirmDialog>", () => {
  it("does not render when closed", () => {
    render(<LogoutConfirmDialog open={false} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.queryByText("Sign out now?")).not.toBeInTheDocument();
  });

  it("renders title, body, and both actions when open", () => {
    render(<LogoutConfirmDialog open onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText("Sign out now?")).toBeInTheDocument();
    expect(
      screen.getByText(/forfeit your current match/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /stay signed in/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out & forfeit/i })).toBeInTheDocument();
  });

  it("fires onCancel and onConfirm when the matching buttons are clicked", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<LogoutConfirmDialog open onCancel={onCancel} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: /stay signed in/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /sign out & forfeit/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables the destructive button while pending", () => {
    render(
      <LogoutConfirmDialog open pending onCancel={vi.fn()} onConfirm={vi.fn()} />,
    );
    const confirm = screen.getByRole("button", { name: /signing out/i });
    expect(confirm).toBeDisabled();
  });
});
