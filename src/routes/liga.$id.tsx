import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Section } from "@/components/ui-bits";
import { tmCompetitionTable, tmLeagueTopValues, wikiPage } from "@/lib/tm.functions";
import { LEAGUES } from "@/lib/leagues";

// Wikipedia-titel för ligans aktuella säsongssida (innehåller bl.a. skytteligan).
function seasonTitle(leagueId: string, leagueName: string) {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-indexerad
  if (leagueId === "SE1" || leagueId === "SE2") return `${y} ${leagueName}`; // svenska ligor spelar kalenderår
  const start = m >= 6 ? y : y - 1; // europasäsongen börjar i juli/augusti
  return `${start}–${String(start + 1).slice(2)} ${leagueName}`;
}

export const Route = createFileRoute("/liga/$id")({
  head: ({ params }) => {
    const league = LEAGUES.find((l) => l.id === params.id);
    const name = league ? league.name : "Liga";
    return {
      meta: [
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { title: `${name} – tabell, dyraste spelarna och skytteliga | Free Role Lab` },
        {
          name: "description",
          content: `Aktuell tabell, mest värda spelarna och skytteligan i ${name} – live från Transfermarkt och Wikipedia.`,
        },
        { property: "og:title", content: `${name} – Free Role Lab` },
        {
          property: "og:description",
          content: `Tabell, dyraste spelarna och skytteligan i ${name}.`,
        },
      ],
    };
  },
  component: LeaguePage,
});

const eur = (v?: number | null) =>
  v == null
    ? "–"
    : v >= 1e9
      ? `€${(v / 1e9).toFixed(2)} mdr`
      : v >= 1e6
        ? `€${(v / 1e6).toFixed(1)}m`
        : `€${Math.round(v / 1000)}k`;

function LeaguePage() {
  const { id } = Route.useParams();
  const league = LEAGUES.find((l) => l.id === id);

  const table = useQuery({
    queryKey: ["tm-table", id],
    queryFn: () => tmCompetitionTable({ data: id }),
    staleTime: 1800_000,
    retry: 1,
    enabled: !!league,
  });

  const topValues = useQuery({
    queryKey: ["tm-league-values", id],
    queryFn: () => tmLeagueTopValues({ data: id }),
    staleTime: 3600_000,
    retry: 1,
    enabled: !!league,
  });

  const season = useQuery({
    queryKey: ["wiki-season", id],
    queryFn: () => wikiPage({ data: seasonTitle(id, league!.name) }),
    staleTime: 3600_000,
    retry: 1,
    enabled: !!league,
  });

  if (!league) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-sm text-muted-foreground">
          Okänd liga.{" "}
          <Link to="/tabeller" search={{ liga: "" }} className="text-primary underline">
            Se alla ligor
          </Link>
          .
        </p>
      </main>
    );
  }

  const rows: any[] = table.data?.[0]?.rows ?? [];

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div>
        <p className="font-display text-sm font-bold tracking-widest text-primary">
          {league.country}
        </p>
        <h1 className="font-display text-4xl font-extrabold">{league.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Uppdateras löpande från Transfermarkt och Wikipedia.
        </p>
      </div>

      <Section
        title="Dyraste spelarna"
        right={<span className="text-xs text-muted-foreground">Källa: Transfermarkt</span>}
      >
        {topValues.isLoading && (
          <p className="text-sm text-muted-foreground">
            Hämtar marknadsvärden för hela ligan – tar en liten stund första gången…
          </p>
        )}
        {topValues.error && (
          <p className="text-sm text-destructive">{(topValues.error as Error).message}</p>
        )}
        {topValues.data && (
          <ol className="divide-y">
            {topValues.data.map((p: any, i: number) => (
              <li key={p.id}>
                <Link
                  to="/proffs/spelare/$id"
                  params={{ id: p.id }}
                  search={{ n: p.name }}
                  className="flex items-center gap-4 py-3 hover:text-primary"
                >
                  <span className="w-6 font-display text-xl font-extrabold text-muted-foreground">
                    {i + 1}
                  </span>
                  {p.imageUrl && (
                    <img
                      src={p.imageUrl}
                      alt=""
                      className="size-12 rounded-full border object-cover"
                      loading="lazy"
                    />
                  )}
                  <span className="flex-1">
                    <span className="block font-display text-lg font-bold">{p.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {p.position} · {p.club} · {p.age} år
                    </span>
                  </span>
                  <span className="font-display text-xl font-extrabold text-primary">
                    {eur(p.marketValue)}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section
        title="Tabell"
        right={<span className="text-xs text-muted-foreground">Källa: Transfermarkt</span>}
      >
        {table.isLoading && <p className="text-sm text-muted-foreground">Hämtar tabell…</p>}
        {table.error && (
          <p className="text-sm text-destructive">{(table.error as Error).message}</p>
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
                  <td className="max-w-40 truncate font-semibold">
                    {r.clubId ? (
                      <Link
                        to="/lag/$id"
                        params={{ id: String(r.clubId) }}
                        search={{ n: String(r.clubName) }}
                        className="hover:text-primary"
                      >
                        {r.clubName}
                      </Link>
                    ) : (
                      r.clubName
                    )}
                  </td>
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

      <Section
        title="Skytteliga och säsongsfakta"
        right={<span className="text-xs text-muted-foreground">Källa: Wikipedia</span>}
      >
        {season.isLoading && <p className="text-sm text-muted-foreground">Hämtar säsongssidan…</p>}
        {season.error && (
          <p className="text-sm text-muted-foreground">
            Säsongssidan finns inte på Wikipedia ännu.
          </p>
        )}
        {season.data && (
          <article className="wiki-body" dangerouslySetInnerHTML={{ __html: season.data.html }} />
        )}
      </Section>

      <Section title="Kommande derby">
        <p className="text-sm text-muted-foreground">
          Transfermarkts öppna data har ingen matchkalender, så vi kan tyvärr inte visa kommande
          derbyn utan att hitta på datum. Vi visar hellre ingenting än felaktiga siffror.
        </p>
      </Section>
    </main>
  );
}
