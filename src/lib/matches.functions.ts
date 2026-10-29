import { createServerFn } from "@tanstack/react-start";
import { footballFetch } from "./api/football-client";
import {
  API_FOOTBALL_GAP_LEAGUES,
  ESPN_COMPETITIONS,
  OPENLIGA_LEAGUES,
  apiFootballError,
  apiFootballTtlMs,
  espnDatesFor,
  espnUrl,
  leagueGaps,
  leagueKeyOf,
  matchesTtlMs,
  onlyLocalDate,
  openLigaSeason,
  openLigaToItems,
  openLigaUrl,
  parseApiFootball,
  parseEspnScoreboard,
  projectOpenLiga,
  sortMatches,
  stockholmDate,
  type MatchItem,
  type OpenLigaMatch,
} from "./matches-parse";
import { Breaker, Inflight, TtlCache, fetchWithTimeout, runPool } from "./tm-net";

export type { MatchItem } from "./matches-parse";

export type SourceName = "api-football" | "espn" | "openligadb" | "livescore" | "football-data";

export type SourceReport = {
  source: SourceName;
  ok: boolean;
  count: number;
  /** Kort förklaring på svenska när källan inte gav något. Aldrig nycklar eller hemligheter. */
  reason?: string;
};

export type MatchesResult = {
  /** Första källan som bidrog med matcher, eller "none". */
  source: SourceName | "none";
  /** Alla källor som bidrog. Sidan kombinerar flera för att täcka alla ligor. */
  sources: SourceName[];
  /** Ligor som just nu saknar fungerande källa, så att sidan kan säga det rakt ut. */
  gaps: string[];
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
const apiCache = new TtlCache(60, 4 * 1024 * 1024);
const openLigaCache = new TtlCache(8, 4 * 1024 * 1024);
const inflight = new Inflight();
const apiFootballBreaker = new Breaker();
const espnBreaker = new Breaker();
const openLigaBreaker = new Breaker();
/** Senaste riktiga felet från API-Football, så att det syns även medan källan är pausad. */
let apiFootballLastError = "";

const SOURCE_TIMEOUT_MS = 8000;
const ESPN_CONCURRENCY = 10;

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
    return fail(
      "api-football",
      `Pausad en stund efter ett fel${apiFootballLastError ? `: ${apiFootballLastError}` : " (kvot eller nyckel)"}.`,
    );
  }

  const failWith = (reason: string, pauseMs = 0): Fetched => {
    apiFootballLastError = reason;
    if (pauseMs) apiFootballBreaker.open(pauseMs);
    return fail("api-football", reason);
  };

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
      return failWith("Nyckeln avvisades.", 10 * 60_000);
    }
    if (!res.ok) return failWith(`Svarade ${res.status}.`);

    const body: any = await res.json().catch(() => null);
    const err = apiFootballError(body);
    if (err) {
      // 200-svar med fel: dagskvot slut, plan utan åtkomst till datumet, ogiltig nyckel m.m.
      return failWith(
        `API-Football: ${err}`,
        /limit|quota|token|key|suspend/i.test(err) ? 10 * 60_000 : 0,
      );
    }
    if (!Array.isArray(body?.response)) return failWith("Oväntat svar.");

    apiFootballLastError = "";
    const items = parseApiFootball(body);
    return { items, report: { source: "api-football", ok: true, count: items.length } };
  } catch (e) {
    return failWith(e instanceof Error ? e.message : "Okänt fel.");
  }
}

/**
 * API-Football har en liten dagskvot (100 anrop på gratisnivån), så svaret delas länge. ESPN bär
 * de vanliga ligorna och uppdateras ofta. API-Football behövs bara för ligor ESPN saknar.
 */
async function fromApiFootballCached(date: string): Promise<Fetched | null> {
  const key = `api:${date}`;
  const hit = apiCache.get<Fetched>(key);
  if (hit) return hit;
  return inflight.run(key, async () => {
    const r = await fromApiFootball(date);
    if (r?.report.ok) {
      const ttl = apiFootballTtlMs(r.items, date, stockholmDate(new Date()), Date.now());
      apiCache.set(key, r, ttl);
    }
    return r;
  });
}

// ESPN: öppen resultatfeed utan nyckel. Fungerar även när ingen API-nyckel finns eller kvoten är slut.
async function fromEspn(date: string): Promise<Fetched> {
  if (espnBreaker.isOpen()) return fail("espn", "Pausad en stund efter ett fel.");

  const requests = ESPN_COMPETITIONS.flatMap((comp) =>
    espnDatesFor(comp.slug, date).map((d) => ({ comp, url: espnUrl(comp.slug, d) })),
  );

  let okCount = 0;
  const all: MatchItem[] = [];
  await runPool(requests, ESPN_CONCURRENCY, async ({ comp, url }) => {
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
  });

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

// OpenLigaDB: öppet och nyckelfritt, används för 3. Liga som ESPN saknar.
async function fetchOpenLigaSeason(shortcut: string, season: number): Promise<OpenLigaMatch[]> {
  const key = `${shortcut}:${season}`;
  const hit = openLigaCache.get<OpenLigaMatch[]>(key);
  if (hit) return hit;
  return inflight.run(`openliga:${key}`, async () => {
    const res = await fetchWithTimeout(
      openLigaUrl(shortcut, season),
      { headers: { accept: "application/json" } },
      SOURCE_TIMEOUT_MS,
    );
    if (res.status !== 200) throw new Error(`Svarade ${res.status}.`);
    const list = projectOpenLiga(await res.json());
    if (list.length === 0) throw new Error("Tom säsong i svaret.");
    openLigaCache.set(key, list, 60_000);
    return list;
  });
}

async function fromOpenLiga(date: string): Promise<Fetched> {
  if (openLigaBreaker.isOpen()) return fail("openligadb", "Pausad en stund efter ett fel.");
  try {
    const season = openLigaSeason(date);
    const now = Date.now();
    const lists = await Promise.all(
      OPENLIGA_LEAGUES.map(async (league) =>
        openLigaToItems(await fetchOpenLigaSeason(league.shortcut, season), league, date, now),
      ),
    );
    const items = sortMatches(lists.flat());
    return { items, report: { source: "openligadb", ok: true, count: items.length } };
  } catch (e) {
    openLigaBreaker.open(60_000);
    return fail("openligadb", e instanceof Error ? e.message : "Okänt fel.");
  }
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

/**
 * Ligorna kommer från flera källor som kompletterar varandra:
 * - ESPN bär nästan allt (nyckelfritt, uppdateras ofta).
 * - OpenLigaDB ger 3. Liga.
 * - API-Football ger Ekstraklasa, Schweiz och Irland, som ESPN saknar. Om ESPN inte svarar alls
 *   tar API-Football över för alla ligor.
 */
async function loadMatches(date: string): Promise<MatchesResult> {
  const hasAnyKey = Boolean(
    process.env["API_FOOTBALL_KEY"] ||
    process.env["API_SPORTS_KEY"] ||
    process.env["RAPIDAPI_KEY"] ||
    process.env["LIVESCORE_API_URL"] ||
    process.env["FOOTBALL_DATA_TOKEN"],
  );

  const [api, espn, openLiga] = await Promise.all([
    fromApiFootballCached(date),
    fromEspn(date),
    fromOpenLiga(date),
  ]);

  const reports: SourceReport[] = [];
  if (api) reports.push(api.report);
  reports.push(espn.report, openLiga.report);

  const parts: { source: SourceName; items: MatchItem[] }[] = [];
  if (espn.items.length > 0) parts.push({ source: "espn", items: espn.items });
  if (openLiga.items.length > 0) parts.push({ source: "openligadb", items: openLiga.items });
  if (api && api.items.length > 0) {
    const apiItems = api.items.filter((m) => {
      if (!espn.report.ok) return true; // ESPN nere: API-Football täcker allt
      if (m.leagueId == null || !(m.leagueId in API_FOOTBALL_GAP_LEAGUES)) return false;
      // 3. Liga kommer från OpenLigaDB när den fungerar. Undvik dubbletter.
      return !(m.leagueId === 80 && openLiga.report.ok);
    });
    if (apiItems.length > 0) parts.push({ source: "api-football", items: apiItems });
  }

  // Reserver om inget gav matcher: de gamla valfria källorna, en i taget.
  if (parts.length === 0) {
    for (const attempt of [() => fromLivescore(date), () => fromFootballData(date)]) {
      const r = await attempt();
      if (!r) continue;
      reports.push(r.report);
      if (r.items.length > 0) {
        parts.push({ source: r.report.source, items: r.items });
        break;
      }
    }
  }

  // Ligor som just nu saknar fungerande källa. Sidan ska säga det i stället för att tiga.
  const gaps = leagueGaps(Boolean(api?.report.ok), openLiga.report.ok);

  const anyOk = reports.some((r) => r.ok);
  const items = sortMatches(parts.flatMap((p) => p.items));
  const now = new Date().toISOString();
  const first = parts[0];

  return {
    source: first ? first.source : "none",
    sources: parts.map((p) => p.source),
    gaps,
    matches: items,
    isLiveSource: items.length > 0,
    missingConfig: items.length === 0 && !hasAnyKey && !anyOk,
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
      // OpenLigaDB räknas inte: den täcker bara 3. Liga, så tom lista därifrån säger inget om resten.
      const mainWorked = result.diagnostics.some(
        (d) => d.ok && (d.source === "espn" || d.source === "api-football"),
      );
      const anySourceWorked = result.diagnostics.some((d) => d.ok);

      if (!mainWorked) {
        // Huvudkällorna svarar inte. Äldre fullständig data visas hellre än en urholkad lista.
        const old = lastGood.get<MatchesResult>(key);
        if (old) return { ...old, stale: true, diagnostics: result.diagnostics };
        // Inget äldre finns. Visa det som finns, men cacha bara kort så nästa besök försöker igen.
        if (result.matches.length > 0) fresh.set(key, result, 20_000);
        return result;
      }

      if (result.matches.length > 0) {
        const ttl = matchesTtlMs(result.matches, data, stockholmDate(new Date()));
        fresh.set(key, result, ttl);
        lastGood.set(key, result, 6 * 3_600_000);
        return result;
      }

      // Källorna svarade men gav inga matcher: en riktigt tom dag ska visas som tom.
      if (anySourceWorked) {
        fresh.set(key, result, matchesTtlMs([], data, stockholmDate(new Date())));
      }
      return result;
    });
  });
