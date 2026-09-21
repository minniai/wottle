import type { Coordinate } from "@/lib/types/board";
import type { PricedWord } from "@/lib/match/previewScoring";
import type { MoveRejectionReason } from "@/lib/types/match";

/**
 * Pure state machine for picking letters on the field (spec 044 data-model
 * §3.3, decision Q2; spec 050 contracts/move-state.md): idle → picked →
 * committed by default; idle → picked → preview → committed when the preview
 * setting is on. Only `submit` sends a move. A commit stays swapped until the
 * move's own resolution unwinds it; the opponent's resolutions only clear a
 * pick they touched.
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
  /** The opponent's move resolved; `tiles` are the letters it exchanged or froze. */
  | { type: "opponentResolved"; tiles: Coordinate[] }
  /** The viewer's own move resolved (or the warm-up applied the swap locally). */
  | { type: "moveResolved" }
  /** The viewer's own move was refused at resolution; the letters return. */
  | { type: "moveRejected"; reason: MoveRejectionReason }
  | { type: "priced"; price: PreviewPrice }
  | { type: "submitRejected" };

export type FieldEffect =
  | { kind: "submit"; from: Coordinate; to: Coordinate }
  | { kind: "requestPrice"; from: Coordinate; to: Coordinate }
  | { kind: "shake"; at: Coordinate }
  | { kind: "soundPick" }
  | { kind: "notice"; notice: "frozen" | "pickCleared"; at?: Coordinate }
  | { kind: "clearNotice" };

export interface FieldContext {
  previewEnabled: boolean;
  frozen: Set<string>;
  /** False while a move is not the player's to make (in flight, revealing, held, done, final). */
  canPick: boolean;
}

export interface FieldStep {
  next: FieldInteraction;
  effects: FieldEffect[];
}

export const IDLE: FieldInteraction = { kind: "idle" };

export const key = (c: Coordinate): string => `${c.x},${c.y}`;
export const same = (a: Coordinate, b: Coordinate): boolean => a.x === b.x && a.y === b.y;
const step = (next: FieldInteraction, ...effects: FieldEffect[]): FieldStep => ({ next, effects });

function secondTap(state: FieldInteraction, a: Coordinate, b: Coordinate, ctx: FieldContext): FieldStep {
  if (same(a, b)) return step(IDLE);
  if (ctx.previewEnabled) {
    return step({ kind: "preview", a, b, price: "pending" }, { kind: "requestPrice", from: a, to: b });
  }
  return step({ kind: "committed", a, b }, { kind: "submit", from: a, to: b });
}

function tap(state: FieldInteraction, at: Coordinate, ctx: FieldContext): FieldStep {
  if (!ctx.canPick || state.kind === "committed") return step(state);
  if (ctx.frozen.has(key(at))) return step(state, { kind: "shake", at }, { kind: "notice", notice: "frozen", at });
  if (state.kind === "idle") return step({ kind: "picked", a: at }, { kind: "soundPick" }, { kind: "clearNotice" });
  if (state.kind === "picked") return secondTap(state, state.a, at, ctx);
  // preview: tapping either letter commits; anywhere else re-picks.
  if (same(at, state.a) || same(at, state.b)) {
    return step({ kind: "committed", a: state.a, b: state.b }, { kind: "submit", from: state.a, to: state.b });
  }
  return step({ kind: "picked", a: at }, { kind: "soundPick" });
}

function opponentResolved(state: FieldInteraction, tiles: Coordinate[]): FieldStep {
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
      if (ctx.frozen.has(key(event.from)) || ctx.frozen.has(key(event.to))) return step(state, { kind: "shake", at: event.to });
      return secondTap(state, event.from, event.to, ctx);
    case "enter":
      if (state.kind === "preview") return step({ kind: "committed", a: state.a, b: state.b }, { kind: "submit", from: state.a, to: state.b });
      return step(state);
    case "escape":
    case "tapOutside":
      return state.kind === "committed" ? step(state) : step(IDLE);
    case "opponentResolved":
      return opponentResolved(state, event.tiles);
    case "moveResolved":
      return step(IDLE, { kind: "clearNotice" });
    case "moveRejected":
    case "submitRejected":
      return state.kind === "committed" ? step(IDLE) : step(state);
    case "priced":
      return state.kind === "preview" ? step({ ...state, price: event.price }) : step(state);
  }
}

/** Letters shown swapped: a preview exchanges in place; a commit stays swapped until the move resolves. */
export function swappedPair(state: FieldInteraction): [Coordinate, Coordinate] | null {
  return state.kind === "preview" || state.kind === "committed" ? [state.a, state.b] : null;
}
