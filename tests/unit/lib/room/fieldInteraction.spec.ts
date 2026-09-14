import { describe, expect, it } from "vitest";

import { IDLE, reduceField, swappedPair, type FieldContext, type FieldInteraction } from "@/lib/room/fieldInteraction";

const A = { x: 1, y: 1 };
const B = { x: 4, y: 1 };
const C = { x: 7, y: 7 };
const ctx = (over: Partial<FieldContext> = {}): FieldContext => ({ previewEnabled: false, frozen: new Set(), pinned: new Set(), canPick: true, ...over });
const kinds = (effects: { kind: string }[]) => effects.map((e) => e.kind);

describe("reduceField (spec 044 §3.3, decision Q2)", () => {
  it("first tap picks with a sound; second tap commits by default", () => {
    const s1 = reduceField(IDLE, { type: "tap", at: A }, ctx());
    expect(s1.next).toEqual({ kind: "picked", a: A });
    expect(kinds(s1.effects)).toContain("soundPick");
    const s2 = reduceField(s1.next, { type: "tap", at: B }, ctx());
    expect(s2.next).toEqual({ kind: "committed", a: A, b: B });
    expect(s2.effects).toEqual([{ kind: "submit", from: A, to: B }]);
  });

  it("with preview on the second tap previews and requests a price; the third tap commits", () => {
    const picked: FieldInteraction = { kind: "picked", a: A };
    const s2 = reduceField(picked, { type: "tap", at: B }, ctx({ previewEnabled: true }));
    expect(s2.next).toEqual({ kind: "preview", a: A, b: B, price: "pending" });
    expect(s2.effects).toEqual([{ kind: "requestPrice", from: A, to: B }]);
    const priced = reduceField(s2.next, { type: "priced", price: { words: [], total: 0 } }, ctx({ previewEnabled: true }));
    expect(priced.next).toMatchObject({ kind: "preview", price: { total: 0 } });
    const s3 = reduceField(priced.next, { type: "tap", at: B }, ctx({ previewEnabled: true }));
    expect(s3.next).toEqual({ kind: "committed", a: A, b: B });
    expect(s3.effects).toEqual([{ kind: "submit", from: A, to: B }]);
  });

  it("Enter commits a preview; tapping a third letter re-picks it", () => {
    const preview: FieldInteraction = { kind: "preview", a: A, b: B, price: "pending" };
    expect(reduceField(preview, { type: "enter" }, ctx({ previewEnabled: true })).next.kind).toBe("committed");
    const repick = reduceField(preview, { type: "tap", at: C }, ctx({ previewEnabled: true }));
    expect(repick.next).toEqual({ kind: "picked", a: C });
  });

  it("tapping the picked letter again, Escape or tapping outside returns to idle (no sound)", () => {
    const picked: FieldInteraction = { kind: "picked", a: A };
    expect(reduceField(picked, { type: "tap", at: A }, ctx())).toEqual({ next: IDLE, effects: [] });
    const preview: FieldInteraction = { kind: "preview", a: A, b: B, price: "pending" };
    expect(reduceField(preview, { type: "escape" }, ctx()).next).toEqual(IDLE);
    expect(reduceField(preview, { type: "tapOutside" }, ctx()).next).toEqual(IDLE);
  });

  it("frozen or pinned taps shake and notify without changing state", () => {
    const picked: FieldInteraction = { kind: "picked", a: A };
    const frozen = reduceField(picked, { type: "tap", at: B }, ctx({ frozen: new Set(["4,1"]) }));
    expect(frozen.next).toBe(picked);
    expect(frozen.effects).toEqual([{ kind: "shake", at: B }, { kind: "notice", notice: "frozen", at: B }]);
    const pinned = reduceField(IDLE, { type: "tap", at: B }, ctx({ pinned: new Set(["4,1"]) }));
    expect(pinned.next).toEqual(IDLE);
    expect(kinds(pinned.effects)).toEqual(["shake", "notice"]);
  });

  it("opponent pins covering the pick or the preview clear it with a notice", () => {
    const picked: FieldInteraction = { kind: "picked", a: A };
    const cleared = reduceField(picked, { type: "opponentPinned", tiles: [A, C] }, ctx());
    expect(cleared.next).toEqual(IDLE);
    expect(cleared.effects).toEqual([{ kind: "notice", notice: "pickCleared" }]);
    const preview: FieldInteraction = { kind: "preview", a: A, b: B, price: "pending" };
    expect(reduceField(preview, { type: "opponentPinned", tiles: [B] }, ctx()).next).toEqual(IDLE);
    expect(reduceField(preview, { type: "opponentPinned", tiles: [C] }, ctx()).next).toBe(preview);
  });

  it("drag acts as a second tap under the current setting", () => {
    expect(reduceField(IDLE, { type: "drag", from: A, to: B }, ctx()).next.kind).toBe("committed");
    expect(reduceField(IDLE, { type: "drag", from: A, to: B }, ctx({ previewEnabled: true })).next.kind).toBe("preview");
    expect(kinds(reduceField(IDLE, { type: "drag", from: A, to: B }, ctx({ frozen: new Set(["4,1"]) })).effects)).toEqual(["shake"]);
  });

  it("committed is sticky until the round advances or the server rejects", () => {
    const committed: FieldInteraction = { kind: "committed", a: A, b: B };
    expect(reduceField(committed, { type: "tap", at: C }, ctx()).next).toBe(committed);
    expect(reduceField(committed, { type: "escape" }, ctx()).next).toBe(committed);
    expect(reduceField(committed, { type: "roundAdvanced" }, ctx()).next).toEqual(IDLE);
    expect(reduceField(committed, { type: "submitRejected" }, ctx()).next).toEqual(IDLE);
    expect(swappedPair(committed)).toEqual([A, B]);
    expect(swappedPair(IDLE)).toBeNull();
  });

  it("nothing is picked while it is not the player's move", () => {
    expect(reduceField(IDLE, { type: "tap", at: A }, ctx({ canPick: false })).next).toEqual(IDLE);
  });
});
