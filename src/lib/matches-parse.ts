/**
 * Rena funktioner för matchdata: tolkar svar från olika källor till samma form och avgör vilka
 * tävlingar som hör hemma på sajten. Ingen nätverksåtkomst här, så allt går att testa.
 */

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

export const leagueKeyOf = (id: unknown, country: unknown, name: unknown) =>
  id != null && id !== "" ? `id-${String(id)}` : `${String(country ?? "")}-${String(name ?? "")}`;

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const flag = (code: string) => `https://flagcdn.com/w40/${code}.png`;

/** Datum (YYYY-MM-DD) för en tidpunkt i svensk tid. Sajten räknar dagar i svensk tid. */
export function stockholmDate(d: Date | string | number): string {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─── Vilka tävlingar som visas ────────────────────────────────────────────────
// Fokus: de fem stora ligorna, Allsvenskan, Portugal, Nederländerna, UEFA- och FIFA-turneringar,
// ligornas inhemska cuper, andradivisionerna i de fem stora länderna (Championship, 2. Bundesliga,
// 3. Liga, LaLiga Hypermotion, Serie B, Ligue 2) samt högsta ligan i Belgien, Skottland, Österrike,
// Schweiz, Grekland, Polen och Irland.

/** Prioritet per API-Football-id (högre visas högre upp). */
export const API_FOOTBALL_PRIORITY: Record<number, number> = {
  1: 99, // FIFA World Cup
  15: 97, // FIFA Club World Cup
  2: 100, // UEFA Champions League
  3: 95, // UEFA Europa League
  848: 90, // UEFA Conference League
  531: 89, // UEFA Super Cup
  4: 88, // UEFA European Championship
  5: 87, // UEFA Nations League
  960: 86, // Euro qualification
  32: 85.5, // World Cup qualification, Europe
  39: 85, // Premier League
  140: 80, // La Liga
  135: 75, // Serie A
  78: 70, // Bundesliga
  61: 65, // Ligue 1
  113: 60, // Allsvenskan
  94: 58, // Liga Portugal
  88: 56, // Eredivisie
  40: 55, // Championship
  79: 54.8, // 2. Bundesliga
  141: 54.6, // LaLiga Hypermotion
  136: 54.4, // Serie B
  62: 54.2, // Ligue 2
  80: 54, // 3. Liga
  144: 53.5, // Belgian Pro League
  179: 53, // Scottish Premiership
  218: 52.5, // Austrian Bundesliga
  207: 52.2, // Swiss Super League
  197: 52, // Greek Super League
  106: 51.5, // Ekstraklasa
  357: 51, // League of Ireland Premier Division
  45: 50, // FA Cup
  48: 48, // EFL Cup
  143: 45, // Copa del Rey
  137: 44, // Coppa Italia
  81: 43, // DFB-Pokal
  66: 42, // Coupe de France
  96: 40, // Taça de Portugal
  90: 39, // KNVB Beker
  10: 30, // Internationella vänskapsmatcher
};

/**
 * Ligor som ESPN saknar eller inte har data för. De hämtas från API-Football (Ekstraklasa, Swiss
 * Super League, League of Ireland) eller OpenLigaDB (3. Liga) så länge ESPN fungerar.
 */
export const API_FOOTBALL_GAP_LEAGUES: Record<number, string> = {
  80: "3. Liga",
  106: "Ekstraklasa (Polen)",
  207: "Super League (Schweiz)",
  357: "Premier Division (Irland)",
};

/** Ligor utan fungerande källa just nu. 3. Liga täcks av OpenLigaDB eller API-Football. */
export function leagueGaps(apiOk: boolean, openLigaOk: boolean): string[] {
  return Object.entries(API_FOOTBALL_GAP_LEAGUES)
    .filter(([id]) => !(apiOk || (Number(id) === 80 && openLigaOk)))
    .map(([, name]) => name);
}

const FIFA_UEFA_NAME = /^(fifa |world cup|uefa (nations|euro|super)|euro championship)/i;

export function isFocusApiFootballLeague(l: {
  id?: unknown;
  name?: unknown;
  country?: unknown;
}): boolean {
  if (typeof l.id === "number" && l.id in API_FOOTBALL_PRIORITY) return true;
  if (l.country === "World" || l.country === "Europe") {
    return FIFA_UEFA_NAME.test(String(l.name ?? ""));
  }
  return false;
}

/** Fel som API-Football skickar inuti ett 200-svar (kvot slut, ogiltig nyckel, plan utan åtkomst). */
export function apiFootballError(body: any): string | undefined {
  const e = body?.errors;
  if (!e) return undefined;
  const values = Array.isArray(e) ? e : Object.values(e);
  const text = values.map(String).filter(Boolean).join("; ");
  return text || undefined;
}

export function parseApiFootball(body: any): MatchItem[] {
  if (!Array.isArray(body?.response)) return [];
  const list: MatchItem[] = [];
  for (const item of body.response) {
    const f = item.fixture ?? {};
    const l = item.league ?? {};
    const t = item.teams ?? {};
    const g = item.goals ?? {};
    if (!isFocusApiFootballLeague(l)) continue;

    const short = String(f.status?.short ?? "").toUpperCase();
    let status: MatchItem["status"] = "upcoming";
    if (["1H", "2H", "HT", "ET", "BT", "P", "LIVE", "INT"].includes(short)) status = "live";
    else if (["FT", "AET", "PEN"].includes(short)) status = "finished";

    const statusText =
      short === "HT"
        ? "Halvtid"
        : short === "FT" || short === "AET" || short === "PEN"
          ? "Slut"
          : short === "1H" || short === "2H" || short === "ET"
            ? `${f.status?.elapsed ?? ""}'`
            : short === "NS"
              ? ""
              : short === "PST"
                ? "Uppskjuten"
                : short === "CANC"
                  ? "Inställd"
                  : short;

    list.push({
      id: String(f.id ?? `${t.home?.name}-${t.away?.name}`),
      league: String(l.name ?? "Okänd liga"),
      leagueId: l.id,
      home: String(t.home?.name ?? "Hemmalag"),
      away: String(t.away?.name ?? "Bortalag"),
      homeScore: status === "upcoming" ? null : num(g.home),
      awayScore: status === "upcoming" ? null : num(g.away),
      status,
      statusText,
      kickoff: typeof f.date === "string" ? f.date : "",
      homeLogo: t.home?.logo,
      awayLogo: t.away?.logo,
      leagueLogo: l.logo,
      ...(typeof l.country === "string" ? { country: l.country } : {}),
      ...(typeof l.flag === "string" ? { countryFlag: l.flag } : {}),
      leagueKey: leagueKeyOf(l.id, l.country, l.name),
      priority: API_FOOTBALL_PRIORITY[l.id as number] ?? 10,
    });
  }
  return sortMatches(list);
}

// ─── ESPN (nyckelfri reservkälla) ──────────────────────────────────────────────
export type EspnComp = {
  slug: string;
  name: string;
  country: string;
  flag?: string;
  priority: number;
};

export const ESPN_COMPETITIONS: EspnComp[] = [
  // FIFA och UEFA
  { slug: "fifa.world", name: "FIFA World Cup", country: "World", priority: 99 },
  { slug: "fifa.cwc", name: "FIFA Club World Cup", country: "World", priority: 97 },
  { slug: "uefa.champions", name: "UEFA Champions League", country: "Europe", priority: 100 },
  { slug: "uefa.europa", name: "UEFA Europa League", country: "Europe", priority: 95 },
  { slug: "uefa.europa.conf", name: "UEFA Conference League", country: "Europe", priority: 90 },
  { slug: "uefa.super_cup", name: "UEFA Super Cup", country: "Europe", priority: 89 },
  { slug: "uefa.euro", name: "UEFA European Championship", country: "Europe", priority: 88 },
  { slug: "uefa.nations", name: "UEFA Nations League", country: "Europe", priority: 87 },
  { slug: "uefa.euroq", name: "Euro qualification", country: "Europe", priority: 86 },
  {
    slug: "fifa.worldq.uefa",
    name: "World Cup qualification, Europe",
    country: "Europe",
    priority: 85.5,
  },
  {
    slug: "fifa.friendly",
    name: "Internationella vänskapsmatcher",
    country: "World",
    priority: 30,
  },
  // Ligor
  { slug: "eng.1", name: "Premier League", country: "England", flag: flag("gb-eng"), priority: 85 },
  { slug: "esp.1", name: "LaLiga", country: "Spain", flag: flag("es"), priority: 80 },
  { slug: "ita.1", name: "Serie A", country: "Italy", flag: flag("it"), priority: 75 },
  { slug: "ger.1", name: "Bundesliga", country: "Germany", flag: flag("de"), priority: 70 },
  { slug: "fra.1", name: "Ligue 1", country: "France", flag: flag("fr"), priority: 65 },
  { slug: "swe.1", name: "Allsvenskan", country: "Sweden", flag: flag("se"), priority: 60 },
  { slug: "por.1", name: "Liga Portugal", country: "Portugal", flag: flag("pt"), priority: 58 },
  { slug: "ned.1", name: "Eredivisie", country: "Netherlands", flag: flag("nl"), priority: 56 },
  // Andradivisioner i de fem stora länderna
  {
    slug: "eng.2",
    name: "Championship",
    country: "England",
    flag: flag("gb-eng"),
    priority: 55,
  },
  {
    slug: "ger.2",
    name: "2. Bundesliga",
    country: "Germany",
    flag: flag("de"),
    priority: 54.8,
  },
  {
    slug: "esp.2",
    name: "LaLiga Hypermotion",
    country: "Spain",
    flag: flag("es"),
    priority: 54.6,
  },
  { slug: "ita.2", name: "Serie B", country: "Italy", flag: flag("it"), priority: 54.4 },
  { slug: "fra.2", name: "Ligue 2", country: "France", flag: flag("fr"), priority: 54.2 },
  // Högsta ligan i övriga europeiska länder
  {
    slug: "bel.1",
    name: "Belgian Pro League",
    country: "Belgium",
    flag: flag("be"),
    priority: 53.5,
  },
  {
    slug: "sco.1",
    name: "Scottish Premiership",
    country: "Scotland",
    flag: flag("gb-sct"),
    priority: 53,
  },
  {
    slug: "aut.1",
    name: "Austrian Bundesliga",
    country: "Austria",
    flag: flag("at"),
    priority: 52.5,
  },
  {
    slug: "gre.1",
    name: "Greek Super League",
    country: "Greece",
    flag: flag("gr"),
    priority: 52,
  },
  // Inhemska cuper
  { slug: "eng.fa", name: "FA Cup", country: "England", flag: flag("gb-eng"), priority: 50 },
  {
    slug: "eng.league_cup",
    name: "EFL Cup",
    country: "England",
    flag: flag("gb-eng"),
    priority: 48,
  },
  {
    slug: "esp.copa_del_rey",
    name: "Copa del Rey",
    country: "Spain",
    flag: flag("es"),
    priority: 45,
  },
  {
    slug: "ita.coppa_italia",
    name: "Coppa Italia",
    country: "Italy",
    flag: flag("it"),
    priority: 44,
  },
  { slug: "ger.dfb_pokal", name: "DFB-Pokal", country: "Germany", flag: flag("de"), priority: 43 },
  {
    slug: "fra.coupe_de_france",
    name: "Coupe de France",
    country: "France",
    flag: flag("fr"),
    priority: 42,
  },
];

/**
 * ESPN tar emot exakt ett datum per anrop (`dates=YYYYMMDD`). Ett spann som `20261028-20261030`
 * eller en extra `limit` ger HTTP 400, och det var det som gjorde att matchlistan alltid var tom.
 */
export function espnUrl(slug: string, date: string): string {
  return `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${date.replace(/-/g, "")}`;
}

/**
 * Vilka ESPN-dygn som behövs för en svensk dag. Europeiska tävlingar spelas inom samma dygn.
 * Turneringar i Amerika kan ha matcher som sparas under föregående dygn men startar efter
 * midnatt hos oss, så de hämtas även för dagen före. Därefter filtrerar onlyLocalDate på svensk dag.
 */
const AMERICAS_SLUGS = new Set(["fifa.world", "fifa.cwc", "fifa.friendly"]);

export function espnDatesFor(slug: string, date: string): string[] {
  return AMERICAS_SLUGS.has(slug) ? [shiftDate(date, -1), date] : [date];
}

export function parseEspnScoreboard(body: any, comp: EspnComp): MatchItem[] {
  const events: any[] = Array.isArray(body?.events) ? body.events : [];
  const out: MatchItem[] = [];
  for (const ev of events) {
    const c = ev?.competitions?.[0];
    const competitors: any[] = Array.isArray(c?.competitors) ? c.competitors : [];
    const home = competitors.find((x) => x?.homeAway === "home");
    const away = competitors.find((x) => x?.homeAway === "away");
    if (!home || !away) continue;

    const st = ev.status ?? c?.status ?? {};
    const type = st.type ?? {};
    const name = String(type.name ?? "").toUpperCase();
    const state = String(type.state ?? "").toLowerCase();

    let status: MatchItem["status"] = "upcoming";
    let statusText = "";
    if (/POSTPONED|CANCEL/.test(name)) {
      statusText = /POSTPONED/.test(name) ? "Uppskjuten" : "Inställd";
    } else if (state === "in") {
      status = "live";
      statusText =
        name === "STATUS_HALFTIME"
          ? "Halvtid"
          : /PENALT|SHOOTOUT/.test(name)
            ? "Straffar"
            : String(st.displayClock ?? type.shortDetail ?? "LIVE") || "LIVE";
    } else if (state === "post") {
      status = "finished";
      statusText = "Slut";
    }

    const hasScore = status !== "upcoming";
    out.push({
      id: `espn-${ev.id ?? `${home.team?.displayName}-${away.team?.displayName}`}`,
      league: comp.name,
      home: String(home.team?.displayName ?? home.team?.name ?? "Hemmalag"),
      away: String(away.team?.displayName ?? away.team?.name ?? "Bortalag"),
      homeScore: hasScore ? num(home.score) : null,
      awayScore: hasScore ? num(away.score) : null,
      status,
      statusText,
      kickoff: typeof ev.date === "string" ? ev.date : "",
      ...(home.team?.logo ? { homeLogo: String(home.team.logo) } : {}),
      ...(away.team?.logo ? { awayLogo: String(away.team.logo) } : {}),
      country: comp.country,
      ...(comp.flag ? { countryFlag: comp.flag } : {}),
      leagueKey: `espn-${comp.slug}`,
      priority: comp.priority,
    });
  }
  return out;
}

// ─── OpenLigaDB (öppet API utan nyckel, används för 3. Liga) ─────────────────────
export type OpenLigaLeague = {
  shortcut: string;
  name: string;
  country: string;
  flag: string;
  priority: number;
};

export const OPENLIGA_LEAGUES: OpenLigaLeague[] = [
  { shortcut: "bl3", name: "3. Liga", country: "Germany", flag: flag("de"), priority: 54 },
];

/** Säsongen startar på sommaren: från juli och framåt gäller säsongen som börjar det året. */
export function openLigaSeason(date: string): number {
  const [y = 0, m = 1] = date.split("-").map(Number);
  return m >= 7 ? y : y - 1;
}

export function openLigaUrl(shortcut: string, season: number): string {
  return `https://api.openligadb.de/getmatchdata/${shortcut}/${season}`;
}

/** Det som behövs ur en OpenLigaDB-match. Hela säsongen är ~450 kB, så vi sparar bara detta. */
export type OpenLigaMatch = {
  id: number;
  utc: string;
  finished: boolean;
  home: string;
  away: string;
  homeLogo?: string;
  awayLogo?: string;
  /** Slutresultat (resultTypeID 2) när det finns. */
  final: [number, number] | null;
  /** Ställning efter sista målet. Används medan matchen pågår. */
  lastGoal: [number, number] | null;
};

export function projectOpenLiga(body: unknown): OpenLigaMatch[] {
  if (!Array.isArray(body)) return [];
  const out: OpenLigaMatch[] = [];
  for (const m of body as any[]) {
    const utc = typeof m?.matchDateTimeUTC === "string" ? m.matchDateTimeUTC : "";
    const home = m?.team1?.teamName;
    const away = m?.team2?.teamName;
    if (!utc || typeof home !== "string" || typeof away !== "string" || m?.matchID == null) {
      continue;
    }
    const results: any[] = Array.isArray(m.matchResults) ? m.matchResults : [];
    const end = results.find((r) => r?.resultTypeID === 2);
    const final =
      end && num(end.pointsTeam1) != null && num(end.pointsTeam2) != null
        ? ([num(end.pointsTeam1)!, num(end.pointsTeam2)!] as [number, number])
        : null;

    const goals: any[] = Array.isArray(m.goals) ? m.goals : [];
    const last = goals.length
      ? goals.reduce((a, b) => (Number(b?.goalID ?? 0) >= Number(a?.goalID ?? 0) ? b : a))
      : undefined;
    const lastGoal =
      last && num(last.scoreTeam1) != null && num(last.scoreTeam2) != null
        ? ([num(last.scoreTeam1)!, num(last.scoreTeam2)!] as [number, number])
        : null;

    out.push({
      id: Number(m.matchID),
      utc,
      finished: m.matchIsFinished === true,
      home,
      away,
      ...(typeof m.team1.teamIconUrl === "string" && m.team1.teamIconUrl
        ? { homeLogo: m.team1.teamIconUrl }
        : {}),
      ...(typeof m.team2.teamIconUrl === "string" && m.team2.teamIconUrl
        ? { awayLogo: m.team2.teamIconUrl }
        : {}),
      final,
      lastGoal,
    });
  }
  return out;
}

const OPENLIGA_MAX_MATCH_MS = 3 * 3_600_000;

/** Matcherna som startar på angivet datum (svensk tid). OpenLigaDB har ingen livestatus, så den räknas ut. */
export function openLigaToItems(
  list: OpenLigaMatch[],
  league: OpenLigaLeague,
  date: string,
  nowMs: number,
): MatchItem[] {
  const out: MatchItem[] = [];
  for (const m of list) {
    if (stockholmDate(m.utc) !== date) continue;
    const kickoff = Date.parse(m.utc);
    const started = Number.isFinite(kickoff) && nowMs >= kickoff;
    const overdue = started && nowMs >= kickoff + OPENLIGA_MAX_MATCH_MS;

    let status: MatchItem["status"] = "upcoming";
    let score: [number, number] | null = null;
    if (m.finished) {
      status = "finished";
      score = m.final ?? m.lastGoal ?? null;
    } else if (started && !overdue) {
      status = "live";
      score = m.lastGoal ?? [0, 0];
    } else if (overdue && (m.final ?? m.lastGoal)) {
      // Matchen är över men inte markerad som klar än. Resultatet är känt.
      status = "finished";
      score = m.final ?? m.lastGoal;
    }

    out.push({
      id: `ol-${m.id}`,
      league: league.name,
      home: m.home,
      away: m.away,
      homeScore: score ? score[0] : null,
      awayScore: score ? score[1] : null,
      status,
      statusText: status === "finished" ? "Slut" : status === "live" ? "LIVE" : "",
      kickoff: m.utc,
      ...(m.homeLogo ? { homeLogo: m.homeLogo } : {}),
      ...(m.awayLogo ? { awayLogo: m.awayLogo } : {}),
      country: league.country,
      countryFlag: league.flag,
      leagueKey: `openliga-${league.shortcut}`,
      priority: league.priority,
    });
  }
  return out;
}

export function sortMatches(list: MatchItem[]): MatchItem[] {
  return [...list].sort(
    (a, b) =>
      (b.priority ?? 0) - (a.priority ?? 0) ||
      a.kickoff.localeCompare(b.kickoff) ||
      a.id.localeCompare(b.id),
  );
}

/** Behåller bara matcher som startar på angivet datum i svensk tid, och tar bort dubbletter. */
export function onlyLocalDate(list: MatchItem[], date: string): MatchItem[] {
  const seen = new Set<string>();
  return list.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    if (!m.kickoff.includes("T")) return true;
    return stockholmDate(m.kickoff) === date;
  });
}

/**
 * Hur länge ett API-Football-svar får leva. Kvoten är liten, så svaret delas länge, men det går ut
 * så fort en match ska börja eller medan något pågår, annars skulle live-ställningen släpa.
 */
export function apiFootballTtlMs(
  list: MatchItem[],
  date: string,
  today: string,
  nowMs: number,
): number {
  if (date !== today) return 3 * 3_600_000;
  if (list.some((m) => m.status === "live")) return 90_000;
  let ttl = 15 * 60_000;
  for (const m of list) {
    if (m.status !== "upcoming") continue;
    const t = Date.parse(m.kickoff);
    if (Number.isFinite(t) && t > nowMs) ttl = Math.min(ttl, t - nowMs + 30_000);
  }
  return Math.max(30_000, ttl);
}

/** Hur länge ett svar får leva i serverns cache. Kort när något pågår, längre annars. */
export function matchesTtlMs(list: MatchItem[], date: string, today: string): number {
  if (list.some((m) => m.status === "live")) return 45_000;
  if (date === today) return 3 * 60_000;
  if (list.length === 0) return 2 * 60_000;
  return 15 * 60_000;
}
