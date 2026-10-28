import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { Section } from "@/components/ui-bits";
import { tmCompetitionTable } from "@/lib/tm.functions";
import { matchingLeagues } from "@/lib/leagues";

export const Route = createFileRoute("/tabeller")({
  validateSearch: (s: Record<string, unknown>) => ({
    liga: typeof s["liga"] === "string" ? s["liga"] : "",
  }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Ligatabeller – Free Role Lab" },
      {
        name: "description",
        content:
          "Aktuella tabeller för Allsvenskan, Superettan, Premier League, LaLiga, Bundesliga, Serie A och Ligue 1.",
      },
      { property: "og:title", content: "Ligatabeller – Free Role Lab" },
      { property: "og:description", content: "Aktuella tabeller från Europas största ligor." },
    ],
  }),
  component: TablesPage,
});

function TablesPage() {
  const { liga } = Route.useSearch();
  const leagues = matchingLeagues(liga);
  const tables = useQueries({
    queries: leagues.map((l) => ({
      queryKey: ["tm-table", l.id],
      queryFn: () => tmCompetitionTable({ data: l.id }),
      staleTime: 1800_000,
      retry: 1,
    })),
  });

  const filter = liga.trim().toLowerCase();
  const visible = leagues.map((l, i) => ({ l, q: tables[i] }));

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <h1 className="font-display text-4xl font-extrabold">Ligatabeller</h1>
      <p className="text-sm text-muted-foreground">
        Uppdateras löpande från Transfermarkt.{" "}
        {filter && (
          <>
            Visar träffar för "{liga}" –{" "}
            <Link to="/tabeller" search={{ liga: "" }} className="text-primary underline">
              visa alla
            </Link>
            .
          </>
        )}
      </p>
      {visible.map(({ l, q }) => {
        const rows: any[] = q?.data?.[0]?.rows ?? [];
        return (
          <Section
            key={l.id}
            title={`${l.country} · ${l.name}`}
            right={
              <Link
                to="/liga/$id"
                params={{ id: l.id }}
                className="text-xs font-semibold text-primary underline"
              >
                Öppna ligan
              </Link>
            }
          >
            {q?.isLoading && <p className="text-sm text-muted-foreground">Hämtar tabell…</p>}
            {q?.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}
            {q?.isSuccess && rows.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Ingen tabell tillgänglig från Transfermarkt just nu.
              </p>
            )}
            {rows.length > 0 && (
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-2">#</th>
                    <th>Klubb</th>
                    <th className="text-center">M</th>
                    <th className="text-center">V-O-F</th>
                    <th className="text-center">GM–IM</th>
                    <th className="text-right">P</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r: any) => (
                    <tr key={r.clubId}>
                      <td className="py-1.5 pr-2 font-display font-bold text-muted-foreground">
                        {r.position}
                      </td>
                      <td className="max-w-40 truncate font-semibold">{r.clubName}</td>
                      <td className="text-center">{r.matches}</td>
                      <td className="text-center">
                        {r.wins}-{r.draws}-{r.losses}
                      </td>
                      <td className="text-center">
                        {r.goalsFor}–{r.goalsAgainst}
                      </td>
                      <td className="text-right font-bold text-primary">{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        );
      })}
      {visible.length === 0 && (
        <p className="text-sm text-muted-foreground">Ingen liga matchar "{liga}".</p>
      )}
    </main>
  );
}
