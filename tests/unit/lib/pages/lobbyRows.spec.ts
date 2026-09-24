import { describe, expect, it } from "vitest";

import { getCopy } from "@/lib/i18n/getCopy";
import { orderRows, recordText, rowModel, visibleRows } from "@/lib/pages/lobbyRows";
import type { LobbyRow } from "@/lib/types/standing";

const row = (id: string, rating: number, state: LobbyRow["state"] = "here", extra: Partial<LobbyRow> = {}): LobbyRow => ({
  playerId: `00000000-0000-4000-8000-00000000000${id}`,
  displayName: `P${id}`,
  handle: `p${id}`,
  rating,
  state,
  movesPlayed: state === "in_match" ? 6 : null,
  record: null,
  ...extra,
});

/** Spec 070 US2.2–US2.3 (T047): who is here, in the order the table keeps. */
describe("orderRows", () => {
  it("sorts by state, then by rating distance from the viewer, then by name", () => {
    const rows = [row("1", 1300, "away"), row("2", 1400), row("3", 1250, "in_match"), row("4", 1190, "searching"), row("5", 1215), row("6", 1208)];
    expect(orderRows(rows, 1210, null).map((r) => r.displayName)).toEqual(["P6", "P5", "P2", "P4", "P3", "P1"]);
  });

  it("keeps the previous order while frozen and adds newcomers at the end", () => {
    const rows = [row("1", 1300), row("2", 1210), row("3", 1250)];
    const frozen = ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"];
    expect(orderRows(rows, 1210, frozen).map((r) => r.displayName)).toEqual(["P1", "P2", "P3"]);
  });

  it("drops someone who left while frozen", () => {
    const rows = [row("2", 1210)];
    expect(orderRows(rows, 1210, ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"]).map((r) => r.displayName)).toEqual(["P2"]);
  });
});

describe("rowModel", () => {
  const en = getCopy("en");
  const is = getCopy("is");

  it("offers a challenge to someone here or searching, labelled name first", () => {
    const m = rowModel(row("1", 1242), en);
    expect(m).toMatchObject({ status: "here", muted: false, action: { kind: "challenge", label: "P1 · challenge" } });
    expect(rowModel(row("2", 1096, "searching"), is)).toMatchObject({ status: "leitar", action: { kind: "challenge" } });
  });

  it("mutes someone in a match or away, with no action", () => {
    expect(rowModel(row("1", 1163, "in_match"), is)).toMatchObject({ status: "í viðureign · 6 af 10", muted: true, action: { kind: "none" } });
    expect(rowModel(row("2", 1163, "away"), en)).toMatchObject({ status: "away", muted: true, action: { kind: "none" } });
  });
});

describe("recordText", () => {
  it("reads wins first, draws only when there are any, and a dash with no matches", () => {
    expect(recordText({ wins: 3, losses: 1, draws: 0 })).toBe("3–1");
    expect(recordText({ wins: 3, losses: 1, draws: 1 })).toBe("3–1–1");
    expect(recordText(null)).toBe("—");
    expect(recordText({ wins: 0, losses: 0, draws: 0 })).toBe("—");
  });
});

describe("visibleRows", () => {
  it("shows eight, then offers the rest", () => {
    const rows = Array.from({ length: 14 }, (_, i) => i);
    expect(visibleRows(rows, false)).toEqual({ shown: rows.slice(0, 8), more: 6 });
    expect(visibleRows(rows, true)).toEqual({ shown: rows, more: 0 });
  });
});
