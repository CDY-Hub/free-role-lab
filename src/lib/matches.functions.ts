import { createServerFn } from "@tanstack/react-start";
import { footballFetch } from "./api/football-client";
import {
  ESPN_COMPETITIONS,
  apiFootballError,
  espnDatesFor,
  espnUrl,
  leagueKeyOf,
  matchesTtlMs,
  onlyLocalDate,
  parseApiFootball,
  parseEspnScoreboard,
  sortMatches,
  stockholmDate,
  type MatchItem,
} from "./matches-parse";
import { Breaker, Inflight, TtlCache, fetchWithTimeout } from "./tm-net";

export type { MatchItem } from "./matches-parse";

export type SourceName = "api-football" | "espn" | "livescore" | "football-data";

export type SourceReport = {
  source: SourceName;
  ok: boolean;
  count: number;
  /** Kort förklaring på svenska när källan inte gav något. Aldrig nycklar eller hemligheter. */
  reason?: string;
};

export type MatchesResult = {
  source: SourceName | "none";
  matches: MatchItem[];
  isLiveSource: boolean;
  /** Ingen nyckel finns inställd och ingen källa gav matcher. */
  missingConfig: boolean;
  /** Visar senast hämtade data eftersom alla källor svarade fel just nu. */
  stale: boolean;
  fetchedAt: string;
  diagnostics: SourceReport[];
};

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

// ─── Cache ─────────────────────────────────────────────────────────────────────
// Utan servercache anropade varje besökare, varje minut och varje datum, källorna direkt. Då
// tog API-Footballs dagskvot (100 anrop) slut och sidan blev tom. Nu delas ett svar mellan alla.
const fresh = new TtlCache(200, 8 * 1024 * 1024);
const lastGood = new TtlCache(200, 8 * 1024 * 1024);
const inflight = new Inflight();
const apiFootballBreaker = new Breaker();
const espnBreaker = new Breaker();

const SOURCE_TIMEOUT_MS = 8000;

type Fetched = { items: MatchItem[]; report: SourceReport };

function fail(source: SourceName, reason: string): Fetched {
  return { items: [], report: { source, ok: false, count: 0, reason } };
}

// api-football.com / API-Sports v3
async function fromApiFootball(date: string): Promise<Fetched | null> {
  const key =
    process.env["API_FOOTBALL_KEY"] || process.env["API_SPORTS_KEY"] || process.env["RAPIDAPI_KEY"];
  if (!key) return null;
  if (apiFootballBreaker.isOpen()) {
    return fail("api-football", "Pausad en stund efter ett fel (kvot eller nyckel).");
  }

  try {
    const isRapid = Boolean(process.env["RAPIDAPI_KEY"]) && !process.env["API_FOOTBALL_KEY"];
    const headers: Record<string, string> = isRapid
      ? { "x-rapidapi-key": key, "x-rapidapi-host": "v3.football.api-sports.io" }
      : { "x-apisports-key": key };

    const res = await footballFetch(
      `https://v3.football.api-sports.io/fixtures?date=${date}&timezone=Europe/Stockholm`,
      { headers, signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS) },
    );

    if (res.status === 401 || res.status === 403) {
      apiFootballBreaker.open(10 * 60_000);
      return fail("api-football", "Nyckeln avvisades.");
    }
    if (!res.ok) return fail("api-football", `Svarade ${res.status}.`);

    const body: any = await res.json().catch(() => null);
    const err = apiFootballError(body);
    if (err) {
      // 200-svar med fel: dagskvot slut, plan utan åtkomst till datumet, ogiltig nyckel m.m.
      if (/limit|quota|token|key|suspend/i.test(err)) apiFootballBreaker.open(10 * 60_000);
      return fail("api-football", `API-Football: ${err}`);
    }
    if (!Array.isArray(body?.response)) return fail("api-football", "Oväntat svar.");

    const items = parseApiFootball(body);
    return { items, report: { source: "api-football", ok: true, count: items.length } };
  } catch (e) {
    return fail("api-football", e instanceof Error ? e.message : "Okänt fel.");
  }
}

// ESPN: öppen resultatfeed utan nyckel. Fungerar även när ingen API-nyckel finns eller kvoten är slut.
async function fromEspn(date: string): Promise<Fetched> {
  if (espnBreaker.isOpen()) return fail("espn", "Pausad en stund efter ett fel.");

  const requests = ESPN_COMPETITIONS.flatMap((comp) =>
    espnDatesFor(comp.slug, date).map((d) => ({ comp, url: espnUrl(comp.slug, d) })),
  );

  let okCount = 0;
  const all: MatchItem[] = [];
  await Promise.all(
    requests.map(async ({ comp, url }) => {
      try {
        const res = await fetchWithTimeout(
          url,
          { headers: { accept: "application/json" } },
          SOURCE_TIMEOUT_MS,
        );
        // Bara HTTP 200 räknas som ett svar. Allt annat (400, 404, 5xx) betyder att vi inte vet
        // vilka matcher som spelas, och får aldrig tolkas som "inga matcher".
        if (res.status !== 200) return;
        const body = await res.json().catch(() => null);
        if (!body || !Array.isArray(body.events)) return;
        okCount++;
        all.push(...parseEspnScoreboard(body, comp));
      } catch {
        /* en tävling som hänger ska inte ta ner resten */
      }
    }),
  );

  if (okCount === 0) {
    espnBreaker.open(60_000);
    return fail("espn", "Kunde inte nå ESPN.");
  }
  const items = sortMatches(onlyLocalDate(all, date));
  const missed = requests.length - okCount;
  return {
    items,
    report: {
      source: "espn",
      ok: true,
      count: items.length,
      ...(missed > 0 ? { reason: `${missed} av ${requests.length} anrop svarade inte.` } : {}),
    },
  };
}

// Livescore-servern (egen driftad livescore-api) – används om LIVESCORE_API_URL är satt.
async function fromLivescore(date: string): Promise<Fetched | null> {
  const base = process.env["LIVESCORE_API_URL"];
  if (!base) return null;

  try {
    const res = await fetchWithTimeout(
      `${base.replace(/\/$/, "")}/matches?date=${date}`,
      { headers: { accept: "application/json" } },
      SOURCE_TIMEOUT_MS,
    );
    if (!res.ok) return fail("livescore", `Svarade ${res.status}.`);

    const body: any = await res.json().catch(() => null);
    if (!body?.matches) return fail("livescore", "Oväntat svar.");

    const items = (body.matches as any[]).map((m): MatchItem => {
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
    return { items, report: { source: "livescore", ok: true, count: items.length } };
  } catch (e) {
    return fail("livescore", e instanceof Error ? e.message : "Okänt fel.");
  }
}

// football-data.org v4 – gratisnivå, kräver FOOTBALL_DATA_TOKEN.
async function fromFootballData(date: string): Promise<Fetched | null> {
  const token = process.env["FOOTBALL_DATA_TOKEN"];
  if (!token) return null;

  try {
    const res = await fetchWithTimeout(
      `https://api.football-data.org/v4/matches?dateFrom=${date}&dateTo=${date}`,
      { headers: { "X-Auth-Token": token, accept: "application/json" } },
      SOURCE_TIMEOUT_MS,
    );
    if (!res.ok) return fail("football-data", `Svarade ${res.status}.`);

    const body: any = await res.json().catch(() => null);
    const items = ((body?.matches ?? []) as any[]).map((m): MatchItem => {
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
        homeScore: status === "upcoming" ? null : num(m.score?.fullTime?.home),
        awayScore: status === "upcoming" ? null : num(m.score?.fullTime?.away),
        status,
        statusText: st === "IN_PLAY" ? "LIVE" : st === "PAUSED" ? "HT" : st,
        kickoff: typeof m.utcDate === "string" ? m.utcDate : "",
      };
    });
    return { items, report: { source: "football-data", ok: true, count: items.length } };
  } catch (e) {
    return fail("football-data", e instanceof Error ? e.message : "Okänt fel.");
  }
}

async function loadMatches(date: string): Promise<MatchesResult> {
  const reports: SourceReport[] = [];
  const hasAnyKey = Boolean(
    process.env["API_FOOTBALL_KEY"] ||
    process.env["API_SPORTS_KEY"] ||
    process.env["RAPIDAPI_KEY"] ||
    process.env["LIVESCORE_API_URL"] ||
    process.env["FOOTBALL_DATA_TOKEN"],
  );

  const attempts: (() => Promise<Fetched | null>)[] = [
    () => fromApiFootball(date),
    () => fromEspn(date),
    () => fromLivescore(date),
    () => fromFootballData(date),
  ];

  // Första källan som ger matcher vinner. En källa som svarar "inga matcher" räknas som ett svar
  // men vi provar nästa, eftersom tom dag i en källa ofta bara betyder att den saknar täckning.
  let best: { source: SourceName; items: MatchItem[] } | null = null;
  let anyOk = false;
  for (const attempt of attempts) {
    const r = await attempt();
    if (!r) continue;
    reports.push(r.report);
    if (r.report.ok) anyOk = true;
    if (r.items.length > 0) {
      best = { source: r.report.source, items: r.items };
      break;
    }
  }

  const now = new Date().toISOString();
  if (best) {
    return {
      source: best.source,
      matches: best.items,
      isLiveSource: true,
      missingConfig: false,
      stale: false,
      fetchedAt: now,
      diagnostics: reports,
    };
  }

  return {
    source: "none",
    matches: [],
    isLiveSource: false,
    missingConfig: !hasAnyKey && !anyOk,
    stale: false,
    fetchedAt: now,
    diagnostics: reports,
  };
}

export const matchesByDate = createServerFn({ method: "GET" })
  .inputValidator(dateStr)
  .handler(async ({ data }: { data: string }): Promise<MatchesResult> => {
    const key = `matches:${data}`;
    const hit = fresh.get<MatchesResult>(key);
    if (hit) return hit;

    return inflight.run(key, async () => {
      const result = await loadMatches(data);
      const anySourceWorked = result.diagnostics.some((d) => d.ok);

      if (result.matches.length > 0) {
        const ttl = matchesTtlMs(result.matches, data, stockholmDate(new Date()));
        fresh.set(key, result, ttl);
        lastGood.set(key, result, 6 * 3_600_000);
        return result;
      }

      // Ingen källa gav matcher. Fanns det äldre data visas den hellre än en tom sida,
      // men bara om källorna misslyckades. En riktigt tom dag ska visas som tom.
      if (!anySourceWorked) {
        const old = lastGood.get<MatchesResult>(key);
        if (old) return { ...old, stale: true, diagnostics: result.diagnostics };
        return result; // misslyckande cachas inte, så nästa besök försöker igen direkt
      }

      fresh.set(key, result, matchesTtlMs([], data, stockholmDate(new Date())));
      return result;
    });
  });
