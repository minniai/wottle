import { describe, expect, it, vi } from "vitest";

const redirect = vi.fn((to: string) => {
  throw new Error(`REDIRECT ${to}`);
});
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));

import SummaryPage from "@/app/[locale]/match/[matchId]/summary/page";

describe("/match/:id/summary (spec 071 FR-041)", () => {
  it("goes to the match's last review step", async () => {
    await expect(SummaryPage({ params: { matchId: "m1", locale: "en" } })).rejects.toThrow("REDIRECT /en/match/m1?review=last");
    await expect(SummaryPage({ params: { matchId: "m1" } })).rejects.toThrow("REDIRECT /match/m1?review=last");
  });
});
