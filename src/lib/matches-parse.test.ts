import { describe, expect, it } from "vitest";
import {
  ESPN_COMPETITIONS,
  apiFootballError,
  espnDatesFor,
  espnUrl,
  isFocusApiFootballLeague,
  matchesTtlMs,
  onlyLocalDate,
  parseApiFootball,
  parseEspnScoreboard,
  shiftDate,
  sortMatches,
  stockholmDate,
  type MatchItem,
} from "./matches-parse";

const comp = ESPN_COMPETITIONS.find((c) => c.slug === "eng.1")!;

const espnEvent = (
  over: Record<string, unknown> = {},
  state = "post",
  name = "STATUS_FULL_TIME",
) => ({
  id: "401",
  date: "2026-10-29T19:00Z",
  status: { displayClock: "90'+4'", type: { name, state } },
  competitions: [
    {
      competitors: [
        { homeAway: "away", score: "1", team: { displayName: "Chelsea", logo: "https://l/c.png" } },
        {
          homeAway: "home",
          score: "2",
          team: { displayName: "Liverpool", logo: "https://l/l.png" },
        },
      ],
    },
  ],
  ...over,
});

describe("parseEspnScoreboard", () => {
  it("maps a finished match with home and away in the right order", () => {
    const [m] = parseEspnScoreboard({ events: [espnEvent()] }, comp);
    expect(m).toMatchObject({
      league: "Premier League",
      home: "Liverpool",
      away: "Chelsea",
      homeScore: 2,
      awayScore: 1,
      status: "finished",
      statusText: "Slut",
      kickoff: "2026-10-29T19:00Z",
      leagueKey: "espn-eng.1",
      country: "England",
    });
    expect(m?.homeLogo).toBe("https://l/l.png");
  });

  it("maps a live match to its clock, and half time to Halvtid", () => {
    const live = parseEspnScoreboard(
      {
        events: [
          espnEvent({
            status: { displayClock: "67'", type: { name: "STATUS_IN_PROGRESS", state: "in" } },
          }),
        ],
      },
      comp,
    )[0];
    expect(live).toMatchObject({ status: "live", statusText: "67'", homeScore: 2 });

    const ht = parseEspnScoreboard({ events: [espnEvent({}, "in", "STATUS_HALFTIME")] }, comp)[0];
    expect(ht).toMatchObject({ status: "live", statusText: "Halvtid" });
  });

  it("has no score for a match that has not started", () => {
    const [m] = parseEspnScoreboard({ events: [espnEvent({}, "pre", "STATUS_SCHEDULED")] }, comp);
    expect(m).toMatchObject({
      status: "upcoming",
      homeScore: null,
      awayScore: null,
      statusText: "",
    });
  });

  it("marks postponed matches instead of showing them as played", () => {
    const [m] = parseEspnScoreboard({ events: [espnEvent({}, "post", "STATUS_POSTPONED")] }, comp);
    expect(m).toMatchObject({ status: "upcoming", statusText: "Uppskjuten", homeScore: null });
  });

  it("survives empty, partial and malformed responses", () => {
    expect(parseEspnScoreboard(null, comp)).toEqual([]);
    expect(parseEspnScoreboard({}, comp)).toEqual([]);
    expect(parseEspnScoreboard({ events: [{}, { competitions: [] }, null] }, comp)).toEqual([]);
    expect(
      parseEspnScoreboard({ events: [{ id: "1", competitions: [{ competitors: [{}] }] }] }, comp),
    ).toEqual([]);
  });
});

describe("ESPN competitions", () => {
  it("covers the focus: top 5, Allsvenskan, Portugal, Netherlands, UEFA and FIFA", () => {
    const names = ESPN_COMPETITIONS.map((c) => c.name);
    for (const n of [
      "Premier League",
      "LaLiga",
      "Serie A",
      "Bundesliga",
      "Ligue 1",
      "Allsvenskan",
      "Liga Portugal",
      "Eredivisie",
      "UEFA Champions League",
      "UEFA Europa League",
      "UEFA Conference League",
      "FIFA World Cup",
    ]) {
      expect(names).toContain(n);
    }
  });

  it("does not include Superettan or lower divisions", () => {
    expect(ESPN_COMPETITIONS.some((c) => /superettan|division|ettan/i.test(c.name))).toBe(false);
    expect(ESPN_COMPETITIONS.some((c) => c.slug === "swe.2" || c.slug === "swe.3")).toBe(false);
  });

  it("has unique slugs", () => {
    const slugs = ESPN_COMPETITIONS.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("asks ESPN for exactly one date per request (a range or limit gives HTTP 400)", () => {
    const url = espnUrl("eng.1", "2026-10-29");
    expect(url).toBe(
      "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?dates=20261029",
    );
    expect(url).not.toMatch(/dates=\d{8}-|limit=/);
  });

  it("fetches the day before only for tournaments played in the Americas", () => {
    expect(espnDatesFor("eng.1", "2026-10-29")).toEqual(["2026-10-29"]);
    expect(espnDatesFor("uefa.champions", "2026-10-29")).toEqual(["2026-10-29"]);
    expect(espnDatesFor("fifa.world", "2026-10-29")).toEqual(["2026-10-28", "2026-10-29"]);
  });
});

describe("API-Football", () => {
  const fixture = (id: number, league: Record<string, unknown>, short = "NS") => ({
    fixture: { id, date: "2026-10-29T19:00:00+01:00", status: { short, elapsed: 55 } },
    league: { logo: "l.png", ...league },
    teams: { home: { name: "A", logo: "a.png" }, away: { name: "B", logo: "b.png" } },
    goals: { home: 1, away: 0 },
  });

  it("keeps focus leagues and drops everything else (lower divisions, other countries)", () => {
    const body = {
      response: [
        fixture(1, { id: 39, name: "Premier League", country: "England" }),
        fixture(2, { id: 2, name: "UEFA Champions League", country: "World" }),
        fixture(3, { id: 114, name: "Superettan", country: "Sweden" }),
        fixture(4, { id: 74, name: "Division 1 - Södra", country: "Sweden" }),
        fixture(5, { id: 99999, name: "Random League", country: "Brazil" }),
        fixture(6, { id: 94, name: "Primeira Liga", country: "Portugal" }),
        fixture(7, { id: 88, name: "Eredivisie", country: "Netherlands" }),
      ],
    };
    const ids = parseApiFootball(body).map((m) => m.id);
    expect(ids.sort()).toEqual(["1", "2", "6", "7"]);
  });

  it("does not show a score before kickoff, and maps live and finished", () => {
    const body = {
      response: [
        fixture(1, { id: 39, name: "Premier League", country: "England" }, "NS"),
        fixture(2, { id: 39, name: "Premier League", country: "England" }, "2H"),
        fixture(3, { id: 39, name: "Premier League", country: "England" }, "FT"),
      ],
    };
    const [a, b, c] = parseApiFootball(body).sort((x, y) => x.id.localeCompare(y.id));
    expect(a).toMatchObject({ status: "upcoming", homeScore: null, awayScore: null });
    expect(b).toMatchObject({ status: "live", statusText: "55'", homeScore: 1 });
    expect(c).toMatchObject({ status: "finished", statusText: "Slut" });
  });

  it("orders by priority so the Champions League is first", () => {
    const body = {
      response: [
        fixture(1, { id: 113, name: "Allsvenskan", country: "Sweden" }),
        fixture(2, { id: 2, name: "UEFA Champions League", country: "World" }),
        fixture(3, { id: 39, name: "Premier League", country: "England" }),
      ],
    };
    expect(parseApiFootball(body).map((m) => m.id)).toEqual(["2", "3", "1"]);
  });

  it("recognises FIFA and UEFA tournaments by name when the id is unknown", () => {
    expect(
      isFocusApiFootballLeague({ id: 1234, name: "FIFA Intercontinental Cup", country: "World" }),
    ).toBe(true);
    expect(isFocusApiFootballLeague({ id: 1235, name: "Friendlies Clubs", country: "World" })).toBe(
      false,
    );
  });

  it("reports errors that arrive inside a 200 response", () => {
    expect(apiFootballError({ errors: [] })).toBeUndefined();
    expect(apiFootballError({ errors: {} })).toBeUndefined();
    expect(
      apiFootballError({ errors: { requests: "You have reached the request limit for the day" } }),
    ).toMatch(/request limit/);
    expect(
      apiFootballError({ errors: { plan: "Free plans do not have access to this date" } }),
    ).toMatch(/Free plans/);
    expect(apiFootballError(null)).toBeUndefined();
  });

  it("returns an empty list for a malformed body instead of throwing", () => {
    expect(parseApiFootball(null)).toEqual([]);
    expect(parseApiFootball({ response: "x" })).toEqual([]);
  });
});

describe("dates", () => {
  it("counts the day in Swedish time, not UTC", () => {
    // 23:30 UTC den 28:e är redan den 29:e i Sverige (sommartid/vintertid ger minst +1 h).
    expect(stockholmDate("2026-10-28T23:30:00Z")).toBe("2026-10-29");
    expect(stockholmDate("2026-10-29T10:00:00Z")).toBe("2026-10-29");
    expect(stockholmDate("garbage")).toBe("");
  });

  it("shifts dates across month and year borders", () => {
    expect(shiftDate("2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftDate("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("keeps only matches that start on the Swedish date and removes duplicates", () => {
    const mk = (id: string, kickoff: string): MatchItem => ({
      id,
      league: "L",
      home: "A",
      away: "B",
      homeScore: null,
      awayScore: null,
      status: "upcoming",
      statusText: "",
      kickoff,
      leagueKey: "k",
    });
    const list = [
      mk("a", "2026-10-28T20:00:00Z"), // 21:00/22:00 den 28:e svensk tid
      mk("b", "2026-10-29T18:00:00Z"),
      mk("b", "2026-10-29T18:00:00Z"),
      mk("c", "2026-10-29T23:30:00Z"), // redan den 30:e svensk tid
    ];
    expect(onlyLocalDate(list, "2026-10-29").map((m) => m.id)).toEqual(["b"]);
  });
});

describe("cache lifetime", () => {
  const m = (status: MatchItem["status"]): MatchItem => ({
    id: status,
    league: "L",
    home: "A",
    away: "B",
    homeScore: null,
    awayScore: null,
    status,
    statusText: "",
    kickoff: "",
    leagueKey: "k",
  });

  it("is shortest while a match is live, which keeps scores fresh", () => {
    expect(matchesTtlMs([m("live"), m("upcoming")], "2026-10-29", "2026-10-29")).toBe(45_000);
  });

  it("is longer for other days, so source quotas are not burned", () => {
    expect(matchesTtlMs([m("finished")], "2026-10-28", "2026-10-29")).toBeGreaterThan(600_000);
    expect(matchesTtlMs([m("upcoming")], "2026-10-29", "2026-10-29")).toBeGreaterThan(45_000);
  });

  it("retries an empty day soon", () => {
    expect(matchesTtlMs([], "2026-10-30", "2026-10-29")).toBeLessThanOrEqual(120_000);
  });
});

describe("sortMatches", () => {
  it("sorts by priority and then kickoff within a league", () => {
    const mk = (id: string, priority: number, kickoff: string): MatchItem => ({
      id,
      league: "L",
      home: "A",
      away: "B",
      homeScore: null,
      awayScore: null,
      status: "upcoming",
      statusText: "",
      kickoff,
      leagueKey: "k",
      priority,
    });
    const out = sortMatches([
      mk("late", 80, "2026-10-29T21:00:00Z"),
      mk("early", 80, "2026-10-29T15:00:00Z"),
      mk("top", 100, "2026-10-29T22:00:00Z"),
    ]);
    expect(out.map((x) => x.id)).toEqual(["top", "early", "late"]);
  });
});
