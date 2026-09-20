"use client";

import type { CSSProperties } from "react";

import { Field } from "@/components/room/Field";
import type { CellState } from "@/components/room/FieldCell";
import type { Seat } from "@/lib/constants/seatColors";
import { same } from "@/lib/room/fieldInteraction";
import type { Coordinate } from "@/lib/types/board";
import type { FrozenTileMap } from "@/lib/types/match";
import { CROSSING_BANDS, RULES_BOARD, SWAP_PINS, WORD_BANDS, type RulesFigureKind } from "./figures";

const SIZE = 300;

function frozenFrom(kind: RulesFigureKind): FrozenTileMap {
  const bands = kind === "words" ? WORD_BANDS : kind === "crossing" ? CROSSING_BANDS : [];
  const map: FrozenTileMap = {};
  for (const band of bands) for (const c of band.cells) map[`${c.x},${c.y}`] = { owner: band.seat === "you" ? "player_a" : "player_b" };
  return map;
}

const pinned = (at: Coordinate): boolean => SWAP_PINS.some((p) => same(p, at));

/** A 300px field drawn in the room's grammar, with a caption for the reader and none for AT. */
export function RulesFigure({ kind, caption }: { kind: RulesFigureKind; caption: string }) {
  const bands = kind === "words" ? WORD_BANDS : kind === "crossing" ? CROSSING_BANDS : [];
  return (
    <figure className="rules__figure" data-testid={`rules-figure-${kind}`}>
      <div className="rules__field" style={{ "--field-size": `${SIZE}px` } as CSSProperties} aria-hidden="true" inert>
        <Field
          board={RULES_BOARD}
          viewerSlot="player_a"
          frozenTiles={frozenFrom(kind)}
          ownerNames={{ player_a: "you", player_b: "the opponent" }}
          bands={bands}
          disabled
          cellStateFor={kind === "swap" ? (at: Coordinate, base: CellState) => (pinned(at) ? "pinned" : base) : undefined}
          seatFor={kind === "swap" ? (at: Coordinate): Seat | null => (pinned(at) ? "you" : null) : undefined}
        />
      </div>
      <figcaption className="rules__caption">{caption}</figcaption>
    </figure>
  );
}
