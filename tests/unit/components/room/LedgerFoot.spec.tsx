import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LedgerFoot } from "@/components/room/LedgerFoot";

describe("LedgerFoot (spec 048 US5)", () => {
  it("lobby and final feet link to how to play in the same tab; a match foot does not", () => {
    for (const variant of ["lobby", "final"] as const) {
      const { unmount } = render(<LedgerFoot variant={variant} onAction={() => {}} />);
      const link = screen.getByTestId("ledger-how-to-play");
      expect(link).toHaveAttribute("href", "/rules");
      expect(link).not.toHaveAttribute("target");
      expect(link).toHaveTextContent("how to play ▸");
      unmount();
    }
    render(<LedgerFoot variant="match" onAction={() => {}} />);
    expect(screen.queryByTestId("ledger-how-to-play")).toBeNull();
    expect(screen.queryByTestId("ledger-rules")).toBeNull();
  });
});
