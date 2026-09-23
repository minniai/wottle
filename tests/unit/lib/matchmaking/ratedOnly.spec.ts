import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

/**
 * Spec 048 US6 (supersedes spec 045 decision 1): there is one kind of match.
 * Nothing writes `matches.rated`; the column keeps its default. Since spec 067
 * the one writer of new matches is create_match_between.
 */
describe("rated only", () => {
  test("create_match_between never writes a rated column", () => {
    const sql = readFileSync("supabase/migrations/20260923002_match_creation.sql", "utf8");
    const insert = /insert into public\.matches\s*\(([^)]*)\)/.exec(sql);
    expect(insert).not.toBeNull();
    expect(insert![1]).not.toMatch(/\brated\b/);
  });
});
