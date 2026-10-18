import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
      { name: "description", content: "Sök bland spelare, tränare och ligor." },
      { property: "og:title", content: "Sök – Free Role Lab" },
      { property: "og:description", content: "Sök bland spelare, tränare och ligor." },
    ],
  }),
  component: SearchPage,
});

const eur = (v?: number | null) => (v ? (v >= 1e6 ? `€${(v / 1e6).toFixed(1)}m` : `€${Math.round(v / 1000)}k`) : "–");

function SearchPage() {
  const { q } = Route.useSearch();
  const leagueOnly = isLeagueSearch(q);
  const searchPeople = q.trim().length > 1 && !leagueOnly;
  const tmPlayers = useQuery({ queryKey: ["tm-sp", q.trim().toLocaleLowerCase("sv")], queryFn: () => tmSearchPlayers({ data: q.trim() }), enabled: searchPeople, staleTime: 3600_000, gcTime: 3600_000, retry: 1, refetchOnWindowFocus: false });
  const tmCoaches = useQuery({ queryKey: ["tm-sc", q.trim().toLocaleLowerCase("sv")], queryFn: () => tmSearchCoaches({ data: q.trim() }), enabled: searchPeople, staleTime: 3600_000, gcTime: 3600_000, retry: 1, refetchOnWindowFocus: false });
  const leagueHits = q.trim().length > 1 ? matchingLeagues(q) : [];

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <SearchBox key={q} initial={q} big />
      <h1 className="font-display text-3xl font-bold">Resultat för "{q}"</h1>

      {leagueHits.length > 0 && (
        <Section title="Ligor">
          <ul className="divide-y text-sm">
            {leagueHits.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-3">
                <Link to="/tabeller" search={{ liga: l.name }} className="min-w-0 hover:text-primary">
                  <span className="block font-semibold">{l.name}</span>
                  <span className="text-xs text-muted-foreground">{l.country}</span>
                </Link>
                <Button variant="outline" asChild>
                  <Link to="/tabeller" search={{ liga: l.name }}>Visa tabell</Link>
                </Button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {!leagueOnly && (
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Spelare" right={<span className="text-xs text-muted-foreground">Transfermarkt</span>}>
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

        <Section title="Tränare">
          {tmCoaches.isLoading && <p className="text-sm text-muted-foreground">Hämtar…</p>}
          {tmCoaches.error && <p className="text-sm text-destructive">{(tmCoaches.error as Error).message}</p>}
          {tmCoaches.data?.length === 0 && <p className="text-sm text-muted-foreground">Inga träffar.</p>}
          <ul className="divide-y">
            {tmCoaches.data?.slice(0, 12).map((c: any) => (
              <li key={c.id}>
                <Link to="/proffs/tranare/$id" params={{ id: c.id }} className="block py-2 text-sm hover:text-primary">
                  <span className="font-semibold">{c.name}</span>{" "}
                  <span className="text-xs text-muted-foreground">· {c.citizenship?.join(", ")} · {c.license ?? ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>

      </div>
      )}
    </main>
  );
}
