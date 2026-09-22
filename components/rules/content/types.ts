import type { Copy } from "@/lib/i18n/copy/types";

export interface RulesContentProps {
  /** The match clock as drawn, `5:00`. */
  clock: string;
  totalMoves: number;
  copy: Copy;
}
