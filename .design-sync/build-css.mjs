// Compiles the app's Tailwind 4 CSS into one static stylesheet for design-sync.
// The app has no library build; Next.js normally compiles globals.css (+ the
// app/styles/*.css sheets imported in layouts) at build time. This reproduces
// that with the repo's own @tailwindcss/postcss plugin, then prepends the
// brand-font layer (.design-sync/fonts.css) whose @import must come first.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import postcss from "postcss";
import tailwindPostcss from "@tailwindcss/postcss";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, ".design-sync", ".cache", "compiled");
await mkdir(outDir, { recursive: true });

const sheets = [
  "app/globals.css",
  "app/styles/board.css",
  "app/styles/lobby.css",
  "app/styles/profile.css",
  "app/styles/matchmaking.css",
];

const compiled = [];
for (const rel of sheets) {
  const file = path.join(root, rel);
  const css = await readFile(file, "utf8");
  const result = await postcss([tailwindPostcss()]).process(css, { from: file });
  compiled.push(`/* === ${rel} === */\n` + result.css);
}

// Font families themselves ship as self-hosted @font-face via cfg.extraFonts
// (.design-sync/fonts/fonts.css) — a remote fonts @import here would block the
// whole stylesheet in browsers while the fetch hangs. Only the var mapping the
// app normally gets from next/font lives here.
const fontVars =
  ':root{--font-fraunces:"Fraunces";--font-jetbrains-mono:"JetBrains Mono";--font-inter:"Inter";}';

const out = fontVars + "\n" + compiled.join("\n\n");
await writeFile(path.join(outDir, "wottle.css"), out);
console.log(`wrote ${path.join(outDir, "wottle.css")} (${out.length} bytes)`);
