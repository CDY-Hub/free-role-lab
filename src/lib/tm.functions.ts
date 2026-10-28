import { createServerFn } from "@tanstack/react-start";
import {
  parseClubs,
  parseCoaches,
  parseMarketValue,
  parsePlayers,
  type TmClubHit,
  type TmCoachHit,
  type TmPlayerHit,
} from "./tm-parse";

export type { TmClubHit, TmCoachHit, TmPlayerHit } from "./tm-parse";

// ─── Direct scraping of transfermarkt.com (the fly.dev proxy returns 403) ───
const TM_BASE = "https://www.transfermarkt.com";
const TM_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Accept-Language": "en;q=0.9",
  Accept: "text/html,application/xhtml+xml,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  Referer: "https://www.transfermarkt.com/",
};

// ─── In-memory TTL cache ────────────────────────────────────────────────────
const cache = new Map<string, { data: any; expiry: number }>();

function getCached<T>(key: string): T | null {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    cache.delete(key);
    return null;
  }
  return item.data as T;
}

function setCache<T>(key: string, data: T, ttlMs = 3_600_000): void {
  if (cache.size > 1500) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, { data, expiry: Date.now() + ttlMs });
}

async function tmFetch(path: string, ttlMs = 3_600_000): Promise<string> {
  const cacheKey = `html:${path}`;
  const hit = getCached<string>(cacheKey);
  if (hit) return hit;

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${TM_BASE}${path}`, {
      headers: TM_HEADERS,
    });

    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`Transfermarkt svarade ${res.status}`);
    const html = await res.text();
    setCache(cacheKey, html, ttlMs);
    return html;
  }
  throw new Error("Transfermarkt är tillfälligt nere. Försök igen om en stund.");
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
      position: asString(r["position"]),
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

export const tmSearchAll = createServerFn({ method: "GET" })
  .inputValidator(str)
  .handler(async ({ data }: { data: string }): Promise<TmSearchResult> => {
    const query = decodeURIComponent(data);
    const base = `/schnellsuche/ergebnis/schnellsuche?query=${data}`;

    const players: TmPlayerHit[] = [];
    const clubs: TmClubHit[] = [];
    const coaches: TmCoachHit[] = [];
    let htmlBytes = 0;
    let pagesFetched = 0;
    let error: string | undefined;

    try {
      const html = await tmFetch(base);
      pagesFetched = 1;
      htmlBytes = html.length;
      mergeUnique(players, parsePlayers(html));
      mergeUnique(clubs, parseClubs(html));
      mergeUnique(coaches, parseCoaches(html));
    } catch (e) {
      error = e instanceof Error ? e.message : "Okänt fel mot Transfermarkt";
    }

    // Fler sidor spelare (10 per sida). Slutar när en sida inte ger något nytt.
    if (players.length >= 10) {
      for (let page = 2; page <= 5; page++) {
        try {
          const html = await tmFetch(`${base}&Spieler_page=${page}`);
          pagesFetched++;
          if (mergeUnique(players, parsePlayers(html)) === 0) break;
        } catch {
          break;
        }
      }
    }
    if (clubs.length >= 10) {
      for (let page = 2; page <= 3; page++) {
        try {
          const html = await tmFetch(`${base}&Verein_page=${page}`);
          pagesFetched++;
          if (mergeUnique(clubs, parseClubs(html)) === 0) break;
        } catch {
          break;
        }
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
  });

// ─── Lagets trupp ──────────────────────────────────────────────────────────────
export const tmClubSquad = createServerFn({ method: "GET" })
  .inputValidator(id)
  .handler(async ({ data }: { data: string }): Promise<TmPlayerHit[]> => {
    // 1. Transfermarkt-sidan med detaljerad trupp
    try {
      const html = await tmFetch(`/en/club/kader/verein/${data}/plus/1`);
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
          position: asString(r["position"]),
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
export const tmPlayerProfile = createServerFn({ method: "GET" })
  .inputValidator(id)
  .handler(async ({ data }: { data: string }): Promise<any> => {
    const html = await tmFetch(`/en/players/${data}/profile/spieler/${data}`);

    const name =
      first(
        html,
        /<h1[^>]*class="[^"]*data-header__headline[^"]*"[^>]*>\s*(?:<[^>]+>\s*)*([^<\n]+)/,
      ) ??
      first(html, /<title>([^<|]+)/) ??
      data;

    const imageUrl = imgUrl(
      first(html, /class="data-header__profile-image"[^>]*src="([^"]+)"/) ??
        first(html, /id="fotoplus"[^>]*src="([^"]+)"/),
    );

    const age = parseInt(
      first(html, /class="[^"]*data-header__content[^"]*"[^>]*>\s*(\d{2})\s*<\/span>/) ?? "0",
      10,
    );
    const mvStr = first(html, /class="[^"]*tm-player-market-value[^"]*"[^>]*>([^<]+)</);
    const marketValue = parseMV(mvStr);
    const position =
      first(
        html,
        /class="[^"]*data-header__label[^"]*"[^>]*>Position<\/span>[^<]*<span[^>]*>([^<]+)</,
      ) ?? undefined;
    const clubName = first(html, /class="[^"]*data-header__club[^"]*"[^>]*>\s*<[^>]+>([^<]+)<\//);
    const clubId = first(html, /\/clubs\/(\d+)\/profile\/verein\//);

    // Return shape matches what proffs.spelare.$id.tsx expects (extra fields are undefined)
    return {
      id: data,
      name: name?.trim(),
      imageUrl,
      age: age || undefined,
      marketValue,
      marketValueDetails: null,
      position: position ? { main: position, other: [] } : undefined,
      citizenship: undefined,
      nationalTeam: null,
      nameInHomeCountry: undefined,
      dateOfBirth: undefined,
      placeOfBirth: undefined,
      height: undefined,
      foot: undefined,
      shirtNumber: undefined,
      outfitter: undefined,
      agent: undefined,
      club: clubName
        ? { name: clubName.trim(), id: clubId, joined: undefined, contractExpires: undefined }
        : null,
    };
  });

// ─── Player stats ──────────────────────────────────────────────────────────────
export const tmPlayerStats = createServerFn({ method: "GET" })
  .inputValidator(id)
  .handler(async ({ data }: { data: string }) => {
    // Return minimal stats from profile page
    const html = await tmFetch(`/en/players/${data}/stats/spieler/${data}`);
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
    const html = await tmFetch(`/en/players/${data}/transfers/spieler/${data}`);
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
    const html = await tmFetch(`/en/coaches/${data}/profile/trainer/${data}`);
    const name =
      first(
        html,
        /<h1[^>]*class="[^"]*data-header__headline[^"]*"[^>]*>\s*(?:<[^>]+>\s*)*([^<\n]+)/,
      ) ??
      first(html, /<title>([^<|]+)/) ??
      data;
    const imageUrl = imgUrl(first(html, /class="data-header__profile-image"[^>]*src="([^"]+)"/));
    return {
      id: data,
      name: name?.trim(),
      imageUrl,
      license: undefined,
      age: undefined,
      citizenship: undefined,
      nameInHomeCountry: undefined,
      dateOfBirth: undefined,
      placeOfBirth: undefined,
    };
  });

// ─── Club profile ──────────────────────────────────────────────────────────────
export const tmClubProfile = createServerFn({ method: "GET" })
  .inputValidator(id)
  .handler(async ({ data }: { data: string }) => {
    const html = await tmFetch(`/en/clubs/${data}/profile/verein/${data}`);
    const name =
      first(
        html,
        /<h1[^>]*class="[^"]*data-header__headline[^"]*"[^>]*>\s*(?:<[^>]+>\s*)*([^<\n]+)/,
      ) ??
      first(html, /<title>([^<|]+)/) ??
      data;
    const image = imgUrl(first(html, /class="data-header__profile-image"[^>]*src="([^"]+)"/));
    const mvStr = first(html, /class="[^"]*tm-club-market-value[^"]*"[^>]*>([^<]+)</);
    const currentMarketValue = parseMV(mvStr);
    return { id: data, name: name?.trim(), image, currentMarketValue };
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

export const wikiPage = createServerFn({ method: "GET" })
  .inputValidator(wikiTitle)
  .handler(async ({ data }: { data: string }) => {
    const cacheKey = `wiki:${data}`;
    const hit = getCached<{ title: string; html: string }>(cacheKey);
    if (hit) return hit;

    const res = await fetch(
      `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(data)}&prop=text|displaytitle&format=json&formatversion=2&redirects=1`,
      {
        headers: {
          "User-Agent": "FreeRoleLab/1.0 (fotbollsstatistik)",
          accept: "application/json",
        },
      },
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
  });

// ─── Competition table ─────────────────────────────────────────────────────────
const TM_API_BASE = "https://transfermarkt-api.fly.dev";

async function tmApiJson<T = any>(path: string, ttlMs = 3_600_000): Promise<T> {
  const key = `api:${path}`;
  const hit = getCached<T>(key);
  if (hit !== null) return hit;

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${TM_API_BASE}${path}`, {
      headers: { accept: "application/json" },
    });
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 1600 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`TM API svarade ${res.status}`);
    const body: T = await res.json();
    setCache(key, body, ttlMs);
    return body;
  }
  throw new Error("Transfermarkt-tjänsten är nere.");
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
            position: p.position,
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
