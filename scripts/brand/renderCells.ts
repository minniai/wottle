/**
 * Writes the favicon cells (game flow §6, spec 070 FR-006): one per locale, and a
 * `-call` variant whose letter turns the opponent's colour while a call waits.
 * One cell with a 1.5px ink frame, a 14% band in your colour, the letter, and
 * at this size the numeral and the chevron. Run: `pnpm exec tsx scripts/brand/renderCells.ts`.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { cellMark, type MarkLocale } from "../../lib/brand/lockup";

const INK = "#0F1A24";
const PAPER = "#FFFDF7";
const YOU = "#147D7A";
const OPP = "#B56A4F";
const SIZE = 48;

function svg(locale: MarkLocale, signal: "none" | "call"): string {
  const mark = cellMark(locale, signal);
  const tone = mark.tone === "you" ? YOU : OPP;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
  <rect x="0.75" y="0.75" width="${SIZE - 1.5}" height="${SIZE - 1.5}" fill="${PAPER}" stroke="${INK}" stroke-width="1.5"/>
  <rect x="2.4" y="9.6" width="43.2" height="28.8" fill="${YOU}" fill-opacity="0.14"/>
  <path d="M4.4 10.6 L8.7 24 L4.4 37.4" fill="none" stroke="${YOU}" stroke-width="1.5" stroke-linecap="square"/>
  <text x="24" y="33.5" text-anchor="middle" font-family="Zilla Slab, Georgia, serif" font-weight="600" font-size="26.4" fill="${tone}">${mark.letter}</text>
  <text x="44" y="11" text-anchor="end" font-family="Red Hat Mono, ui-monospace, monospace" font-weight="500" font-size="8.6" fill="${tone}">${mark.value}</text>
</svg>
`;
}

for (const locale of ["is", "en"] as const) {
  for (const signal of ["none", "call"] as const) {
    const file = resolve(__dirname, `../../public/brand/cell-${locale}${signal === "call" ? "-call" : ""}.svg`);
    writeFileSync(file, svg(locale, signal));
    console.log(`wrote ${file}`);
  }
}
