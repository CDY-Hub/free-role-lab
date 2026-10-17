import { createServerFn } from "@tanstack/react-start";

const BASE = "https://transfermarkt-api.fly.dev";

async function tm<T = any>(path: string): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${BASE}${path}`, { headers: { accept: "application/json" } });
    const body: any = await res.json().catch(() => null);
    const limited = res.status === 429 || (body && typeof body.error === "string" && body.error.includes("Rate limit"));
    if (limited) {
      await new Promise((r) => setTimeout(r, 1600 * (attempt + 1)));
      continue;
    }
    if (!res.ok || !body) throw new Error(`Transfermarkt svarade ${res.status}`);
    return body as T;
  }
  throw new Error("Transfermarkt är upptaget just nu, försök igen om en stund.");
}

const str = (d: unknown) => {
  if (typeof d !== "string" || !d.trim() || d.length > 100) throw new Error("Ogiltig sökning");
  return encodeURIComponent(d.trim());
};
const id = (d: unknown) => {
  if (typeof d !== "string" || !/^\d+$/.test(d)) throw new Error("Ogiltigt id");
  return d;
};

export const tmSearchPlayers = createServerFn({ method: "GET" })
  .inputValidator(str)
  .handler(async ({ data }) => (await tm<any>(`/players/search/${data}`)).results ?? []);

export const tmSearchCoaches = createServerFn({ method: "GET" })
  .inputValidator(str)
  .handler(async ({ data }) => (await tm<any>(`/coaches/search/${data}`)).results ?? []);

export const tmPlayerProfile = createServerFn({ method: "GET" })
  .inputValidator(id)
  .handler(async ({ data }) => tm<any>(`/players/${data}/profile`));

export const tmPlayerStats = createServerFn({ method: "GET" })
  .inputValidator(id)
  .handler(async ({ data }) => (await tm<any>(`/players/${data}/stats`)).stats ?? []);

export const tmPlayerTransfers = createServerFn({ method: "GET" })
  .inputValidator(id)
  .handler(async ({ data }) => (await tm<any>(`/players/${data}/transfers`)).transfers ?? []);

export const tmPlayerMatches = createServerFn({ method: "GET" })
  .inputValidator(id)
  .handler(async ({ data }) => (await tm<any>(`/players/${data}/matches`)).matches ?? []);

export const tmCoachProfile = createServerFn({ method: "GET" })
  .inputValidator(id)
  .handler(async ({ data }) => tm<any>(`/coaches/${data}/profile`));

export const tmClubProfile = createServerFn({ method: "GET" })
  .inputValidator(id)
  .handler(async ({ data }) => tm<any>(`/clubs/${data}/profile`));

const ids = (d: unknown) => {
  if (!Array.isArray(d) || d.length === 0 || d.length > 20 || !d.every((x) => typeof x === "string" && /^\d+$/.test(x)))
    throw new Error("Ogiltiga id:n");
  return d as string[];
};

async function pool<T, R>(items: T[], fn: (item: T) => Promise<R | null>, concurrency = 3): Promise<R[]> {
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

export const tmPlayersBatch = createServerFn({ method: "GET" })
  .inputValidator(ids)
  .handler(async ({ data }) =>
    pool(data, async (pid) => {
      try {
        const p = await tm<any>(`/players/${pid}/profile`);
        return {
          id: p.id, name: p.name, imageUrl: p.imageUrl, age: p.age,
          citizenship: p.citizenship, marketValue: p.marketValue,
          position: p.position?.main, club: p.club ? { name: p.club.name, id: p.club.id } : null,
        };
      } catch { return null; }
    }),
  );

export const tmClubsBatch = createServerFn({ method: "GET" })
  .inputValidator(ids)
  .handler(async ({ data }) =>
    pool(data, async (cid) => {
      try {
        const c = await tm<any>(`/clubs/${cid}/profile`);
        return {
          id: c.id, name: c.name, image: c.image, currentMarketValue: c.currentMarketValue,
          squadSize: c.squad?.size, league: c.league ? { name: c.league.name, country: c.league.countryName } : null,
        };
      } catch { return null; }
    }),
  );

const wikiTitle = (d: unknown) => {
  if (typeof d !== "string" || !d.trim() || d.length > 150 || !/^[\w ()%,.'\-–]+$/u.test(d.trim())) throw new Error("Ogiltig artikel");
  return d.trim();
};

export const wikiPage = createServerFn({ method: "GET" })
  .inputValidator(wikiTitle)
  .handler(async ({ data }) => {
    const res = await fetch(
      `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(data)}&prop=text|displaytitle&format=json&formatversion=2&redirects=1`,
      { headers: { "User-Agent": "FreeRoleLab/1.0 (fotbollsstatistik)", accept: "application/json" } },
    );
    const body: any = await res.json().catch(() => null);
    if (!res.ok || !body?.parse?.text) throw new Error("Kunde inte hämta artikeln från Wikipedia.");
    let html: string = body.parse.text;
    html = html
      .replace(/href="\/wiki\//g, 'href="https://en.wikipedia.org/wiki/')
      .replace(/href="\/w\//g, 'href="https://en.wikipedia.org/w/')
      .replace(/<a href="https:\/\/en\.wikipedia\.org/g, '<a target="_blank" rel="noopener" href="https://en.wikipedia.org')
      .replace(/src="\/\//g, 'src="https://')
      .replace(/srcset="\/\//g, 'srcset="https://');
    return { title: body.parse.title as string, html };
  });

const comp = (d: unknown) => {
  if (typeof d !== "string" || !/^[A-Z0-9]{2,6}$/.test(d)) throw new Error("Ogiltig serie");
  return d;
};

export const tmCompetitionTable = createServerFn({ method: "GET" })
  .inputValidator(comp)
  .handler(async ({ data }) => (await tm<any>(`/competitions/${data}/table`)).tables ?? []);

export const tmPlayerMatchesSeason = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => {
    if (typeof d !== "object" || d === null) throw new Error("Ogiltig sökning");
    const { playerId, seasonId } = d as Record<string, unknown>;
    return { playerId: id(playerId), seasonId: id(seasonId) };
  })
  .handler(async ({ data }) => (await tm<any>(`/players/${data.playerId}/matches?season_id=${data.seasonId}`)).matches ?? []);
