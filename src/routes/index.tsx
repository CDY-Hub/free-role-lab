import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { SearchBox } from "@/components/site-header";
import { Section, RatingPill } from "@/components/ui-bits";
import { players, getClub, formatSEK, positionNames, coaches } from "@/lib/data";
import { tmCompetitionTable } from "@/lib/tm.functions";

const REAL_LEAGUES = [
  { id: "SE1", name: "Allsvenskan", country: "Sverige" },
  { id: "SE2", name: "Superettan", country: "Sverige" },
  { id: "GB1", name: "Premier League", country: "England" },
  { id: "ES1", name: "La Liga", country: "Spanien" },
  { id: "L1", name: "Bundesliga", country: "Tyskland" },
  { id: "IT1", name: "Serie A", country: "Italien" },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ScoutLab – sök vilken fotbollsspelare som helst" },
      { name: "description", content: "Resultat, spelarprofiler, scoutrapporter och marknadsvärden – från toppligorna till division 3." },
      { property: "og:title", content: "ScoutLab – sök vilken fotbollsspelare som helst" },
      { property: "og:description", content: "Resultat, spelarprofiler, scoutrapporter och marknadsvärden – från toppligorna till division 3." },
    ],
  }),
  component: Index,
});

function Index() {
  const tables = useQueries({
    queries: REAL_LEAGUES.map((l) => ({
      queryKey: ["tm-table", l.id],
      queryFn: () => tmCompetitionTable({ data: l.id }),
      staleTime: 3600_000,
    })),
  });
  const top = [...players]
    .map((p) => ({ p, avg: p.matches.reduce((s, m) => s + m.rating, 0) / p.matches.length }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 8);
  const talents = players.filter((p) => p.age <= 20 && p.scoutReports[0]!.potential >= 4).slice(0, 6);

  return (
    <main className="mx-auto max-w-7xl px-4 pb-16">
      <section className="py-12 md:py-16">
        <p className="font-display text-sm font-bold tracking-widest text-primary">Från Champions League till division 3</p>
        <h1 className="mt-2 max-w-3xl font-display text-5xl font-extrabold leading-none md:text-7xl">
          Varje spelare. Varje match. <span className="text-primary">Varje detalj.</span>
        </h1>
        <div className="mt-8 max-w-3xl">
          <SearchBox big />
          <p className="mt-2 text-sm text-muted-foreground">
            Testa t.ex. <Link to="/sok" search={{ q: "Gyökeres" }} className="text-primary underline">Gyökeres</Link>,{" "}
            <Link to="/sok" search={{ q: "Lund" }} className="text-primary underline">Lund</Link> eller{" "}
            <Link to="/sok" search={{ q: "Arteta" }} className="text-primary underline">Arteta</Link>
          </p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Section title="Tabeller – uppdateras löpande" right={<span className="text-xs text-muted-foreground">Källa: Transfermarkt</span>}>
            <div className="space-y-6">
              {REAL_LEAGUES.map((l, i) => {
                const q = tables[i];
                const rows: any[] = q?.data?.[0]?.rows ?? [];
                return (
                  <div key={l.id}>
                    <div className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{l.country} · {l.name}</div>
                    {q?.isLoading && <p className="text-sm text-muted-foreground">Hämtar tabell…</p>}
                    {q?.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}
                    {rows.length > 0 && (
                      <table className="w-full text-sm">
                        <thead className="text-left text-xs uppercase text-muted-foreground">
                          <tr><th className="py-1 pr-2">#</th><th>Klubb</th><th className="text-center">M</th><th className="text-center">V-O-F</th><th className="text-center">GM–IM</th><th className="text-right">P</th></tr>
                        </thead>
                        <tbody className="divide-y">
                          {rows.map((r: any) => (
                            <tr key={r.clubId}>
                              <td className="py-1.5 pr-2 font-display font-bold text-muted-foreground">{r.position}</td>
                              <td className="max-w-40 truncate font-semibold">{r.clubName}</td>
                              <td className="text-center">{r.matches}</td>
                              <td className="text-center">{r.wins}-{r.draws}-{r.losses}</td>
                              <td className="text-center">{r.goalsFor}–{r.goalsAgainst}</td>
                              <td className="text-right font-bold text-primary">{r.points}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Formtoppen">
            <ol className="space-y-2">
              {top.map(({ p, avg }, i) => (
                <li key={p.id}>
                  <Link to="/spelare/$id" params={{ id: p.id }} className="flex items-center gap-3 rounded p-1 text-sm hover:bg-muted">
                    <span className="w-4 font-display font-bold text-muted-foreground">{i + 1}</span>
                    <span className="flex-1">
                      <span className="block font-semibold">{p.name}</span>
                      <span className="text-xs text-muted-foreground">{getClub(p.clubId)?.name}</span>
                    </span>
                    <RatingPill v={avg} />
                  </Link>
                </li>
              ))}
            </ol>
          </Section>
          <Section title="Scouternas talanger">
            <ul className="space-y-2">
              {talents.map((p) => (
                <li key={p.id}>
                  <Link to="/spelare/$id" params={{ id: p.id }} className="flex justify-between rounded p-1 text-sm hover:bg-muted">
                    <span>
                      <span className="block font-semibold">{p.name} ({p.age})</span>
                      <span className="text-xs text-muted-foreground">{positionNames[p.position]} · {getClub(p.clubId)?.name}</span>
                    </span>
                    <span className="text-xs font-bold text-primary">{formatSEK(p.marketValue)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Tränare">
            <ul className="space-y-1">
              {coaches.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link to="/tranare/$id" params={{ id: c.id }} className="flex justify-between rounded p-1 text-sm hover:bg-muted">
                    <span className="font-semibold">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{getClub(c.clubId)?.short}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>
      <p className="mt-10 text-center text-xs text-muted-foreground">
        Riktiga proffsspelare hämtas från Transfermarkt. Svenska lägre divisioner visas än så länge med exempeldata.
      </p>
    </main>
  );
}
