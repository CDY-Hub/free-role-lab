import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SearchBox } from "@/components/site-header";
import { Section } from "@/components/ui-bits";
import { tmSearchPlayers, tmSearchCoaches } from "@/lib/tm.functions";
import { isLeagueSearch, matchingLeagues } from "@/lib/leagues";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/sok")({
  validateSearch: (s: Record<string, unknown>) => ({ q: typeof s["q"] === "string" ? s["q"] : "" }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Sök spelare, tränare och ligor – Free Role Lab" },
      { name: "description", content: "Sök bland spelare, tränare och ligor från Transfermarkt." },
      { property: "og:title", content: "Sök – Free Role Lab" },
      { property: "og:description", content: "Sök bland spelare, tränare och ligor från Transfermarkt." },
    ],
  }),
  component: SearchPage,
});

const eur = (v?: number | null) => (v ? (v >= 1e6 ? `€${(v / 1e6).toFixed(1)}m` : `€${Math.round(v / 1000)}k`) : "–");

function SearchPage() {
  const { q } = Route.useSearch();
  const [showAllPlayers, setShowAllPlayers] = useState(false);
  const [showAllCoaches, setShowAllCoaches] = useState(false);

  const leagueOnly = isLeagueSearch(q);
  const searchPeople = q.trim().length > 1 && !leagueOnly;
  const tmPlayers = useQuery({
    queryKey: ["tm-sp", q.trim().toLocaleLowerCase("sv")],
    queryFn: () => tmSearchPlayers({ data: q.trim() }),
    enabled: searchPeople,
    staleTime: 3600_000,
    gcTime: 3600_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const tmCoaches = useQuery({
    queryKey: ["tm-sc", q.trim().toLocaleLowerCase("sv")],
    queryFn: () => tmSearchCoaches({ data: q.trim() }),
    enabled: searchPeople,
    staleTime: 3600_000,
    gcTime: 3600_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const leagueHits = q.trim().length > 1 ? matchingLeagues(q) : [];

  const players = tmPlayers.data ?? [];
  const coaches = tmCoaches.data ?? [];
  const visiblePlayers = showAllPlayers ? players : players.slice(0, 30);
  const visibleCoaches = showAllCoaches ? coaches : coaches.slice(0, 20);

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <SearchBox key={q} initial={q} big />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-3xl font-bold">Resultat för "{q}"</h1>
        {players.length > 0 && (
          <span className="text-xs text-muted-foreground">Hittade {players.length} spelare</span>
        )}
      </div>

      {leagueHits.length > 0 && (
        <Section title="Ligor">
          <ul className="divide-y text-sm">
            {leagueHits.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-3">
                <Link to="/liga/$id" params={{ id: l.id }} className="min-w-0 hover:text-primary">
                  <span className="block font-semibold">{l.name}</span>
                  <span className="text-xs text-muted-foreground">{l.country}</span>
                </Link>
                <Button variant="outline" asChild>
                  <Link to="/liga/$id" params={{ id: l.id }}>Öppna ligan</Link>
                </Button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {!leagueOnly && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Section
            title={`Spelare (${players.length})`}
            right={<span className="text-xs text-muted-foreground">Live från Transfermarkt</span>}
          >
            {tmPlayers.isLoading && <p className="text-sm text-muted-foreground">Söker bland spelare…</p>}
            {tmPlayers.error && <p className="text-sm text-destructive">{(tmPlayers.error as Error).message}</p>}
            {!tmPlayers.isLoading && players.length === 0 && <p className="text-sm text-muted-foreground">Inga spelare hittades.</p>}
            <ul className="divide-y">
              {visiblePlayers.map((p: any) => (
                <li key={p.id}>
                  <Link
                    to="/proffs/spelare/$id"
                    params={{ id: p.id }}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm transition-colors hover:text-primary"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt="" className="size-9 rounded-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex size-9 items-center justify-center rounded-full bg-muted font-display text-xs font-bold">
                          {p.name?.slice(0, 2)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="block truncate font-semibold">{p.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[p.position, p.club?.name, p.age ? `${p.age} år` : null, p.nationalities?.join(", ")].filter(Boolean).join(" · ")}
                        </span>
                      </div>
                    </div>
                    <span className="shrink-0 font-display text-base font-extrabold text-primary">
                      {eur(p.marketValue)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {players.length > 30 && !showAllPlayers && (
              <div className="mt-4 text-center">
                <Button variant="outline" size="sm" onClick={() => setShowAllPlayers(true)}>
                  Visa alla {players.length} spelare
                </Button>
              </div>
            )}
          </Section>

          <Section
            title={`Tränare (${coaches.length})`}
            right={<span className="text-xs text-muted-foreground">Live från Transfermarkt</span>}
          >
            {tmCoaches.isLoading && <p className="text-sm text-muted-foreground">Söker bland tränare…</p>}
            {tmCoaches.error && <p className="text-sm text-destructive">{(tmCoaches.error as Error).message}</p>}
            {!tmCoaches.isLoading && coaches.length === 0 && <p className="text-sm text-muted-foreground">Inga tränare hittades.</p>}
            <ul className="divide-y">
              {visibleCoaches.map((c: any) => (
                <li key={c.id}>
                  <Link
                    to="/proffs/tranare/$id"
                    params={{ id: c.id }}
                    className="block py-2.5 text-sm transition-colors hover:text-primary"
                  >
                    <span className="font-semibold">{c.name}</span>{" "}
                    <span className="text-xs text-muted-foreground">
                      · {[c.citizenship?.join(", "), c.license].filter(Boolean).join(" · ")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {coaches.length > 20 && !showAllCoaches && (
              <div className="mt-4 text-center">
                <Button variant="outline" size="sm" onClick={() => setShowAllCoaches(true)}>
                  Visa alla {coaches.length} tränare
                </Button>
              </div>
            )}
          </Section>
        </div>
      )}
    </main>
  );
}
