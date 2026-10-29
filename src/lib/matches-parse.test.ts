import { describe, expect, it } from "vitest";
import {
  API_FOOTBALL_GAP_LEAGUES,
  API_FOOTBALL_PRIORITY,
  ESPN_COMPETITIONS,
  OPENLIGA_LEAGUES,
  apiFootballError,
  apiFootballTtlMs,
  espnDatesFor,
  espnUrl,
  isFocusApiFootballLeague,
  leagueGaps,
  matchesTtlMs,
  onlyLocalDate,
  openLigaSeason,
  openLigaToItems,
  openLigaUrl,
  parseApiFootball,
  parseEspnScoreboard,
  projectOpenLiga,
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

describe("expanded European coverage", () => {
  const espnNames = ESPN_COMPETITIONS.map((c) => c.name);

  it("has the second divisions of the five big countries", () => {
    for (const n of ["Championship", "2. Bundesliga", "LaLiga Hypermotion", "Serie B", "Ligue 2"]) {
      expect(espnNames).toContain(n);
    }
  });

  it("has the top leagues of the other requested countries", () => {
    for (const n of [
      "Belgian Pro League",
      "Scottish Premiership",
      "Austrian Bundesliga",
      "Greek Super League",
      "Eredivisie",
      "Liga Portugal",
    ]) {
      expect(espnNames).toContain(n);
    }
  });

  it("maps every new league to the ESPN slug that was checked against the live API", () => {
    const slugOf = (name: string) => ESPN_COMPETITIONS.find((c) => c.name === name)?.slug;
    expect(slugOf("Championship")).toBe("eng.2");
    expect(slugOf("2. Bundesliga")).toBe("ger.2");
    expect(slugOf("LaLiga Hypermotion")).toBe("esp.2");
    expect(slugOf("Serie B")).toBe("ita.2");
    expect(slugOf("Ligue 2")).toBe("fra.2");
    expect(slugOf("Belgian Pro League")).toBe("bel.1");
    expect(slugOf("Scottish Premiership")).toBe("sco.1");
    expect(slugOf("Austrian Bundesliga")).toBe("aut.1");
    expect(slugOf("Greek Super League")).toBe("gre.1");
  });

  it("ranks the new leagues below the big ones and above the domestic cups", () => {
    const pri = (name: string) => ESPN_COMPETITIONS.find((c) => c.name === name)!.priority;
    expect(pri("Championship")).toBeLessThan(pri("Eredivisie"));
    expect(pri("Ligue 2")).toBeGreaterThan(pri("Belgian Pro League"));
    for (const n of ["Championship", "Serie B", "Greek Super League", "Austrian Bundesliga"]) {
      expect(pri(n)).toBeGreaterThan(pri("FA Cup"));
    }
  });

  it("accepts the API-Football ids for all new leagues and still rejects lower Swedish divisions", () => {
    for (const id of [40, 79, 80, 141, 136, 62, 144, 179, 218, 207, 197, 106, 357]) {
      expect(isFocusApiFootballLeague({ id, name: "x", country: "x" })).toBe(true);
    }
    expect(isFocusApiFootballLeague({ id: 114, name: "Superettan", country: "Sweden" })).toBe(
      false,
    );
    expect(isFocusApiFootballLeague({ id: 107, name: "I liga", country: "Poland" })).toBe(false);
    expect(isFocusApiFootballLeague({ id: 41, name: "League One", country: "England" })).toBe(
      false,
    );
  });

  it("keeps API-Football priorities in line with ESPN for the same competitions", () => {
    expect(API_FOOTBALL_PRIORITY[40]).toBe(
      ESPN_COMPETITIONS.find((c) => c.slug === "eng.2")!.priority,
    );
    expect(API_FOOTBALL_PRIORITY[144]).toBe(
      ESPN_COMPETITIONS.find((c) => c.slug === "bel.1")!.priority,
    );
    expect(API_FOOTBALL_PRIORITY[218]).toBe(
      ESPN_COMPETITIONS.find((c) => c.slug === "aut.1")!.priority,
    );
  });

  it("keeps Polish, Swiss and Irish matches from API-Football", () => {
    const fixture = (id: number, league: Record<string, unknown>) => ({
      fixture: { id, date: "2026-10-30T19:00:00+01:00", status: { short: "NS" } },
      league: { logo: "l.png", ...league },
      teams: { home: { name: "A" }, away: { name: "B" } },
      goals: { home: null, away: null },
    });
    const body = {
      response: [
        fixture(1, { id: 106, name: "Ekstraklasa", country: "Poland" }),
        fixture(2, { id: 207, name: "Super League", country: "Switzerland" }),
        fixture(3, { id: 357, name: "Premier Division", country: "Ireland" }),
        fixture(4, { id: 107, name: "I liga", country: "Poland" }),
      ],
    };
    expect(
      parseApiFootball(body)
        .map((m) => m.league)
        .sort(),
    ).toEqual(["Ekstraklasa", "Premier Division", "Super League"]);
  });
});

describe("league gaps", () => {
  it("lists the leagues ESPN lacks when API-Football does not answer", () => {
    expect(leagueGaps(false, true)).toEqual([
      "Ekstraklasa (Polen)",
      "Super League (Schweiz)",
      "Premier Division (Irland)",
    ]);
  });

  it("also lists 3. Liga when neither OpenLigaDB nor API-Football answers", () => {
    expect(leagueGaps(false, false)).toContain("3. Liga");
    expect(leagueGaps(false, false)).toHaveLength(Object.keys(API_FOOTBALL_GAP_LEAGUES).length);
  });

  it("is empty when API-Football works", () => {
    expect(leagueGaps(true, false)).toEqual([]);
    expect(leagueGaps(true, true)).toEqual([]);
  });
});

describe("apiFootballTtlMs", () => {
  const item = (status: MatchItem["status"], kickoff: string): MatchItem => ({
    id: kickoff + status,
    league: "x",
    home: "a",
    away: "b",
    homeScore: null,
    awayScore: null,
    status,
    statusText: "",
    kickoff,
    leagueKey: "k",
  });
  const now = Date.parse("2026-10-30T17:00:00Z");

  it("keeps other days for hours, since the quota is small", () => {
    expect(apiFootballTtlMs([], "2026-10-31", "2026-10-30", now)).toBe(3 * 3_600_000);
  });

  it("is short while a match is on", () => {
    expect(
      apiFootballTtlMs([item("live", "2026-10-30T16:00:00Z")], "2026-10-30", "2026-10-30", now),
    ).toBe(90_000);
  });

  it("expires when the next match starts so the status does not lag", () => {
    const ttl = apiFootballTtlMs(
      [item("upcoming", "2026-10-30T17:05:00Z")],
      "2026-10-30",
      "2026-10-30",
      now,
    );
    expect(ttl).toBe(5 * 60_000 + 30_000);
  });

  it("uses 15 minutes when nothing is about to start", () => {
    expect(
      apiFootballTtlMs([item("upcoming", "2026-10-30T20:00:00Z")], "2026-10-30", "2026-10-30", now),
    ).toBe(15 * 60_000);
    expect(apiFootballTtlMs([], "2026-10-30", "2026-10-30", now)).toBe(15 * 60_000);
  });
});

describe("OpenLigaDB (3. Liga)", () => {
  const raw = (over: Record<string, unknown> = {}) => ({
    matchID: 84850,
    matchDateTimeUTC: "2026-10-30T18:00:00Z",
    matchIsFinished: false,
    matchResults: [],
    goals: [],
    team1: { teamName: "Fortuna Düsseldorf", teamIconUrl: "https://i/d.png" },
    team2: { teamName: "SV Meppen", teamIconUrl: "" },
    ...over,
  });
  const result = (type: number, a: number, b: number) => ({
    resultTypeID: type,
    pointsTeam1: a,
    pointsTeam2: b,
  });
  const league = OPENLIGA_LEAGUES[0]!;
  const kickoff = Date.parse("2026-10-30T18:00:00Z");

  it("builds the season URL and picks the season that starts in July", () => {
    expect(openLigaUrl("bl3", 2026)).toBe("https://api.openligadb.de/getmatchdata/bl3/2026");
    expect(openLigaSeason("2026-10-30")).toBe(2026);
    expect(openLigaSeason("2026-07-01")).toBe(2026);
    expect(openLigaSeason("2027-03-14")).toBe(2026);
    expect(openLigaSeason("2026-06-30")).toBe(2025);
  });

  it("keeps only what is needed and skips broken entries", () => {
    const list = projectOpenLiga([
      raw({ matchResults: [result(1, 0, 1), result(2, 4, 1)] }),
      raw({ matchID: 2, team1: undefined }),
      { nope: true },
    ]);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: 84850,
      home: "Fortuna Düsseldorf",
      away: "SV Meppen",
      homeLogo: "https://i/d.png",
      final: [4, 1],
    });
    expect(list[0]?.awayLogo).toBeUndefined();
    expect(projectOpenLiga(null)).toEqual([]);
  });

  it("maps an upcoming match without a score", () => {
    const [m] = openLigaToItems(
      projectOpenLiga([raw()]),
      league,
      "2026-10-30",
      kickoff - 3_600_000,
    );
    expect(m).toMatchObject({
      id: "ol-84850",
      league: "3. Liga",
      status: "upcoming",
      homeScore: null,
      awayScore: null,
      leagueKey: "openliga-bl3",
      country: "Germany",
    });
    expect(m?.priority).toBe(54);
  });

  it("marks a started, unfinished match as live with the score after the last goal", () => {
    const goals = [
      { goalID: 1, scoreTeam1: 0, scoreTeam2: 1 },
      { goalID: 3, scoreTeam1: 2, scoreTeam2: 1 },
      { goalID: 2, scoreTeam1: 1, scoreTeam2: 1 },
    ];
    const [m] = openLigaToItems(
      projectOpenLiga([raw({ goals })]),
      league,
      "2026-10-30",
      kickoff + 60 * 60_000,
    );
    expect(m).toMatchObject({ status: "live", statusText: "LIVE", homeScore: 2, awayScore: 1 });
  });

  it("shows 0-0 for a live match without goals", () => {
    const [m] = openLigaToItems(
      projectOpenLiga([raw()]),
      league,
      "2026-10-30",
      kickoff + 10 * 60_000,
    );
    expect(m).toMatchObject({ status: "live", homeScore: 0, awayScore: 0 });
  });

  it("uses the final result for a finished match", () => {
    const list = projectOpenLiga([
      raw({ matchIsFinished: true, matchResults: [result(1, 0, 1), result(2, 4, 1)] }),
    ]);
    const [m] = openLigaToItems(list, league, "2026-10-30", kickoff + 5 * 3_600_000);
    expect(m).toMatchObject({ status: "finished", statusText: "Slut", homeScore: 4, awayScore: 1 });
  });

  it("treats a long-overdue match with a known score as finished, not live forever", () => {
    const goals = [{ goalID: 1, scoreTeam1: 1, scoreTeam2: 0 }];
    const [m] = openLigaToItems(
      projectOpenLiga([raw({ goals })]),
      league,
      "2026-10-30",
      kickoff + 5 * 3_600_000,
    );
    expect(m).toMatchObject({ status: "finished", homeScore: 1, awayScore: 0 });
  });

  it("only returns matches that start on the given day in Swedish time", () => {
    // 23:30 UTC den 29:e är 00:30 svensk tid den 30:e (vintertid efter 25 oktober).
    const list = projectOpenLiga([
      raw({ matchID: 1, matchDateTimeUTC: "2026-10-29T23:30:00Z" }),
      raw({ matchID: 2, matchDateTimeUTC: "2026-10-30T22:30:00Z" }),
      raw({ matchID: 3, matchDateTimeUTC: "2026-10-30T23:30:00Z" }),
    ]);
    const ids = openLigaToItems(list, league, "2026-10-30", 0).map((m) => m.id);
    expect(ids).toEqual(["ol-1", "ol-2"]);
  });
});
