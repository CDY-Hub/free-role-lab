import { describe, expect, it } from "vitest";
import { LEAGUES, isLeagueSearch, matchingLeagues } from "@/lib/leagues";

describe("League searches", () => {
  it.each(["La liga", "la liga", "LA LIGA", "LaLiga", " la  liga ", "La-liga"])(
    "finds the Spanish league for %s without searching people",
    (query) => {
      expect(matchingLeagues(query).map((league) => league.id)).toEqual(["ES1"]);
      expect(isLeagueSearch(query)).toBe(true);
    },
  );

  it.each([
    ["PremierLeague", "GB1"],
    ["SerieA", "IT1"],
    ["Ligue1", "FR1"],
    ["Bundes liga", "L1"],
    ["Allsvenskan", "SE1"],
    ["Liga NOS", "PO1"],
    ["Eredivisie", "NL1"],
  ])("finds %s even when word spacing differs", (query, id) => {
    expect(matchingLeagues(query).map((league) => league.id)).toEqual([id]);
    expect(isLeagueSearch(query)).toBe(true);
  });

  it("covers exactly the focus leagues", () => {
    expect(LEAGUES.map((league) => league.id).sort()).toEqual(
      ["FR1", "GB1", "IT1", "L1", "ES1", "NL1", "PO1", "SE1"].sort(),
    );
  });

  it.each(["Superettan", "Ettan Norra", "Ettan Södra", "Division 1", "Championship", "LaLiga 2"])(
    "no longer offers lower divisions such as %s",
    (query) => {
      expect(matchingLeagues(query)).toEqual([]);
      expect(isLeagueSearch(query)).toBe(false);
    },
  );

  it("avoids person searches for an exact league name regardless of case", () => {
    expect(isLeagueSearch(" ALLSVENSKAN ")).toBe(true);
    expect(isLeagueSearch("Gyökeres")).toBe(false);
    expect(isLeagueSearch("super")).toBe(false);
  });

  it("only fetches the selected league while an unfiltered view retains all leagues", () => {
    expect(matchingLeagues("Allsvenskan").map((league) => league.id)).toEqual(["SE1"]);
    expect(matchingLeagues("")).toHaveLength(LEAGUES.length);
  });
});
