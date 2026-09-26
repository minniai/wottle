import type { Copy } from "@/lib/i18n/copy/types";
import type { FormGame, FormResult } from "@/lib/types/standing";

/** The most matches the lobby reads for its strip: 30 fill column A at 1440. */
export const FORM_RUN_MAX = 30;
/** A 20px cell whose left border overlaps its neighbour's right one. */
const CELL_STEP_PX = 19;

const RESULT_WORD: Record<FormResult, "win" | "loss" | "draw"> = { W: "win", L: "loss", D: "draw" };

export interface FormRunCell {
  letter: string;
  result: FormResult | null;
  game: FormGame | null;
}

/** How many cells fit a strip this wide (2026-09-26: as many as fit, never more than are read). */
export function formRunSlots(widthPx: number): number {
  const fit = Math.floor((widthPx - 1) / CELL_STEP_PX);
  return Math.min(FORM_RUN_MAX, Math.max(1, fit));
}

/** The newest `slots` matches, oldest first, padded with empty cells; the caption and summary name the count shown. */
export function formRun(games: FormGame[], slots: number, copy: Copy): { cells: FormRunCell[]; caption: string; label: string } {
  const shown = games.slice(-slots);
  const cells = Array.from({ length: slots }, (_, i): FormRunCell => {
    const game = shown[i] ?? null;
    return { letter: game ? copy.pages.FORM_LETTERS[game.result] : "", result: game?.result ?? null, game };
  });
  const count = (r: FormResult) => shown.filter((g) => g.result === r).length;
  return { cells, caption: copy.pages.lastN(slots), label: copy.pages.formRunAria(slots, count("W"), count("L"), count("D")) };
}

/** A cell's accessible name, name-safe in every language: result · opponent · score · when (once known). */
export function formCellLabel(game: FormGame, when: string | null, copy: Copy): string {
  const label = `${formResultWord(game, copy)} · ${game.opponent} · ${game.you}–${game.them}`;
  return when ? `${label} · ${when}` : label;
}

export function formResultWord(game: FormGame, copy: Copy): string {
  return copy.pages.RESULT_WORDS[RESULT_WORD[game.result]];
}

/** The card opens toward the middle of the strip, so it stays inside the column. */
export function formTipAnchor(index: number, slots: number): "start" | "end" {
  return index < slots / 2 ? "start" : "end";
}
