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
// Fokus: de fem stora ligorna, Allsvenskan, Portugal, Nederländerna, UEFA- och FIFA-turneringar
// samt ligornas inhemska cuper.

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

/** Hur länge ett svar får leva i serverns cache. Kort när något pågår, längre annars. */
export function matchesTtlMs(list: MatchItem[], date: string, today: string): number {
  if (list.some((m) => m.status === "live")) return 45_000;
  if (date === today) return 3 * 60_000;
  if (list.length === 0) return 2 * 60_000;
  return 15 * 60_000;
}
