import { describe, expect, test, vi } from "vitest";

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  const readFileSync = (path: unknown, ...rest: unknown[]): unknown => {
    if (String(path).includes("word_list_10_en.txt")) {
      throw Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" });
    }
    return (actual.readFileSync as (...args: unknown[]) => unknown)(path, ...rest);
  };
  return { ...actual, readFileSync, default: { ...actual, readFileSync } };
});

describe("loadDictionary without the board wordlist", () => {
  test("throws and says how to build the missing list", async () => {
    const { loadDictionary, resetDictionaryCache, DictionaryLoadError } =
      await import("@/lib/game-engine/dictionary");
    resetDictionaryCache();
    const load = loadDictionary("en");
    await expect(load).rejects.toBeInstanceOf(DictionaryLoadError);
    await expect(load).rejects.toThrow(/word_list_10_en\.txt/);
    await expect(load).rejects.toThrow(/pnpm wordlists:build/);
  });
});
