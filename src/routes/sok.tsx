import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SearchBox } from "@/components/site-header";
import { Section } from "@/components/ui-bits";
import { search, getClub, positionNames, formatSEK, getLeague } from "@/lib/data";
import { tmSearchPlayers, tmSearchCoaches } from "@/lib/tm.functions";

export const Route = createFileRoute("/sok")({
  validateSearch: (s: Record<string, unknown>) => ({ q: typeof s["q"] === "string" ? s["q"] : "" }),
  head: () => ({
    meta: [
      { title: "Sök spelare och tränare – ScoutLab" },
      { name: "description", content: "Sök bland proffs och amatörer, tränare och klubbar." },
      { property: "og:title", content: "Sök – ScoutLab" },
      { property: "og:description", content: "Sök bland proffs och amatörer, tränare och klubbar." },
    ],
  }),
  component: SearchPage,
});

const eur = (v?: number | null) => (v ? (v >= 1e6 ? `€${(v / 1e6).toFixed(1)}m` : `€${Math.round(v / 1000)}k`) : "–");

function SearchPage() {
  const { q } = Route.useSearch();
  const local = search(q);
  const tmPlayers = useQuery({ queryKey: ["tm-sp", q], queryFn: () => tmSearchPlayers({ data: q }), enabled: q.length > 1, staleTime: 3600_000 });
  const tmCoaches = useQuery({ queryKey: ["tm-sc", q], queryFn: () => tmSearchCoaches({ data: q }), enabled: q.length > 1, staleTime: 3600_000 });

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <SearchBox key={q} initial={q} big />
      <h1 className="font-display text-3xl font-bold">Resultat för "{q}"</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Spelare – proffsligor" right={<span className="text-xs text-muted-foreground">Transfermarkt</span>}>
          {tmPlayers.isLoading && <p className="text-sm text-muted-foreground">Hämtar…</p>}
          {tmPlayers.error && <p className="text-sm text-destructive">{(tmPlayers.error as Error).message}</p>}
          {tmPlayers.data?.length === 0 && <p className="text-sm text-muted-foreground">Inga träffar.</p>}
          <ul className="divide-y">
            {tmPlayers.data?.slice(0, 15).map((p: any) => (
              <li key={p.id}>
                <Link to="/proffs/spelare/$id" params={{ id: p.id }} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-primary">
                  <span>
                    <span className="block font-semibold">{p.name}</span>
                    <span className="text-xs text-muted-foreground">{p.position} · {p.club?.name} · {p.age} år · {p.nationalities?.join(", ")}</span>
                  </span>
                  <span className="font-bold text-primary">{eur(p.marketValue)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Spelare – Sverige (lägre divisioner)">
          {local.players.length === 0 && <p className="text-sm text-muted-foreground">Inga träffar.</p>}
          <ul className="divide-y">
            {local.players.slice(0, 15).map((p) => {
              const c = getClub(p.clubId)!;
              return (
                <li key={p.id}>
                  <Link to="/spelare/$id" params={{ id: p.id }} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-primary">
                    <span>
                      <span className="block font-semibold">{p.name}</span>
                      <span className="text-xs text-muted-foreground">{positionNames[p.position]} · {c.name} · {getLeague(c.leagueId)?.name}</span>
                    </span>
                    <span className="font-bold text-primary">{formatSEK(p.marketValue)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Section>

        <Section title="Tränare">
          {tmCoaches.isLoading && <p className="text-sm text-muted-foreground">Hämtar…</p>}
          <ul className="divide-y">
            {local.coaches.map((c) => (
              <li key={c.id}>
                <Link to="/tranare/$id" params={{ id: c.id }} className="block py-2 text-sm hover:text-primary">
                  <span className="font-semibold">{c.name}</span> <span className="text-xs text-muted-foreground">· {getClub(c.clubId)?.name}</span>
                </Link>
              </li>
            ))}
            {tmCoaches.data?.slice(0, 10).map((c: any) => (
              <li key={c.id}>
                <Link to="/proffs/tranare/$id" params={{ id: c.id }} className="block py-2 text-sm hover:text-primary">
                  <span className="font-semibold">{c.name}</span>{" "}
                  <span className="text-xs text-muted-foreground">· {c.citizenship?.join(", ")} · {c.license ?? ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        {local.clubs.length > 0 && (
          <Section title="Klubbar">
            <ul className="divide-y text-sm">
              {local.clubs.map((c) => (
                <li key={c.id} className="py-2">
                  <span className="font-semibold">{c.name}</span> <span className="text-xs text-muted-foreground">· {getLeague(c.leagueId)?.name}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </main>
  );
}
