import { describe, expect, it } from "vitest";
import { isLeagueSearch, matchingLeagues } from "@/lib/leagues";

describe("League searches", () => {
  it.each(["La liga", "la liga", "LA LIGA", "LaLiga", " la  liga ", "La-liga"])("finds the Spanish league for %s without searching people", (query) => {
    expect(matchingLeagues(query).map((league) => league.id)).toEqual(["ES1"]);
    expect(isLeagueSearch(query)).toBe(true);
  });

  it.each([
    ["PremierLeague", "GB1"],
    ["SerieA", "IT1"],
    ["Ligue1", "FR1"],
    ["Bundes liga", "L1"],
    ["Allsvenskan", "SE1"],
    ["Superettan", "SE2"],
    ["Liga NOS", "PO1"],
    ["Eredivisie", "NL1"],
  ])("finds %s even when word spacing differs", (query, id) => {
    expect(matchingLeagues(query).map((league) => league.id)).toEqual([id]);
    expect(isLeagueSearch(query)).toBe(true);
  });

  it("finds Superettan with its real Transfermarkt competition id", () => {
    expect(matchingLeagues(" Superettan ")).toEqual([{ id: "SE2", name: "Superettan", country: "Sverige" }]);
  });

  it("avoids person searches for an exact league name regardless of case", () => {
    expect(isLeagueSearch(" SUPERETTAN ")).toBe(true);
    expect(isLeagueSearch("Gyökeres")).toBe(false);
    expect(isLeagueSearch("super")).toBe(false);
  });

  it("only fetches the selected league while an unfiltered view retains all nine", () => {
    expect(matchingLeagues("Superettan").map((league) => league.id)).toEqual(["SE2"]);
    expect(matchingLeagues("")).toHaveLength(9);
  });
});