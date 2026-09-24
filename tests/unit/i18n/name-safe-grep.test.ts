import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Spec 070 T113, game flow §8 item 13: in Icelandic a name appears only in the
 * nominative, never after a preposition that would inflect it, and a player
 * never takes a gendered adjective or participle.
 */
const FILES = ["lib/i18n/copy/is.ts", "lib/i18n/copy/pages.is.ts"];
const PREPOSITIONS = ["eftir", "gegn", "til", "frá", "á", "við", "handa"];
/** A template slot that holds a player's name. */
const NAME_SLOT = /name|opponent|winner|loser|player|from|requester/i;
const BANNED = [/(?<!\p{L})klár(?!\p{L})/u, /(?<!\p{L})kominn?(?!\p{L})/u, /(?<!\p{L})farinn?(?!\p{L})/u, /aftur tengd/u, /ekki laus/u, /leikur Kára/u];

const lines = FILES.flatMap((file) =>
  readFileSync(join(process.cwd(), file), "utf8")
    .split("\n")
    .map((text, i) => ({ where: `${file}:${i + 1}`, text }))
    // Comments may quote the banned forms to name them.
    .filter(({ text }) => !text.trim().startsWith("//") && !text.trim().startsWith("*")),
);

describe("Icelandic copy is name-safe (spec 070 T113)", () => {
  it("no name follows eftir, gegn, til, frá, á, við or handa", () => {
    const pattern = new RegExp(`(?<!\\p{L})(${PREPOSITIONS.join("|")})\\s+\\$\\{([^}]*)\\}`, "gu");
    const hits = lines.flatMap(({ where, text }) =>
      [...text.split("//")[0].matchAll(pattern)].filter((m) => NAME_SLOT.test(m[2])).map((m) => `${where}: ${m[0]}`),
    );
    expect(hits).toEqual([]);
  });

  it("no banned variant appears", () => {
    const hits = lines.flatMap(({ where, text }) => BANNED.filter((re) => re.test(text.split("//")[0])).map((re) => `${where}: ${re.source}`));
    expect(hits).toEqual([]);
  });
});
