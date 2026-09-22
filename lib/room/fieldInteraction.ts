import type { Coordinate } from "@/lib/types/board";
import type { MoveRejectionReason } from "@/lib/types/match";

/**
 * Pure state machine for picking letters on the field (spec 044 data-model
 * §3.3; spec 050 contracts/move-state.md): idle → picked → committed. The
 * second letter plays the move at once — there is no preview. Only `submit`
 * sends a move. A commit stays swapped until the move's own resolution unwinds
 * it; the opponent's resolutions only clear a pick they touched.
 */

export type FieldInteraction =
  | { kind: "idle" }
  | { kind: "picked"; a: Coordinate }
  | { kind: "committed"; a: Coordinate; b: Coordinate };

export type FieldEvent =
  | { type: "tap"; at: Coordinate }
  | { type: "drag"; from: Coordinate; to: Coordinate }
  | { type: "escape" }
  | { type: "tapOutside" }
  /** The opponent's move resolved; `tiles` are the letters it exchanged or froze. */
  | { type: "opponentResolved"; tiles: Coordinate[] }
  /** The viewer's own move resolved (or the warm-up applied the swap locally). */
  | { type: "moveResolved" }
  /** The viewer's own move was refused at resolution; the letters return. */
  | { type: "moveRejected"; reason: MoveRejectionReason }
  | { type: "submitRejected" };

export type FieldEffect =
  | { kind: "submit"; from: Coordinate; to: Coordinate }
  | { kind: "shake"; at: Coordinate }
  | { kind: "soundPick" }
  | { kind: "notice"; notice: "frozen" | "pickCleared"; at?: Coordinate }
  | { kind: "clearNotice" };

export interface FieldContext {
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

function secondTap(a: Coordinate, b: Coordinate): FieldStep {
  if (same(a, b)) return step(IDLE);
  return step({ kind: "committed", a, b }, { kind: "submit", from: a, to: b });
}

function tap(state: FieldInteraction, at: Coordinate, ctx: FieldContext): FieldStep {
  if (!ctx.canPick || state.kind === "committed") return step(state);
  if (ctx.frozen.has(key(at))) return step(state, { kind: "shake", at }, { kind: "notice", notice: "frozen", at });
  if (state.kind === "idle") return step({ kind: "picked", a: at }, { kind: "soundPick" }, { kind: "clearNotice" });
  return secondTap(state.a, at);
}

function opponentResolved(state: FieldInteraction, tiles: Coordinate[]): FieldStep {
  const hit = (c: Coordinate) => tiles.some((t) => same(t, c));
  if (state.kind === "picked" && hit(state.a)) return step(IDLE, { kind: "notice", notice: "pickCleared" });
  return step(state);
}

export function reduceField(state: FieldInteraction, event: FieldEvent, ctx: FieldContext): FieldStep {
  switch (event.type) {
    case "tap":
      return tap(state, event.at, ctx);
    case "drag":
      if (!ctx.canPick || state.kind === "committed") return step(state);
      if (ctx.frozen.has(key(event.from)) || ctx.frozen.has(key(event.to))) return step(state, { kind: "shake", at: event.to });
      return secondTap(event.from, event.to);
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
  }
}

/** Letters shown swapped: a commit stays swapped until the move resolves. */
export function swappedPair(state: FieldInteraction): [Coordinate, Coordinate] | null {
  return state.kind === "committed" ? [state.a, state.b] : null;
}
