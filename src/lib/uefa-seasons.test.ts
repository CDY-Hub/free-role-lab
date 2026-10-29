import { describe, expect, it } from "vitest";
import { SEASON_COMPETITIONS, getDecades, isCurrentSeason } from "./uefa-seasons";

const labels = (slug: string) => getDecades(slug).flatMap((d) => d.seasons.map((s) => s.label));

describe("UEFA seasons", () => {
  it.each(["champions-league", "europa-league", "conference-league"])(
    "%s includes the 2026–27 season first",
    (slug) => {
      expect(labels(slug)[0]).toBe("2026–27");
      expect(getDecades(slug)[0]?.seasons[0]?.wikiPage).toMatch(/^2026–27 UEFA /);
    },
  );

  it("keeps the earlier Champions League and Europa League history", () => {
    expect(labels("champions-league")).toContain("1955–56");
    expect(labels("champions-league")).toContain("2025–26");
    expect(labels("europa-league")).toContain("1971–72");
    expect(labels("europa-league")).toContain("2025–26");
  });

  it("gives the Conference League every season from 2021–22 to 2026–27, like the others", () => {
    expect(labels("conference-league")).toEqual([
      "2026–27",
      "2025–26",
      "2024–25",
      "2023–24",
      "2022–23",
      "2021–22",
    ]);
  });

  it("uses the name the competition had in each Conference League season", () => {
    const pages = getDecades("conference-league").flatMap((d) => d.seasons.map((s) => s.wikiPage));
    expect(pages).toContain("2021–22 UEFA Europa Conference League");
    expect(pages).toContain("2023–24 UEFA Europa Conference League");
    expect(pages).toContain("2024–25 UEFA Conference League");
    expect(pages).toContain("2026–27 UEFA Conference League");
  });

  it("has no duplicate seasons and only valid Wikipedia titles", () => {
    for (const slug of SEASON_COMPETITIONS) {
      const l = labels(slug);
      expect(new Set(l).size).toBe(l.length);
      for (const d of getDecades(slug)) {
        for (const s of d.seasons) {
          expect(s.wikiPage).toMatch(/^[\w ()%,.'`\-–]+$/u);
        }
      }
    }
  });

  it("returns nothing for competitions without a season picker", () => {
    expect(getDecades("supercupen")).toEqual([]);
  });

  it("recognises the ongoing season", () => {
    const oct2026 = new Date("2026-10-29T12:00:00Z");
    expect(isCurrentSeason("2026–27", oct2026)).toBe(true);
    expect(isCurrentSeason("2025–26", oct2026)).toBe(false);
    const mar2027 = new Date("2027-03-01T12:00:00Z");
    expect(isCurrentSeason("2026–27", mar2027)).toBe(true);
  });
});
