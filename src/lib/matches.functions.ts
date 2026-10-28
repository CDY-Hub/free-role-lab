import { createServerFn } from "@tanstack/react-start";
import { footballFetch } from "./api/football-client";

export type MatchItem = {
  id: string;
  league: string;
  leagueId?: number;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  status: "live" | "finished" | "upcoming";
  statusText: string;
  kickoff: string; // ISO eller "HH:MM"
  homeLogo?: string;
  awayLogo?: string;
  leagueLogo?: string;
  /** Landets namn (eller "World"/"Europe" för internationella tävlingar) */
  country?: string;
  /** URL till landets flagga */
  countryFlag?: string;
  /** Unik nyckel per tävling så att t.ex. italienska och brasilianska "Serie A" inte slås ihop */
  leagueKey: string;
  priority?: number;
};

const leagueKeyOf = (id: unknown, country: unknown, name: unknown) =>
  id != null && id !== "" ? `id-${String(id)}` : `${String(country ?? "")}-${String(name ?? "")}`;

const dateStr = (d: unknown) => {
  if (typeof d !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    throw new Error("Ogiltigt datum");
  }
  return d;
};

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const PRIORITY_LEAGUES: Record<number, number> = {
  2: 100, // UEFA Champions League
  3: 95, // UEFA Europa League
  848: 90, // UEFA Conference League
  531: 89, // UEFA Super Cup
  39: 85, // Premier League
  140: 80, // La Liga
  135: 75, // Serie A
  78: 70, // Bundesliga
  61: 65, // Ligue 1
  113: 60, // Allsvenskan
  115: 55, // Superettan
  45: 50, // FA Cup
  48: 48, // EFL Cup
  143: 45, // Copa del Rey
  137: 44, // Coppa Italia
  81: 43, // DFB-Pokal
  66: 42, // Coupe de France
  114: 41, // Svenska Cupen
};

// api-football.com / API-Sports v3
async function fromApiFootball(date: string): Promise<MatchItem[] | null> {
  const key =
    process.env["API_FOOTBALL_KEY"] || process.env["API_SPORTS_KEY"] || process.env["RAPIDAPI_KEY"];
  if (!key) return null;

  try {
    const isRapid = Boolean(process.env["RAPIDAPI_KEY"]);
    const headers: Record<string, string> = isRapid
      ? {
          "x-rapidapi-key": key,
          "x-rapidapi-host": "v3.football.api-sports.io",
        }
      : { "x-apisports-key": key };

    const res = await footballFetch(`https://v3.football.api-sports.io/fixtures?date=${date}`, {
      headers,
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) return null;

    const body: any = await res.json().catch(() => null);
    if (!Array.isArray(body?.response)) return null;

    const list: MatchItem[] = body.response.map((item: any) => {
      const f = item.fixture ?? {};
      const l = item.league ?? {};
      const t = item.teams ?? {};
      const g = item.goals ?? {};

      const short = String(f.status?.short ?? "").toUpperCase();
      let status: MatchItem["status"] = "upcoming";
      if (["1H", "2H", "HT", "ET", "BT", "P", "LIVE", "INT"].includes(short)) {
        status = "live";
      } else if (["FT", "AET", "PEN"].includes(short)) {
        status = "finished";
      }

      const statusText =
        short === "HT"
          ? "Halvtid"
          : short === "FT"
            ? "Slut"
            : short === "1H" || short === "2H"
              ? `${f.status?.elapsed ?? ""}'`
              : short === "NS"
                ? ""
                : short;

      const prio = PRIORITY_LEAGUES[l.id] ?? (l.country === "Sweden" ? 50 : 10);

      return {
        id: String(f.id ?? `${t.home?.name}-${t.away?.name}`),
        league: String(l.name ?? "Okänd liga"),
        leagueId: l.id,
        home: String(t.home?.name ?? "Hemmalag"),
        away: String(t.away?.name ?? "Bortalag"),
        homeScore: num(g.home),
        awayScore: num(g.away),
        status,
        statusText,
        kickoff: typeof f.date === "string" ? f.date : "",
        homeLogo: t.home?.logo,
        awayLogo: t.away?.logo,
        leagueLogo: l.logo,
        ...(typeof l.country === "string" ? { country: l.country } : {}),
        ...(typeof l.flag === "string" ? { countryFlag: l.flag } : {}),
        leagueKey: leagueKeyOf(l.id, l.country, l.name),
        priority: prio,
      };
    });

    list.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    return list;
  } catch {
    return null;
  }
}

// Livescore-servern (egen driftad livescore-api) – används om LIVESCORE_API_URL är satt.
async function fromLivescore(date: string): Promise<MatchItem[] | null> {
  const base = process.env["LIVESCORE_API_URL"];
  if (!base) return null;

  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/matches?date=${date}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;

    const body: any = await res.json().catch(() => null);
    if (!body?.matches) return null;

    return (body.matches as any[]).map((m) => {
      const st = String(m.status ?? "").toUpperCase();
      const status: MatchItem["status"] =
        st === "FT" || st === "AET" || st === "PEN"
          ? "finished"
          : st === "NS" || st === "TBD" || st === "POSTP" || st === "CANC"
            ? "upcoming"
            : "live";

      const k = String(m.kickoff ?? "");
      const kickoff = k.length >= 12 ? `${k.slice(8, 10)}:${k.slice(10, 12)}` : "";

      return {
        id: String(m.match_id ?? `${m.home}-${m.away}`),
        league: String(m.league ?? "Okänd liga"),
        leagueKey: leagueKeyOf(null, m.country, m.league),
        ...(typeof m.country === "string" ? { country: m.country } : {}),
        home: String(m.home ?? ""),
        away: String(m.away ?? ""),
        homeScore: num(m.home_scores),
        awayScore: num(m.away_scores),
        status,
        statusText: st,
        kickoff,
      };
    });
  } catch {
    return null;
  }
}

// football-data.org v4 – gratisnivå, kräver FOOTBALL_DATA_TOKEN.
async function fromFootballData(date: string): Promise<MatchItem[] | null> {
  const token = process.env["FOOTBALL_DATA_TOKEN"];
  if (!token) return null;

  try {
    const res = await fetch(
      `https://api.football-data.org/v4/matches?dateFrom=${date}&dateTo=${date}`,
      {
        headers: {
          "X-Auth-Token": token,
          accept: "application/json",
        },
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!res.ok) return null;

    const body: any = await res.json().catch(() => null);
    return ((body?.matches ?? []) as any[]).map((m) => {
      const st = String(m.status ?? "").toUpperCase();
      const status: MatchItem["status"] =
        st === "FINISHED" ? "finished" : st === "IN_PLAY" || st === "PAUSED" ? "live" : "upcoming";

      return {
        id: String(m.id),
        league: String(m.competition?.name ?? "Okänd liga"),
        leagueKey: leagueKeyOf(m.competition?.id, m.area?.name, m.competition?.name),
        ...(typeof m.area?.name === "string" ? { country: m.area.name } : {}),
        ...(typeof m.area?.flag === "string" ? { countryFlag: m.area.flag } : {}),
        home: String(m.homeTeam?.name ?? ""),
        away: String(m.awayTeam?.name ?? ""),
        homeScore: num(m.score?.fullTime?.home),
        awayScore: num(m.score?.fullTime?.away),
        status,
        statusText: st === "IN_PLAY" ? "LIVE" : st === "PAUSED" ? "HT" : st,
        kickoff: typeof m.utcDate === "string" ? m.utcDate : "",
      };
    });
  } catch {
    return null;
  }
}

const flag = (code: string) => `https://flagcdn.com/w40/${code}.png`;

const DEMO_COUNTRY: Record<string, { country: string; flag?: string }> = {
  "UEFA Champions League": { country: "Europe" },
  "Premier League": { country: "England", flag: flag("gb-eng") },
  LaLiga: { country: "Spain", flag: flag("es") },
  Allsvenskan: { country: "Sweden", flag: flag("se") },
  "Serie A": { country: "Italy", flag: flag("it") },
  Bundesliga: { country: "Germany", flag: flag("de") },
};

type DemoMatch = Omit<MatchItem, "leagueKey" | "country" | "countryFlag">;

function getCuratedDemoMatches(date: string): MatchItem[] {
  const base: DemoMatch[] = [
    {
      id: "ucl-1",
      league: "UEFA Champions League",
      home: "Real Madrid",
      away: "Bayern München",
      homeScore: 2,
      awayScore: 1,
      status: "finished",
      statusText: "Slut",
      kickoff: `${date}T20:00:00Z`,
    },
    {
      id: "ucl-2",
      league: "UEFA Champions League",
      home: "Arsenal",
      away: "Paris Saint-Germain",
      homeScore: 2,
      awayScore: 0,
      status: "finished",
      statusText: "Slut",
      kickoff: `${date}T20:00:00Z`,
    },
    {
      id: "epl-1",
      league: "Premier League",
      home: "Liverpool",
      away: "Chelsea",
      homeScore: 2,
      awayScore: 1,
      status: "finished",
      statusText: "Slut",
      kickoff: `${date}T16:30:00Z`,
    },
    {
      id: "epl-2",
      league: "Premier League",
      home: "Manchester City",
      away: "Tottenham",
      homeScore: 1,
      awayScore: 1,
      status: "live",
      statusText: "78'",
      kickoff: `${date}T18:30:00Z`,
    },
    {
      id: "laliga-1",
      league: "LaLiga",
      home: "Barcelona",
      away: "Sevilla",
      homeScore: 5,
      awayScore: 1,
      status: "finished",
      statusText: "Slut",
      kickoff: `${date}T21:00:00Z`,
    },
    {
      id: "laliga-2",
      league: "LaLiga",
      home: "Atlético Madrid",
      away: "Real Sociedad",
      homeScore: 1,
      awayScore: 0,
      status: "upcoming",
      statusText: "21:00",
      kickoff: `${date}T21:00:00Z`,
    },
    {
      id: "allsv-1",
      league: "Allsvenskan",
      home: "Malmö FF",
      away: "AIK",
      homeScore: 2,
      awayScore: 1,
      status: "finished",
      statusText: "Slut",
      kickoff: `${date}T15:00:00Z`,
    },
    {
      id: "allsv-2",
      league: "Allsvenskan",
      home: "Hammarby",
      away: "Djurgården",
      homeScore: 2,
      awayScore: 0,
      status: "finished",
      statusText: "Slut",
      kickoff: `${date}T17:30:00Z`,
    },
    {
      id: "seriea-1",
      league: "Serie A",
      home: "Inter",
      away: "Juventus",
      homeScore: 4,
      awayScore: 4,
      status: "finished",
      statusText: "Slut",
      kickoff: `${date}T19:45:00Z`,
    },
    {
      id: "buli-1",
      league: "Bundesliga",
      home: "Bayer Leverkusen",
      away: "Eintracht Frankfurt",
      homeScore: 2,
      awayScore: 1,
      status: "finished",
      statusText: "Slut",
      kickoff: `${date}T14:30:00Z`,
    },
  ];
  return base.map((m) => {
    const c = DEMO_COUNTRY[m.league];
    return {
      ...m,
      leagueKey: leagueKeyOf(null, c?.country, m.league),
      ...(c ? { country: c.country } : {}),
      ...(c?.flag ? { countryFlag: c.flag } : {}),
    };
  });
}

export const matchesByDate = createServerFn({ method: "GET" })
  .inputValidator(dateStr)
  .handler(async ({ data }: { data: string }) => {
    // 1. Try api-football.com (v3)
    const apiFootball = await fromApiFootball(data);
    if (apiFootball && apiFootball.length > 0) {
      return {
        source: "api-football" as const,
        matches: apiFootball,
        isLiveSource: true,
      };
    }

    // 2. Try custom livescore server
    const ls = await fromLivescore(data);
    if (ls && ls.length > 0) {
      return {
        source: "livescore" as const,
        matches: ls,
        isLiveSource: true,
      };
    }

    // 3. Try football-data.org
    const fd = await fromFootballData(data);
    if (fd && fd.length > 0) {
      return {
        source: "football-data" as const,
        matches: fd,
        isLiveSource: true,
      };
    }

    // 4. Graceful fallback with top matches and clear config guidance
    return {
      source: "preview" as const,
      matches: getCuratedDemoMatches(data),
      isLiveSource: false,
      missingConfig: true,
    };
  });
