import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RoomMenu } from "@/components/room/RoomMenu";

describe("RoomMenu (spec 048 US5)", () => {
  it("the match menu offers how to play as a new-tab link between the toggles and resign", () => {
    render(<RoomMenu variant="match" onAction={() => {}} />);
    fireEvent.click(screen.getByTestId("ledger-menu-trigger"));
    const items = screen.getAllByRole("menuitem").map((el) => el.getAttribute("data-testid"));
    expect(items).toEqual(["ledger-menu-item-sound", "ledger-menu-item-preview", "ledger-menu-item-howToPlay", "ledger-menu-item-resign", "ledger-menu-item-leave"]);
    const link = screen.getByTestId("ledger-menu-item-howToPlay");
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/rules");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener");
  });

  it("lobby and final menus do not: their feet carry the link", () => {
    const onAction = vi.fn();
    for (const variant of ["lobby", "final"] as const) {
      const { unmount } = render(<RoomMenu variant={variant} onAction={onAction} />);
      fireEvent.click(screen.getByTestId("ledger-menu-trigger"));
      expect(screen.queryByTestId("ledger-menu-item-howToPlay")).toBeNull();
      unmount();
    }
  });
});
