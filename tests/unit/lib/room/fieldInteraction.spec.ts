import { describe, expect, it } from "vitest";

import { IDLE, reduceField, swappedPair, type FieldContext, type FieldEffect, type FieldInteraction } from "@/lib/room/fieldInteraction";

const A = { x: 1, y: 1 };
const B = { x: 4, y: 1 };
const C = { x: 7, y: 7 };
const ctx = (over: Partial<FieldContext> = {}): FieldContext => ({ previewEnabled: false, frozen: new Set(), canPick: true, ...over });
const kinds = (effects: FieldEffect[]) => effects.map((e) => e.kind);

describe("reduceField (spec 044 data-model §3.3, spec 050)", () => {
  it("first tap picks with a sound; second tap commits by default", () => {
    const picked = reduceField(IDLE, { type: "tap", at: A }, ctx());
    expect(picked.next).toEqual({ kind: "picked", a: A });
    expect(kinds(picked.effects)).toEqual(["soundPick", "clearNotice"]);
    const committed = reduceField(picked.next, { type: "tap", at: B }, ctx());
    expect(committed.next).toEqual({ kind: "committed", a: A, b: B });
    expect(committed.effects).toEqual([{ kind: "submit", from: A, to: B }]);
    expect(swappedPair(committed.next)).toEqual([A, B]);
  });

  it("with preview on the second tap previews and requests a price; the third tap commits", () => {
    const picked = reduceField(IDLE, { type: "tap", at: A }, ctx({ previewEnabled: true })).next;
    const preview = reduceField(picked, { type: "tap", at: B }, ctx({ previewEnabled: true }));
    expect(preview.next).toEqual({ kind: "preview", a: A, b: B, price: "pending" });
    expect(preview.effects).toEqual([{ kind: "requestPrice", from: A, to: B }]);
    const priced = reduceField(preview.next, { type: "priced", price: { words: [], total: 0 } }, ctx({ previewEnabled: true }));
    expect(priced.next).toMatchObject({ kind: "preview", price: { total: 0 } });
    const committed = reduceField(priced.next, { type: "tap", at: A }, ctx({ previewEnabled: true }));
    expect(committed.next).toEqual({ kind: "committed", a: A, b: B });
    expect(committed.effects).toEqual([{ kind: "submit", from: A, to: B }]);
  });

  it("Enter commits a preview; tapping a third letter re-picks it", () => {
    const preview: FieldInteraction = { kind: "preview", a: A, b: B, price: "pending" };
    expect(reduceField(preview, { type: "enter" }, ctx()).next).toEqual({ kind: "committed", a: A, b: B });
    expect(reduceField(preview, { type: "tap", at: C }, ctx({ previewEnabled: true })).next).toEqual({ kind: "picked", a: C });
  });

  it("tapping the picked letter again, Escape or tapping outside returns to idle (no sound)", () => {
    const picked: FieldInteraction = { kind: "picked", a: A };
    expect(reduceField(picked, { type: "tap", at: A }, ctx())).toEqual({ next: IDLE, effects: [] });
    expect(reduceField(picked, { type: "escape" }, ctx()).next).toEqual(IDLE);
    expect(reduceField(picked, { type: "tapOutside" }, ctx()).next).toEqual(IDLE);
  });

  it("a frozen tap shakes and notifies without changing state", () => {
    const frozen = reduceField(IDLE, { type: "tap", at: A }, ctx({ frozen: new Set(["1,1"]) }));
    expect(frozen.next).toEqual(IDLE);
    expect(frozen.effects).toEqual([{ kind: "shake", at: A }, { kind: "notice", notice: "frozen", at: A }]);
  });

  // Spec 050 FR-014: the opponent's resolution clears a pick it touched.
  it("an opponent's resolved move covering the pick or the preview clears it with a notice", () => {
    const picked: FieldInteraction = { kind: "picked", a: A };
    const cleared = reduceField(picked, { type: "opponentResolved", tiles: [A, C] }, ctx());
    expect(cleared.next).toEqual(IDLE);
    expect(cleared.effects).toEqual([{ kind: "notice", notice: "pickCleared" }]);
    expect(reduceField(picked, { type: "opponentResolved", tiles: [C] }, ctx()).next).toBe(picked);
    const preview: FieldInteraction = { kind: "preview", a: A, b: B, price: "pending" };
    expect(reduceField(preview, { type: "opponentResolved", tiles: [B] }, ctx()).next).toEqual(IDLE);
    expect(reduceField(preview, { type: "opponentResolved", tiles: [C] }, ctx()).next).toBe(preview);
  });

  it("drag acts as a second tap under the current setting", () => {
    expect(reduceField(IDLE, { type: "drag", from: A, to: B }, ctx()).next).toEqual({ kind: "committed", a: A, b: B });
    expect(reduceField(IDLE, { type: "drag", from: A, to: B }, ctx({ previewEnabled: true })).next).toMatchObject({ kind: "preview" });
    expect(reduceField(IDLE, { type: "drag", from: A, to: B }, ctx({ frozen: new Set(["4,1"]) })).effects).toEqual([{ kind: "shake", at: B }]);
  });

  // Spec 050: a commit is unwound by its own resolution, never by the opponent's.
  it("committed is sticky until the move resolves, is refused, or the server rejects the post", () => {
    const committed: FieldInteraction = { kind: "committed", a: A, b: B };
    expect(reduceField(committed, { type: "tap", at: C }, ctx()).next).toBe(committed);
    expect(reduceField(committed, { type: "escape" }, ctx()).next).toBe(committed);
    expect(reduceField(committed, { type: "opponentResolved", tiles: [A, B] }, ctx()).next).toBe(committed);
    expect(reduceField(committed, { type: "moveResolved" }, ctx())).toEqual({ next: IDLE, effects: [{ kind: "clearNotice" }] });
    expect(reduceField(committed, { type: "moveRejected", reason: "frozen" }, ctx()).next).toEqual(IDLE);
    expect(reduceField(committed, { type: "submitRejected" }, ctx()).next).toEqual(IDLE);
    expect(reduceField(IDLE, { type: "moveRejected", reason: "moved" }, ctx()).next).toEqual(IDLE);
  });

  it("nothing is picked while a move is not the player's to make", () => {
    expect(reduceField(IDLE, { type: "tap", at: A }, ctx({ canPick: false }))).toEqual({ next: IDLE, effects: [] });
    expect(reduceField(IDLE, { type: "drag", from: A, to: B }, ctx({ canPick: false })).next).toEqual(IDLE);
  });
});
