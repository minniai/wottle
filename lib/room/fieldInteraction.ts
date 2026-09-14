import type { Coordinate } from "@/lib/types/board";
import type { PricedWord } from "@/lib/match/previewScoring";

/**
 * Pure state machine for picking letters on the field (spec 044 data-model
 * §3.3, decision Q2): idle → picked → committed by default; idle → picked →
 * preview → committed when the preview setting is on. Only `submit` sends a move.
 */
export interface PreviewPrice {
  words: PricedWord[];
  total: number;
}

export type FieldInteraction =
  | { kind: "idle" }
  | { kind: "picked"; a: Coordinate }
  | { kind: "preview"; a: Coordinate; b: Coordinate; price: PreviewPrice | "pending" }
  | { kind: "committed"; a: Coordinate; b: Coordinate };

export type FieldEvent =
  | { type: "tap"; at: Coordinate }
  | { type: "drag"; from: Coordinate; to: Coordinate }
  | { type: "enter" }
  | { type: "escape" }
  | { type: "tapOutside" }
  | { type: "opponentPinned"; tiles: Coordinate[] }
  | { type: "roundAdvanced" }
  | { type: "priced"; price: PreviewPrice }
  | { type: "submitRejected" };

export type FieldEffect =
  | { kind: "submit"; from: Coordinate; to: Coordinate }
  | { kind: "requestPrice"; from: Coordinate; to: Coordinate }
  | { kind: "shake"; at: Coordinate }
  | { kind: "soundPick" }
  | { kind: "notice"; notice: "frozen" | "pinned" | "pickCleared"; at?: Coordinate }
  | { kind: "clearNotice" };

export interface FieldContext {
  previewEnabled: boolean;
  frozen: Set<string>;
  pinned: Set<string>;
  /** False while it is not the player's move (already committed, resolving, final). */
  canPick: boolean;
}

export interface FieldStep {
  next: FieldInteraction;
  effects: FieldEffect[];
}

export const IDLE: FieldInteraction = { kind: "idle" };

export const key = (c: Coordinate): string => `${c.x},${c.y}`;
const same = (a: Coordinate, b: Coordinate): boolean => a.x === b.x && a.y === b.y;
const step = (next: FieldInteraction, ...effects: FieldEffect[]): FieldStep => ({ next, effects });

function blockedBy(at: Coordinate, ctx: FieldContext): "frozen" | "pinned" | null {
  if (ctx.frozen.has(key(at))) return "frozen";
  if (ctx.pinned.has(key(at))) return "pinned";
  return null;
}

function secondTap(state: FieldInteraction, a: Coordinate, b: Coordinate, ctx: FieldContext): FieldStep {
  if (same(a, b)) return step(IDLE);
  if (ctx.previewEnabled) {
    return step({ kind: "preview", a, b, price: "pending" }, { kind: "requestPrice", from: a, to: b });
  }
  return step({ kind: "committed", a, b }, { kind: "submit", from: a, to: b });
}

function tap(state: FieldInteraction, at: Coordinate, ctx: FieldContext): FieldStep {
  if (!ctx.canPick || state.kind === "committed") return step(state);
  const blocked = blockedBy(at, ctx);
  if (blocked) return step(state, { kind: "shake", at }, { kind: "notice", notice: blocked, at });
  if (state.kind === "idle") return step({ kind: "picked", a: at }, { kind: "soundPick" }, { kind: "clearNotice" });
  if (state.kind === "picked") return secondTap(state, state.a, at, ctx);
  // preview: tapping either letter commits; anywhere else re-picks.
  if (same(at, state.a) || same(at, state.b)) {
    return step({ kind: "committed", a: state.a, b: state.b }, { kind: "submit", from: state.a, to: state.b });
  }
  return step({ kind: "picked", a: at }, { kind: "soundPick" });
}

function opponentPinned(state: FieldInteraction, tiles: Coordinate[]): FieldStep {
  const hit = (c: Coordinate) => tiles.some((t) => same(t, c));
  if (state.kind === "picked" && hit(state.a)) return step(IDLE, { kind: "notice", notice: "pickCleared" });
  if (state.kind === "preview" && (hit(state.a) || hit(state.b))) return step(IDLE, { kind: "notice", notice: "pickCleared" });
  return step(state);
}

export function reduceField(state: FieldInteraction, event: FieldEvent, ctx: FieldContext): FieldStep {
  switch (event.type) {
    case "tap":
      return tap(state, event.at, ctx);
    case "drag":
      if (!ctx.canPick || state.kind === "committed") return step(state);
      if (blockedBy(event.from, ctx) || blockedBy(event.to, ctx)) return step(state, { kind: "shake", at: event.to });
      return secondTap(state, event.from, event.to, ctx);
    case "enter":
      if (state.kind === "preview") return step({ kind: "committed", a: state.a, b: state.b }, { kind: "submit", from: state.a, to: state.b });
      return step(state);
    case "escape":
    case "tapOutside":
      return state.kind === "committed" ? step(state) : step(IDLE);
    case "opponentPinned":
      return opponentPinned(state, event.tiles);
    case "roundAdvanced":
      return step(IDLE, { kind: "clearNotice" });
    case "priced":
      return state.kind === "preview" ? step({ ...state, price: event.price }) : step(state);
    case "submitRejected":
      return state.kind === "committed" ? step(IDLE) : step(state);
  }
}

/** Letters shown swapped: a preview exchanges in place; a commit stays swapped until the round resolves. */
export function swappedPair(state: FieldInteraction): [Coordinate, Coordinate] | null {
  return state.kind === "preview" || state.kind === "committed" ? [state.a, state.b] : null;
}
