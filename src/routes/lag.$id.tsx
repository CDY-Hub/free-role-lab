import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Section, Stat } from "@/components/ui-bits";
import { tmClubProfile, tmClubSquad, type TmPlayerHit } from "@/lib/tm.functions";
import { positionGroup } from "@/lib/tm-parse";

export const Route = createFileRoute("/lag/$id")({
  head: () => ({
    meta: [
      { title: "Lag och trupp | Free Role Lab" },
      {
        name: "description",
        content: "Trupp, marknadsvärde och spelare för klubben – live från Transfermarkt.",
      },
      { property: "og:title", content: "Lag och trupp | Free Role Lab" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClubPage,
});

const eur = (v?: number | null) =>
  v == null
    ? "–"
    : v >= 1e9
      ? `€${(v / 1e9).toFixed(2)} mdr`
      : v >= 1e6
        ? `€${(v / 1e6).toFixed(1)}m`
        : `€${Math.round(v / 1000)}k`;

const GROUPS = ["Målvakter", "Försvarare", "Mittfältare", "Anfallare", "Övriga"] as const;

function ClubPage() {
  const { id } = Route.useParams();

  const club = useQuery({
    queryKey: ["tm-club", id],
    queryFn: () => tmClubProfile({ data: id }),
    staleTime: 3600_000,
    retry: 1,
  });
  const squad = useQuery({
    queryKey: ["tm-squad", id],
    queryFn: () => tmClubSquad({ data: id }),
    staleTime: 3600_000,
    retry: 1,
  });

  const players = squad.data ?? [];
  const byGroup = new Map<string, TmPlayerHit[]>();
  for (const p of players) {
    const g = positionGroup(p.position);
    byGroup.set(g, [...(byGroup.get(g) ?? []), p]);
  }
  const totalValue = players.reduce((sum, p) => sum + (p.marketValue ?? 0), 0);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-center gap-5 rounded-xl border bg-card p-6">
        {club.data?.image && (
          <img
            src={club.data.image}
            alt=""
            className="size-20 object-contain"
            referrerPolicy="no-referrer"
          />
        )}
        <div>
          <p className="font-display text-sm font-bold tracking-widest text-primary">Lag</p>
          <h1 className="font-display text-4xl font-extrabold">
            {club.data?.name ?? (club.isLoading ? "Hämtar…" : "Okänt lag")}
          </h1>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Spelare i truppen" value={players.length || "–"} />
        <Stat
          label="Marknadsvärde"
          value={eur(club.data?.currentMarketValue ?? (totalValue || null))}
        />
        <Stat label="Källa" value="Transfermarkt" />
      </div>

      {squad.isLoading && <p className="text-sm text-muted-foreground">Hämtar truppen…</p>}
      {squad.data && players.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Kunde inte hämta truppen just nu. Försök igen om en stund.{" "}
          <Link to="/sok" search={{ q: "" }} className="text-primary underline">
            Tillbaka till sök
          </Link>
        </p>
      )}

      {GROUPS.filter((g) => byGroup.has(g)).map((g) => {
        const list = [...(byGroup.get(g) ?? [])].sort(
          (a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0),
        );
        return (
          <Section key={g} title={`${g} (${list.length})`}>
            <ul className="divide-y">
              {list.map((p) => (
                <li key={p.id}>
                  <Link
                    to="/proffs/spelare/$id"
                    params={{ id: p.id }}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm transition-colors hover:text-primary"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt=""
                          className="size-9 rounded-full bg-muted object-cover"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex size-9 items-center justify-center rounded-full bg-muted font-display text-xs font-bold">
                          {p.name.slice(0, 2)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="block truncate font-semibold">{p.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[p.position, p.age ? `${p.age} år` : null, p.nationalities?.join(", ")]
                            .filter(Boolean)
                            .join(" · ")}
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
          </Section>
        );
      })}
    </main>
  );
}
