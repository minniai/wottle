/**
 * Next.js instrumentation hook — runs once on server startup.
 *
 * Pre-warms the Icelandic dictionary so round 1 doesn't pay
 * the ~600-1000ms cold-start cost of loading 3.7M entries.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { loadDictionary } = await import(
      "@/lib/game-engine/dictionary"
    );
    try {
      await loadDictionary("is");
    } catch {
      // Dictionary load failure is logged inside loadDictionary.
      // Don't crash the server — the game will fail gracefully
      // when a match tries to resolve its first round.
    }
  }
}
