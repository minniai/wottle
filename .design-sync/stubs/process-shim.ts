// Browser shim for module-level `process.env` reads (e.g. lib/constants/app.ts).
// Next.js inlines these at build time; the design-sync esbuild bundle only
// defines process.env.NODE_ENV, so provide the rest. Imported first in ds-entry.
const g = globalThis as unknown as { process?: { env: Record<string, string | undefined> } };
if (typeof g.process === "undefined") {
  g.process = { env: {} };
} else if (typeof g.process.env === "undefined") {
  g.process.env = {};
}
export {};
