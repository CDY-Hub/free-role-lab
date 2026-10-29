import { createServerFn } from "@tanstack/react-start";
import {
  parseValuableClubs,
  parseValuablePlayers,
  parseClubs,
  parseClubHeader,
  parseCoaches,
  parseMarketValue,
  parsePlayers,
  parseProfileHeader,
  pickWikiTitle,
  trimWikiHtml,
  type TmClubHit,
  type TmCoachHit,
  type TmPlayerHit,
  type TmRankedPlayer,
  type TmValuableClub,
} from "./tm-parse";
import { Breaker, Gate, Inflight, TtlCache, fetchWithTimeout } from "./tm-net";

export type {
  TmClubHit,
  TmCoachHit,
  TmPlayerHit,
  TmRankedPlayer,
  TmValuableClub,
} from "./tm-parse";

// ─── Direct scraping of transfermarkt.com (the fly.dev proxy returns 403) ───
const TM_BASE = "https://www.transfermarkt.com";
const TM_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Accept-Language": "en;q=0.9",
  Accept: "text/html,application/xhtml+xml,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  Referer: "https://www.transfermarkt.com/",
};

// ─── Cache, dubblettskydd och säkringar ─────────────────────────────────────
// Minnestak i byte (inte bara antal poster): hela HTML-sidor är stora och fyllde tidigare servern,
// vilket gjorde att sökningen blev långsammare för varje sökning.
const cache = new TtlCache(1200, 48 * 1024 * 1024);
const inflight = new Inflight();
const tmBreaker = new Breaker();
const apiBreaker = new Breaker();
const apiGate = new Gate(450); // API-tjänsten stryper vid ~2 anrop/3 s

function getCached<T>(key: string): T | null {
  return cache.get<T>(key) ?? null;
}

function setCache<T>(key: string, data: T, ttlMs = 3_600_000): void {
  cache.set(key, data, ttlMs);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function tmFetch(path: string, ttlMs = 3_600_000): Promise<string> {
  const cacheKey = `html:${path}`;
  const hit = getCached<string>(cacheKey);
  if (hit) return hit;

  return inflight.run(cacheKey, async () => {
    // Har Transfermarkt nyss sagt nej? Misslyckas direkt så att sökningen kan gå på reservvägen
    // i stället för att vänta på nya timeouts.
    if (tmBreaker.isOpen()) {
      throw new Error("Transfermarkt begränsar anrop just nu. Försök igen om en stund.");
    }

    let lastStatus = 0;
    for (let attempt = 0; attempt < 2; attempt++) {
      let res: Response;
      try {
        res = await fetchWithTimeout(`${TM_BASE}${path}`, { headers: TM_HEADERS }, 9000);
      } catch (e) {
        if (attempt === 0) {
          await sleep(400);
          continue;
        }
        tmBreaker.open(20_000);
        throw e instanceof Error ? e : new Error("Kunde inte nå Transfermarkt");
      }

      if (res.status === 429 || res.status >= 500) {
        lastStatus = res.status;
        if (attempt === 0) await sleep(700);
        continue;
      }
      if (res.status === 403) {
        tmBreaker.open(60_000);
        throw new Error("Transfermarkt svarade 403");
      }
      if (!res.ok) throw new Error(`Transfermarkt svarade ${res.status}`);

      const html = await res.text();
      setCache(cacheKey, html, ttlMs);
      return html;
    }
    tmBreaker.open(lastStatus === 429 ? 45_000 : 20_000);
    throw new Error("Transfermarkt är tillfälligt nere. Försök igen om en stund.");
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function first(html: string, rx: RegExp): string | undefined {
  return rx.exec(html)?.[1] ?? undefined;
}

function imgUrl(src?: string): string | undefined {
  if (!src) return undefined;
  return src.startsWith("//") ? `https:${src}` : src;
}

const parseMV = parseMarketValue;

// ─── Input validators ────────────────────────────────────────────────────────
const str = (d: unknown) => {
  if (typeof d !== "string" || !d.trim() || d.length > 100) throw new Error("Ogiltig sökning");
  return encodeURIComponent(d.trim());
};

const id = (d: unknown) => {
  if (typeof d !== "string" || !/^\d+$/.test(d)) throw new Error("Ogiltigt id");
  return d;
};

const ids = (d: unknown) => {
  if (
    !Array.isArray(d) ||
    d.length === 0 ||
    d.length > 20 ||
    !d.every((x) => typeof x === "string" && /^\d+$/.test(x))
  )
    throw new Error("Ogiltiga id:n");
  return d as string[];
};

const comp = (d: unknown) => {
  if (typeof d !== "string" || !/^[A-Z0-9]{2,6}$/.test(d)) throw new Error("Ogiltig serie");
  return d;
};

// ─── Pool helper ─────────────────────────────────────────────────────────────
async function pool<T, R>(
  items: T[],
  fn: (item: T) => Promise<R | null>,
  concurrency = 3,
): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (i < items.length) {
        const item = items[i++]!;
        const r = await fn(item);
        if (r !== null) out.push(r);
      }
    }),
  );
  return out;
}

// ─── Sök: lag, spelare och tränare ───────────────────────────────────────────
export type TmSearchResult = {
  players: TmPlayerHit[];
  clubs: TmClubHit[];
  coaches: TmCoachHit[];
  meta: {
    source: "transfermarkt" | "transfermarkt-api" | "none";
    htmlBytes: number;
    pagesFetched: number;
    error?: string;
  };
};

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};
const asString = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : v == null ? undefined : String(v);
/** API:et ger position som sträng eller som objekt {main, other}. Alltid en sträng ut. */
const asPosition = (v: unknown): string | undefined => {
  if (v && typeof v === "object") return asString((v as Record<string, unknown>)["main"]);
  return asString(v);
};
const asNumber = (v: unknown): number | undefined => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
};

function mergeUnique<T extends { id: string }>(into: T[], more: T[]): number {
  const seen = new Set(into.map((x) => x.id));
  let added = 0;
  for (const item of more) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    into.push(item);
    added++;
  }
  return added;
}

/** Reserv om Transfermarkts HTML inte går att läsa: den inofficiella API-tjänsten. */
async function searchViaApi(
  query: string,
): Promise<{ players: TmPlayerHit[]; clubs: TmClubHit[] }> {
  const q = encodeURIComponent(query);
  const [p, c] = await Promise.all([
    tmApiJson<unknown>(`/players/search/${q}`, 600_000).catch(() => null),
    tmApiJson<unknown>(`/clubs/search/${q}`, 600_000).catch(() => null),
  ]);

  const players: TmPlayerHit[] = [];
  const pResults = asRecord(p)["results"];
  for (const raw of Array.isArray(pResults) ? pResults : []) {
    const r = asRecord(raw);
    const id = asString(r["id"]);
    const name = asString(r["name"]);
    if (!id || !name) continue;
    const club = asRecord(r["club"]);
    const clubName = asString(club["name"]);
    const nat = r["nationality"];
    players.push({
      id,
      name,
      position: asPosition(r["position"]),
      age: asNumber(r["age"]),
      marketValue: asNumber(r["marketValue"]),
      club: clubName ? { id: asString(club["id"]), name: clubName } : undefined,
      nationalities: Array.isArray(nat) ? nat.map(String) : undefined,
    });
  }

  const clubs: TmClubHit[] = [];
  const cResults = asRecord(c)["results"];
  for (const raw of Array.isArray(cResults) ? cResults : []) {
    const r = asRecord(raw);
    const id = asString(r["id"]);
    const name = asString(r["name"]);
    if (!id || !name) continue;
    clubs.push({
      id,
      name,
      country: asString(r["country"]),
      squadSize: asNumber(r["squad"]),
      marketValue: asNumber(r["marketValue"]),
    });
  }
  return { players, clubs };
}

const SEARCH_TTL = 10 * 60_000;
const SEARCH_HTML_TTL = 2 * 60_000; // träfflistans HTML behövs bara kort; det tolkade svaret cachas separat

async function runSearch(data: string): Promise<TmSearchResult> {
  const query = decodeURIComponent(data);
  const base = `/schnellsuche/ergebnis/schnellsuche?query=${data}`;

  const players: TmPlayerHit[] = [];
  const clubs: TmClubHit[] = [];
  const coaches: TmCoachHit[] = [];
  let htmlBytes = 0;
  let pagesFetched = 0;
  let error: string | undefined;

  try {
    const html = await tmFetch(base, SEARCH_HTML_TTL);
    pagesFetched = 1;
    htmlBytes = html.length;
    mergeUnique(players, parsePlayers(html));
    mergeUnique(clubs, parseClubs(html));
    mergeUnique(coaches, parseCoaches(html));
  } catch (e) {
    error = e instanceof Error ? e.message : "Okänt fel mot Transfermarkt";
  }

  // Fler sidor (10 per sida) hämtas parallellt i stället för en i taget. Det gjorde tidigare
  // varje sökning upp till sju serieanrop långsam, och hela kedjan väntade vid strypning.
  type Extra = { kind: "p" | "c"; page: number; html: string };
  const wanted: { kind: "p" | "c"; page: number }[] = [];
  if (players.length >= 10) for (let page = 2; page <= 4; page++) wanted.push({ kind: "p", page });
  if (clubs.length >= 10) wanted.push({ kind: "c", page: 2 });
  if (wanted.length > 0) {
    const fetched = await Promise.all(
      wanted.map(async (w): Promise<Extra | null> => {
        try {
          const param = w.kind === "p" ? "Spieler_page" : "Verein_page";
          return { ...w, html: await tmFetch(`${base}&${param}=${w.page}`, SEARCH_HTML_TTL) };
        } catch {
          return null;
        }
      }),
    );
    for (const f of fetched.sort((a, b) => (a?.page ?? 0) - (b?.page ?? 0))) {
      if (!f) continue;
      pagesFetched++;
      if (f.kind === "p") mergeUnique(players, parsePlayers(f.html));
      else mergeUnique(clubs, parseClubs(f.html));
    }
  }

  let source: TmSearchResult["meta"]["source"] =
    players.length || clubs.length || coaches.length ? "transfermarkt" : "none";

  // Reserv om HTML-läsningen inte gav några spelare eller lag.
  if (players.length === 0 && clubs.length === 0) {
    try {
      const api = await searchViaApi(query);
      mergeUnique(players, api.players);
      mergeUnique(clubs, api.clubs);
      if (players.length || clubs.length) source = "transfermarkt-api";
    } catch {
      /* behåll ursprungligt fel */
    }
  }

  return {
    players,
    clubs,
    coaches,
    meta: {
      source,
      htmlBytes,
      pagesFetched,
      ...(error && source === "none" ? { error } : {}),
    },
  };
}

export const tmSearchAll = createServerFn({ method: "GET" })
  .inputValidator(str)
  .handler(async ({ data }: { data: string }): Promise<TmSearchResult> => {
    const key = `search:${decodeURIComponent(data).toLocaleLowerCase("sv")}`;
    const hit = getCached<TmSearchResult>(key);
    if (hit) return hit;
    return inflight.run(key, async () => {
      const result = await runSearch(data);
      // Ett misslyckande ska aldrig cachas: nästa sökning ska få en ny chans direkt.
      if (!result.meta.error)
        setCache(key, result, result.meta.source === "none" ? 120_000 : SEARCH_TTL);
      return result;
    });
  });

// ─── Transfermarkts rankinglistor (mest värda klubbar och spelare) ───────────────
const CLUBS_PATH = "/marktwertetop/wertvollstemannschaften";
const PLAYERS_PATH = "/marktwerte/wertvollstespieler/marktwertetop";
const SWEDEN_LAND_ID = "147"; // Transfermarkts id för Sverige i landsfiltret
const RANKING_TTL = 60 * 60_000;

// Senast lyckade lista sparas längre, så att en tillfällig Transfermarkt-strypning visar
// gårdagens lista hellre än ett felmeddelande.
const lastGoodRankings = new TtlCache(20, 4 * 1024 * 1024);

async function cachedRanking<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = getCached<T>(key);
  if (hit) return hit;
  return inflight.run(key, async () => {
    try {
      const value = await load();
      setCache(key, value, RANKING_TTL);
      lastGoodRankings.set(key, value, 24 * 3_600_000);
      return value;
    } catch (e) {
      const old = lastGoodRankings.get<T>(key);
      if (old) return old;
      throw e;
    }
  });
}

export const tmMostValuableClubs = createServerFn({ method: "GET" }).handler(
  async (): Promise<TmValuableClub[]> =>
    cachedRanking("rank:clubs", async () => {
      const html = await tmFetch(CLUBS_PATH, RANKING_TTL);
      const clubs = parseValuableClubs(html);
      if (clubs.length < 5) {
        throw new Error("Kunde inte läsa Transfermarkts lista över mest värda klubbar.");
      }
      return clubs.slice(0, 25);
    }),
);

const rankingScope = (d: unknown): "world" | "sweden" => {
  if (d === "world" || d === "sweden") return d;
  throw new Error("Ogiltig lista");
};

export const tmMostValuablePlayers = createServerFn({ method: "GET" })
  .inputValidator(rankingScope)
  .handler(
    async ({ data }: { data: "world" | "sweden" }): Promise<TmRankedPlayer[]> =>
      cachedRanking(`rank:players:${data}`, async () => {
        const path = data === "sweden" ? `${PLAYERS_PATH}?land_id=${SWEDEN_LAND_ID}` : PLAYERS_PATH;
        const html = await tmFetch(path, RANKING_TTL);
        const players = parseValuablePlayers(html);
        if (players.length < 5) {
          throw new Error("Kunde inte läsa Transfermarkts lista över dyraste spelare.");
        }
        return players.slice(0, 25);
      }),
  );

// ─── Lagets trupp ──────────────────────────────────────────────────────────────
export const tmClubSquad = createServerFn({ method: "GET" })
  .inputValidator(id)
  .handler(async ({ data }: { data: string }): Promise<TmPlayerHit[]> => {
    // 1. Transfermarkt-sidan med detaljerad trupp
    try {
      const html = await tmFetch(`/-/kader/verein/${data}/plus/1`);
      const players = parsePlayers(html);
      if (players.length > 0) return players;
    } catch {
      /* prova reserv */
    }

    // 2. Reserv: den inofficiella API-tjänsten
    try {
      const body = await tmApiJson<unknown>(`/clubs/${data}/players`);
      const list = asRecord(body)["players"];
      const out: TmPlayerHit[] = [];
      for (const raw of Array.isArray(list) ? list : []) {
        const r = asRecord(raw);
        const pid = asString(r["id"]);
        const name = asString(r["name"]);
        if (!pid || !name) continue;
        const nat = r["nationality"];
        out.push({
          id: pid,
          name,
          position: asPosition(r["position"]),
          age: asNumber(r["age"]),
          marketValue: asNumber(r["marketValue"]),
          nationalities: Array.isArray(nat) ? nat.map(String) : undefined,
        });
      }
      return out;
    } catch {
      return [];
    }
  });

// ─── Player profile ────────────────────────────────────────────────────────────
// Transfermarkt ignorerar "slug"-delen i adressen, så "-" fungerar för alla id:n.
export const tmPlayerProfile = createServerFn({ method: "GET" })
  .inputValidator(id)
  .handler(async ({ data }: { data: string }): Promise<any> => {
    let html: string;
    try {
      html = await tmFetch(`/-/profil/spieler/${data}`);
    } catch {
      // Visa en tom profil i stället för ett 404-fel; sidan kan fortfarande visa Wikipedia.
      return { id: data, name: undefined, unavailable: true };
    }

    const h = parseProfileHeader(html);
    const info = h.info;
    const dob = info["Date of birth/Age"]?.text;
    const age = Number(/\((\d{1,2})\)/.exec(dob ?? "")?.[1]);
    const heightM = /([\d]),?(\d{2})/.exec(info["Height"]?.text ?? "");
    const height = heightM ? Number(`${heightM[1]}${heightM[2]}`) : undefined;
    const position = info["Position"]?.text;
    const foot = info["Foot"]?.text.toLowerCase();
    const citizenship = info["Citizenship"]?.flags.length
      ? info["Citizenship"].flags
      : info["Citizenship"]?.text
        ? [info["Citizenship"].text]
        : undefined;
    const birthPlace = info["Place of birth"]?.text;

    return {
      id: data,
      name: h.name,
      imageUrl: h.imageUrl,
      age: Number.isFinite(age) ? age : undefined,
      marketValue: h.marketValue,
      marketValueDetails: null,
      position: position ? { main: position.replace(/^[A-Za-z ]+ - /, ""), other: [] } : undefined,
      citizenship,
      nationalTeam: null,
      nameInHomeCountry: info["Name in home country"]?.text,
      dateOfBirth: dob?.replace(/\s*\(\d{1,2}\)\s*$/, ""),
      placeOfBirth: birthPlace ? { city: birthPlace, country: undefined } : undefined,
      height,
      foot,
      shirtNumber: h.shirtNumber,
      outfitter: info["Outfitter"]?.text,
      agent: info["Player agent"]?.text ? { name: info["Player agent"].text } : undefined,
      club: h.club
        ? {
            name: h.club.name,
            id: h.club.id,
            joined: info["Joined"]?.text,
            contractExpires: info["Contract expires"]?.text,
          }
        : null,
    };
  });

// ─── Player stats ──────────────────────────────────────────────────────────────
export const tmPlayerStats = createServerFn({ method: "GET" })
  .inputValidator(id)
  .handler(async ({ data }: { data: string }) => {
    // Return minimal stats from profile page
    const html = await tmFetch(`/-/leistungsdatendetails/spieler/${data}`);
    // Parse season rows
    const stats: any[] = [];
    const rowRx = /<tr[^>]*class="[^"]*(?:odd|even)[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
    let m;
    while ((m = rowRx.exec(html)) !== null) {
      const row = m[1]!;
      const season = first(row, />\s*(20\d{2}\/\d{2,4}|\d{4})\s*</);
      const apps = first(row, /class="zentriert"\s*>(\d+)<\/td>/);
      const goals = first(row, /class="zentriert"\s*>\s*(\d+)\s*<\/td>/);
      if (season && apps) {
        stats.push({
          season,
          appearances: parseInt(apps, 10),
          goals: goals ? parseInt(goals, 10) : 0,
        });
      }
    }
    return stats;
  });

// ─── Player transfers ──────────────────────────────────────────────────────────
export const tmPlayerTransfers = createServerFn({ method: "GET" })
  .inputValidator(id)
  .handler(async ({ data }: { data: string }) => {
    const html = await tmFetch(`/-/transfers/spieler/${data}`);
    const transfers: any[] = [];
    const rx =
      /class="tm-player-transfer-history-grid__club-link"[^>]*>([^<]+)<[\s\S]*?class="tm-player-transfer-history-grid__fee"[^>]*>([^<]+)</gi;
    let m;
    while ((m = rx.exec(html)) !== null) {
      transfers.push({ to: m[1]!.trim(), fee: m[2]!.trim() });
    }
    return transfers;
  });

// ─── Player matches ────────────────────────────────────────────────────────────
export const tmPlayerMatches = createServerFn({ method: "GET" })
  .inputValidator(id)
  .handler(async ({ data }: { data: string }) => {
    return [] as any[];
  });

// ─── Coach profile ─────────────────────────────────────────────────────────────
export const tmCoachProfile = createServerFn({ method: "GET" })
  .inputValidator(id)
  .handler(async ({ data }: { data: string }): Promise<any> => {
    try {
      const html = await tmFetch(`/-/profil/trainer/${data}`);
      const h = parseProfileHeader(html);
      const dob = h.info["Date of birth/Age"]?.text;
      const age = Number(/\((\d{1,2})\)/.exec(dob ?? "")?.[1]);
      return {
        id: data,
        name: h.name,
        imageUrl: h.imageUrl,
        license: h.info["Coaching Licence"]?.text,
        age: Number.isFinite(age) ? age : undefined,
        citizenship: h.info["Citizenship"]?.flags,
        nameInHomeCountry: h.info["Name in home country"]?.text,
        dateOfBirth: dob?.replace(/\s*\(\d{1,2}\)\s*$/, ""),
        placeOfBirth: undefined,
      };
    } catch {
      return { id: data, name: undefined, unavailable: true };
    }
  });

// ─── Club profile ──────────────────────────────────────────────────────────────
export const tmClubProfile = createServerFn({ method: "GET" })
  .inputValidator(id)
  .handler(async ({ data }: { data: string }) => {
    try {
      const html = await tmFetch(`/-/startseite/verein/${data}`);
      const c = parseClubHeader(html);
      return {
        id: data,
        name: c.name,
        image: c.imageUrl,
        currentMarketValue: c.marketValue,
      };
    } catch {
      return {
        id: data,
        name: undefined as string | undefined,
        image: undefined as string | undefined,
        currentMarketValue: undefined as number | undefined,
      };
    }
  });

// ─── Players batch ─────────────────────────────────────────────────────────────
export const tmPlayersBatch = createServerFn({ method: "GET" })
  .inputValidator(ids)
  .handler(async ({ data }: { data: string[] }) =>
    pool(data, async (pid) => {
      try {
        const p = await tmPlayerProfile({ data: pid });
        return p;
      } catch {
        return null;
      }
    }),
  );

// ─── Clubs batch ──────────────────────────────────────────────────────────────
export const tmClubsBatch = createServerFn({ method: "GET" })
  .inputValidator(ids)
  .handler(async ({ data }: { data: string[] }) =>
    pool(data, async (cid) => {
      try {
        const c = await tmClubProfile({ data: cid });
        return c;
      } catch {
        return null;
      }
    }),
  );

// ─── Wikipedia ────────────────────────────────────────────────────────────────
const wikiTitle = (d: unknown) => {
  if (typeof d !== "string" || !d.trim() || d.length > 150 || !/^[\w ()%,.'`\-–]+$/u.test(d.trim()))
    throw new Error("Ogiltig artikel");
  return d.trim();
};

const WIKI_HEADERS = {
  "User-Agent": "FreeRoleLab/1.0 (fotbollsstatistik)",
  accept: "application/json",
};

async function fetchWikiHtml(title: string): Promise<{ title: string; html: string }> {
  const cacheKey = `wiki:${title}`;
  const hit = getCached<{ title: string; html: string }>(cacheKey);
  if (hit) return hit;

  const res = await fetchWithTimeout(
    `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=text|displaytitle&format=json&formatversion=2&redirects=1`,
    { headers: WIKI_HEADERS },
    10_000,
  );
  const body: any = await res.json().catch(() => null);
  if (!res.ok || !body?.parse?.text) throw new Error("Kunde inte hämta artikeln från Wikipedia.");
  let html: string = body.parse.text;
  html = html
    .replace(/href="\/wiki\//g, 'href="https://en.wikipedia.org/wiki/')
    .replace(/href="\/w\//g, 'href="https://en.wikipedia.org/w/')
    .replace(
      /<a href="https:\/\/en\.wikipedia\.org/g,
      '<a target="_blank" rel="noopener" href="https://en.wikipedia.org',
    )
    .replace(/src="\/\//g, 'src="https://')
    .replace(/srcset="\/\//g, 'srcset="https://');
  const result = { title: body.parse.title as string, html };
  setCache(cacheKey, result, 86_400_000);
  return result;
}

export const wikiPage = createServerFn({ method: "GET" })
  .inputValidator(wikiTitle)
  .handler(async ({ data }: { data: string }) => fetchWikiHtml(data));

// Slår upp fotbollsartikeln för ett lag, en spelare eller en tränare på Wikipedia.
const wikiQuery = (d: unknown) => {
  const o = (d && typeof d === "object" ? d : {}) as Record<string, unknown>;
  const name = o["name"];
  const kind = o["kind"];
  if (typeof name !== "string" || !name.trim() || name.length > 100)
    throw new Error("Ogiltigt namn");
  if (kind !== "club" && kind !== "player" && kind !== "coach") throw new Error("Ogiltig typ");
  return { name: name.trim(), kind } as { name: string; kind: "club" | "player" | "coach" };
};

const WIKI_SUFFIX = { club: "football club", player: "footballer", coach: "football manager" };

export type WikiArticle = { title: string; html: string; url: string } | null;

export const wikiArticle = createServerFn({ method: "GET" })
  .inputValidator(wikiQuery)
  .handler(
    async ({
      data,
    }: {
      data: { name: string; kind: "club" | "player" | "coach" };
    }): Promise<WikiArticle> => {
      const cacheKey = `wikiart:${data.kind}:${data.name.toLowerCase()}`;
      const hit = getCached<WikiArticle>(cacheKey);
      if (hit !== null) return hit;
      try {
        const q = encodeURIComponent(`${data.name} ${WIKI_SUFFIX[data.kind]}`);
        const res = await fetchWithTimeout(
          `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${q}&srlimit=8&srprop=snippet&format=json&formatversion=2`,
          { headers: WIKI_HEADERS },
          10_000,
        );
        const body: any = await res.json().catch(() => null);
        const hits = ((body?.query?.search ?? []) as any[]).map((h) => ({
          title: String(h.title ?? ""),
          snippet: String(h.snippet ?? ""),
        }));
        const title = pickWikiTitle(data.name, hits);
        if (!title) return null;
        const page = await fetchWikiHtml(title);
        const result: WikiArticle = {
          title: page.title,
          html: trimWikiHtml(page.html),
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
        };
        setCache(cacheKey, result, 86_400_000);
        return result;
      } catch {
        return null;
      }
    },
  );

// ─── Competition table ─────────────────────────────────────────────────────────
const TM_API_BASE = "https://transfermarkt-api.fly.dev";

async function tmApiJson<T = any>(path: string, ttlMs = 3_600_000): Promise<T> {
  const key = `api:${path}`;
  const hit = getCached<T>(key);
  if (hit !== null) return hit;

  return inflight.run(key, async () => {
    if (apiBreaker.isOpen()) throw new Error("Transfermarkt-tjänsten är nere.");

    let lastStatus = 0;
    for (let attempt = 0; attempt < 2; attempt++) {
      await apiGate.wait();
      let res: Response;
      try {
        res = await fetchWithTimeout(
          `${TM_API_BASE}${path}`,
          { headers: { accept: "application/json" } },
          9000,
        );
      } catch (e) {
        if (attempt === 0) continue;
        apiBreaker.open(20_000);
        throw e instanceof Error ? e : new Error("Kunde inte nå TM API");
      }
      if (res.status === 429 || res.status >= 500) {
        lastStatus = res.status;
        if (attempt === 0) await sleep(1200);
        continue;
      }
      if (res.status === 403) {
        apiBreaker.open(5 * 60_000);
        throw new Error("TM API svarade 403");
      }
      if (!res.ok) throw new Error(`TM API svarade ${res.status}`);
      const body: T = await res.json();
      setCache(key, body, ttlMs);
      return body;
    }
    apiBreaker.open(lastStatus === 429 ? 45_000 : 20_000);
    throw new Error("Transfermarkt-tjänsten är nere.");
  });
}

export const tmCompetitionTable = createServerFn({ method: "GET" })
  .inputValidator(comp)
  .handler(async ({ data }: { data: string }) => {
    try {
      const body: any = await tmApiJson(`/competitions/${data}/table`);
      return body.tables ?? [];
    } catch {
      return [];
    }
  });

export const tmCompetitionClubs = createServerFn({ method: "GET" })
  .inputValidator(comp)
  .handler(async ({ data }: { data: string }) => {
    try {
      const body: any = await tmApiJson(`/competitions/${data}/clubs`);
      return body.clubs ?? [];
    } catch {
      return [];
    }
  });

export const tmLeagueTopValues = createServerFn({ method: "GET" })
  .inputValidator(comp)
  .handler(async ({ data }: { data: string }) => {
    try {
      const clubs: { id: string; name: string }[] =
        (await tmApiJson<any>(`/competitions/${data}/clubs`)).clubs ?? [];
      const players = await pool(clubs, async (c) => {
        try {
          const body = await tmApiJson<any>(`/clubs/${c.id}/players`);
          return (body.players ?? []).map((p: any) => ({
            id: p.id,
            name: p.name,
            imageUrl: p.imageUrl,
            age: p.age,
            position: asPosition(p.position),
            marketValue: p.marketValue,
            nationality: Array.isArray(p.nationality) ? p.nationality[0] : p.nationality,
            club: c.name,
          }));
        } catch {
          return null;
        }
      });
      return players
        .flat()
        .sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0))
        .slice(0, 5);
    } catch {
      return [];
    }
  });

export const tmPlayerMatchesSeason = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => {
    if (typeof d !== "object" || d === null) throw new Error("Ogiltig sökning");
    const { playerId, seasonId } = d as Record<string, unknown>;
    return { playerId: id(playerId), seasonId: id(seasonId) };
  })
  .handler(async ({ data }: { data: { playerId: string; seasonId: string } }) => {
    try {
      const body = await tmApiJson<any>(
        `/players/${data.playerId}/matches?season_id=${data.seasonId}`,
      );
      return body.matches ?? [];
    } catch {
      return [];
    }
  });
