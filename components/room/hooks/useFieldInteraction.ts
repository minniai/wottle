"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { previewSwap } from "@/app/actions/match/previewSwap";
import type { CellState } from "@/components/room/FieldCell";
import type { Seat } from "@/lib/constants/seatColors";
import {
  IDLE,
  reduceField,
  swappedPair,
  type FieldContext,
  type FieldEffect,
  type FieldEvent,
  type FieldInteraction,
} from "@/lib/room/fieldInteraction";
import type { Coordinate, MoveResult } from "@/lib/types/board";

export interface FieldInteractionOptions {
  /** Match id for server calls; null in the lobby warm-up (swaps stay local). */
  matchId: string | null;
  /** The board the player sees: the two letters of a move travel with it (spec 050). */
  board: string[][];
  /** Warm-up: apply the swap locally instead of posting a move. */
  onLocalSwap?: (from: Coordinate, to: Coordinate) => void;
  previewEnabled: boolean;
  frozenKeys: Set<string>;
  canPick: boolean;
  onPick: () => void;
  onCommitted: () => void;
  onRejected: (message: string) => void;
  onNotice: (notice: "frozen" | "pickCleared", at?: Coordinate) => void;
}

export interface FieldInteractionApi {
  interaction: FieldInteraction;
  ownPins: [Coordinate, Coordinate] | null;
  shakeAt: Coordinate | null;
  focusAt: Coordinate | null;
  dispatch: (event: FieldEvent) => void;
  cellStateFor: (coord: Coordinate, base: CellState) => CellState;
  seatFor: (coord: Coordinate) => Seat | null;
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>, coord: Coordinate) => void;
}

const SHAKE_MS = 320;

async function postMove(matchId: string, board: string[][], from: Coordinate, to: Coordinate): Promise<MoveResult> {
  const res = await fetch(`/api/match/${matchId}/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fromX: from.x,
      fromY: from.y,
      toX: to.x,
      toY: to.y,
      fromLetter: board[from.y]?.[from.x] ?? "",
      toLetter: board[to.y]?.[to.x] ?? "",
    }),
  });
  const body = (await res.json().catch(() => ({}))) as Partial<MoveResult> & { error?: string };
  if (res.status === 200 && body.status === "accepted") return body as MoveResult;
  throw new Error(body.error ?? "swap rejected");
}

const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

function moveFocus(from: Coordinate, keyName: string): Coordinate | null {
  const d = ARROWS[keyName];
  if (!d) return null;
  return { x: Math.min(9, Math.max(0, from.x + d[0])), y: Math.min(9, Math.max(0, from.y + d[1])) };
}

const sameCoord = (a: Coordinate, b: Coordinate) => a.x === b.x && a.y === b.y;

/** Holds the pick → (preview) → commit state and runs its effects (spec 044 US2, spec 050). */
export function useFieldInteraction(opts: FieldInteractionOptions): FieldInteractionApi {
  const [interaction, setInteraction] = useState<FieldInteraction>(IDLE);
  const [shakeAt, setShakeAt] = useState<Coordinate | null>(null);
  const [focusAt, setFocusAt] = useState<Coordinate | null>(null);
  const stateRef = useRef<FieldInteraction>(IDLE);
  const optsRef = useRef(opts);
  const priceRequest = useRef(0);
  const dispatchRef = useRef<(event: FieldEvent) => void>(() => undefined);

  useEffect(() => {
    optsRef.current = opts;
  }, [opts]);

  const ctx: FieldContext = useMemo(
    () => ({ previewEnabled: opts.previewEnabled, frozen: opts.frozenKeys, canPick: opts.canPick }),
    [opts.previewEnabled, opts.frozenKeys, opts.canPick],
  );

  const runEffect = useCallback((effect: FieldEffect) => {
    const o = optsRef.current;
    if (effect.kind === "soundPick") o.onPick();
    else if (effect.kind === "shake") {
      setShakeAt(effect.at);
      setTimeout(() => setShakeAt(null), SHAKE_MS);
    } else if (effect.kind === "notice") o.onNotice(effect.notice, effect.at);
    else if (effect.kind === "submit") {
      if (o.matchId === null) {
        o.onLocalSwap?.(effect.from, effect.to);
        o.onCommitted();
        dispatchRef.current({ type: "moveResolved" });
        return;
      }
      postMove(o.matchId, o.board, effect.from, effect.to)
        .then(() => o.onCommitted())
        .catch((error: Error) => {
          dispatchRef.current({ type: "submitRejected" });
          o.onRejected(error.message);
        });
    } else if (effect.kind === "requestPrice") {
      const id = ++priceRequest.current;
      const input = o.matchId === null
        ? { kind: "warmup" as const, board: o.board, from: effect.from, to: effect.to }
        : { kind: "match" as const, matchId: o.matchId, from: effect.from, to: effect.to };
      previewSwap(input)
        .then((result) => {
          if (id !== priceRequest.current || result.status !== "ok") return;
          dispatchRef.current({ type: "priced", price: { words: result.words ?? [], total: result.total ?? 0 } });
        })
        .catch(() => undefined);
    }
  }, []);

  const dispatch = useCallback(
    (event: FieldEvent) => {
      const { next, effects } = reduceField(stateRef.current, event, ctx);
      stateRef.current = next;
      setInteraction(next);
      effects.forEach(runEffect);
    },
    [ctx, runEffect],
  );

  useEffect(() => {
    dispatchRef.current = dispatch;
  }, [dispatch]);

  // Tapping anywhere outside the field cancels a pick (FR-025). Controls that
  // must act without cancelling — the ledger's actions — carry data-field-safe.
  const picking = interaction.kind !== "idle" && interaction.kind !== "committed";
  useEffect(() => {
    if (!picking) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest(".field") || target?.closest("[data-field-safe]")) return;
      dispatchRef.current({ type: "tapOutside" });
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [picking]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dispatchRef.current({ type: "escape" });
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const ownPins = swappedPair(interaction);
  const inPair = (c: Coordinate) => ownPins?.some((p) => sameCoord(p, c)) ?? false;
  const isPick = (c: Coordinate) => interaction.kind === "picked" && sameCoord(interaction.a, c);

  const cellStateFor = (coord: Coordinate, base: CellState): CellState => {
    if (base !== "free") return base;
    if (isPick(coord)) return "picked";
    if (interaction.kind === "preview" && inPair(coord)) return "previewed";
    return base;
  };

  const seatFor = (coord: Coordinate): Seat | null => (isPick(coord) || inPair(coord) ? "you" : null);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, coord: Coordinate) => {
      const next = moveFocus(coord, event.key);
      if (next) {
        event.preventDefault();
        setFocusAt(next);
      } else if (event.key === " ") {
        event.preventDefault();
        dispatch({ type: "tap", at: coord });
      } else if (event.key === "Enter") {
        event.preventDefault();
        dispatch(stateRef.current.kind === "preview" ? { type: "enter" } : { type: "tap", at: coord });
      }
    },
    [dispatch],
  );

  return { interaction, ownPins, shakeAt, focusAt, dispatch, cellStateFor, seatFor, onKeyDown };
}
