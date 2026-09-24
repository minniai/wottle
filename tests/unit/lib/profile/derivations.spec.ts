import { describe, expect, it } from "vitest";

import { copyEn } from "@/lib/i18n/copy/en";
import { copyIs } from "@/lib/i18n/copy/is";
import { chartSeries } from "@/lib/profile/chartSeries";
import { profileHeader } from "@/lib/profile/profileHeader";
import { recordCells } from "@/lib/profile/record";
import { toProfileWords } from "@/lib/profile/bestWords";
import { weekChange } from "@/lib/profile/weekChange";
import type { ProfileView } from "@/lib/types/profile";

const NOW = new Date("2026-09-24T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

function view(extra: Partial<ProfileView> = {}): ProfileView {
  return {
    playerId: "p", handle: "birna", displayName: "Birna", language: "en", rating: 1212, peak: 1216, weekChange: 16, matches: 35,
    firstPlayedAt: "2026-03-04T10:00:00Z", record: { won: 20, lost: 15, drawn: 0, winRate: 20 / 35 }, lastTen: [], chart: [], chartEmpty: true, bestWords: [],
    otherLanguage: { language: "is", rating: 1200, matches: 0 }, matchesList: [], presence: null, ...extra,
  };
}

/** Spec 072 T058: the profile's sub-lines, record, week change, chart and best words. */
describe("profileHeader", () => {
  it("names the handle, the month they started and the matches; then rating, language, peak and the week", () => {
    expect(profileHeader(view(), copyEn, "english")).toEqual({
      subLeft: "@birna · playing since march 2026 · 35 matches",
      subRight: "rating · english · peak 1216 · +16 this week",
    });
    expect(profileHeader(view({ weekChange: -4 }), copyEn, "english").subRight).toBe("rating · english · peak 1216 · −4 this week");
  });

  it("drops the week when nothing changed", () => {
    expect(profileHeader(view({ weekChange: 0 }), copyEn, "english").subRight).toBe("rating · english · peak 1216");
  });

  it("reads a new player plainly", () => {
    expect(profileHeader(view({ matches: 0, firstPlayedAt: null, rating: 1200, peak: 1200, weekChange: 0 }), copyEn, "english")).toEqual({
      subLeft: "@birna",
      subRight: "1200 · rating · english · no matches yet",
    });
  });

  it("reads in Icelandic", () => {
    expect(profileHeader(view(), copyIs, "íslenska").subLeft).toBe("@birna · spilar síðan mars 2026 · 35 viðureignir");
  });
});

describe("recordCells", () => {
  it("counts won, lost, drawn and the win rate over every match", () => {
    expect(recordCells({ won: 20, lost: 15, drawn: 0, winRate: 20 / 35 }, copyEn)).toEqual([
      { value: "20", label: "won" }, { value: "15", label: "lost" }, { value: "0", label: "drawn" }, { value: "57%", label: "win rate" },
    ]);
    expect(recordCells({ won: 5, lost: 3, drawn: 2, winRate: 0.5 }, copyEn)[3].value).toBe("50%");
    expect(recordCells({ won: 0, lost: 0, drawn: 0, winRate: null }, copyEn)[3].value).toBe("—");
  });
});

describe("weekChange", () => {
  it("is the current rating less the rating a week ago", () => {
    const events = [{ at: daysAgo(10), before: 1200, after: 1196 }, { at: daysAgo(3), before: 1196, after: 1205 }, { at: daysAgo(1), before: 1205, after: 1212 }];
    expect(weekChange(events, 1212, NOW)).toBe(16);
  });

  it("uses the first rating in the week when there is none before it", () => {
    expect(weekChange([{ at: daysAgo(2), before: 1200, after: 1208 }], 1208, NOW)).toBe(8);
    expect(weekChange([], 1200, NOW)).toBe(0);
  });
});

describe("chartSeries", () => {
  it("starts at the rating 30 days ago, then one point per match in the window, and ends today", () => {
    const events = [{ at: daysAgo(40), before: 1200, after: 1190 }, { at: daysAgo(20), before: 1190, after: 1201 }, { at: daysAgo(5), before: 1201, after: 1212 }];
    const series = chartSeries(events, 1212, NOW);
    expect(series.empty).toBe(false);
    expect(series.points.map((p) => p.rating)).toEqual([1190, 1201, 1212, 1212]);
    expect(series.points[0].at).toBe(daysAgo(30));
    expect(series.points.at(-1)!.at).toBe(NOW.toISOString());
  });

  it("is a flat line at the current rating with no match in the window", () => {
    const series = chartSeries([{ at: daysAgo(40), before: 1200, after: 1212 }], 1212, NOW);
    expect(series).toEqual({ empty: true, points: [{ at: daysAgo(30), rating: 1212 }, { at: NOW.toISOString(), rating: 1212 }] });
  });
});

describe("toProfileWords", () => {
  it("spells each word in cells with their values, three at most", () => {
    const words = toProfileWords([{ word: "hestar", points: 32 }, { word: "BORÐA", points: 29 }, { word: "SKÍRN", points: 24 }, { word: "TAK", points: 10 }], "is");
    expect(words).toHaveLength(3);
    expect(words[0].word).toBe("HESTAR");
    expect(words[0].tiles.map((t) => t.letter).join("")).toBe("HESTAR");
    expect(words[0].tiles.every((t) => t.value > 0)).toBe(true);
  });
});
