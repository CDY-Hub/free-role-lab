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
