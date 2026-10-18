import { describe, expect, it } from "vitest";
import { isLeagueSearch, matchingLeagues } from "@/lib/leagues";

describe("League searches", () => {
  it("finds Superettan with its real Transfermarkt competition id", () => {
    expect(matchingLeagues(" Superettan ")).toEqual([{ id: "SE2", name: "Superettan", country: "Sverige" }]);
  });

  it("avoids person searches for an exact league name regardless of case", () => {
    expect(isLeagueSearch(" SUPERETTAN ")).toBe(true);
    expect(isLeagueSearch("Gyökeres")).toBe(false);
    expect(isLeagueSearch("super")).toBe(false);
  });

  it("only fetches the selected league while an unfiltered view retains all seven", () => {
    expect(matchingLeagues("Superettan").map((league) => league.id)).toEqual(["SE2"]);
    expect(matchingLeagues("")).toHaveLength(7);
  });
});