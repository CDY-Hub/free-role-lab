import { createServerFn } from "@tanstack/react-start";

export type MatchItem = {
  id: string;
  league: string;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  status: "live" | "finished" | "upcoming";
  statusText: string;
  kickoff: string; // ISO eller "HH:MM"
};

const dateStr = (d: unknown) => {
  if (typeof d !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error("Ogiltigt datum");
  return d;
};

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Livescore-servern (egen driftad livescore-api) – används om LIVESCORE_API_URL är satt.
async function fromLivescore(date: string): Promise<MatchItem[] | null> {
  const base = process.env.LIVESCORE_API_URL;
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
        st === "FT" || st === "AET" || st === "PEN" ? "finished" : st === "NS" || st === "TBD" || st === "POSTP" || st === "CANC" ? "upcoming" : "live";
      const k = String(m.kickoff ?? "");
      const kickoff = k.length >= 12 ? `${k.slice(8, 10)}:${k.slice(10, 12)}` : "";
      return {
        id: String(m.match_id ?? `${m.home}-${m.away}`),
        league: String(m.league ?? "Okänd liga"),
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
    return null; // faller tillbaka på football-data.org
  }
}

// football-data.org v4 – gratisnivå, kräver FOOTBALL_DATA_TOKEN.
async function fromFootballData(date: string): Promise<MatchItem[]> {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) throw new Error("Ingen matchkälla är kopplad ännu – lägg till en nyckel för football-data.org eller drifta livescore-servern.");
  const res = await fetch(`https://api.football-data.org/v4/matches?dateFrom=${date}&dateTo=${date}`, {
    headers: { "X-Auth-Token": token, accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Matchtjänsten svarade ${res.status}. Försök igen om en stund.`);
  const body: any = await res.json().catch(() => null);
  return ((body?.matches ?? []) as any[]).map((m) => {
    const st = String(m.status ?? "").toUpperCase();
    const status: MatchItem["status"] =
      st === "FINISHED" ? "finished" : st === "IN_PLAY" || st === "PAUSED" ? "live" : "upcoming";
    return {
      id: String(m.id),
      league: String(m.competition?.name ?? "Okänd liga"),
      home: String(m.homeTeam?.name ?? ""),
      away: String(m.awayTeam?.name ?? ""),
      homeScore: num(m.score?.fullTime?.home),
      awayScore: num(m.score?.fullTime?.away),
      status,
      statusText: st === "IN_PLAY" ? "LIVE" : st === "PAUSED" ? "HT" : st,
      kickoff: typeof m.utcDate === "string" ? m.utcDate : "",
    };
  });
}

export const matchesByDate = createServerFn({ method: "GET" })
  .inputValidator(dateStr)
  .handler(async ({ data }) => {
    const ls = await fromLivescore(data);
    if (ls) return { source: "livescore" as const, matches: ls };
    return { source: "football-data" as const, matches: await fromFootballData(data) };
  });
