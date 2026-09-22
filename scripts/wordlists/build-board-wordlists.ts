/**
 * Build the board wordlists the game loads: each language's full list
 * (`word_list_<lang>.txt`) stripped of every word longer than the board,
 * written to `word_list_<BOARD_SIZE>_<lang>.txt`.
 *
 * Run after changing BOARD_SIZE or regenerating a source list:
 *   pnpm wordlists:build          # every language with a source list
 *   pnpm wordlists:build is en    # only these
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

import { BOARD_SIZE } from "@/lib/constants/board";
import {
  boardWordlistPath,
  filterWordsForBoard,
  sourceWordlistPath,
} from "@/lib/game-engine/boardWordlist";
import type { Language } from "@/lib/types/game-config";

const LANGUAGES: Language[] = ["is", "en", "se", "no", "dk"];

function buildBoardWordlist(language: Language): void {
  const source = resolve(process.cwd(), sourceWordlistPath(language));
  if (!existsSync(source)) {
    console.warn(`skip ${language}: no source list at ${source}`);
    return;
  }
  const lines = readFileSync(source, "utf-8").split("\n");
  const words = filterWordsForBoard(lines, BOARD_SIZE);
  const target = boardWordlistPath(language, BOARD_SIZE);
  writeFileSync(resolve(process.cwd(), target), `${words.join("\n")}\n`);
  console.log(
    `${target}: ${words.length.toLocaleString()} of ${lines.length.toLocaleString()} lines`,
  );
}

function selectedLanguages(args: string[]): Language[] {
  const unknown = args.filter((arg) => !LANGUAGES.includes(arg as Language));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown language(s): ${unknown.join(", ")}. Known: ${LANGUAGES.join(", ")}`,
    );
  }
  return args.length > 0 ? (args as Language[]) : LANGUAGES;
}

for (const language of selectedLanguages(process.argv.slice(2))) {
  buildBoardWordlist(language);
}
