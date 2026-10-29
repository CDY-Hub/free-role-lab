import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SearchBox } from "@/components/site-header";
import { Section } from "@/components/ui-bits";
import { tmSearchAll } from "@/lib/tm.functions";
import { isLeagueSearch, matchingLeagues } from "@/lib/leagues";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/sok")({
  validateSearch: (s: Record<string, unknown>) => ({ q: typeof s["q"] === "string" ? s["q"] : "" }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Sök ligor, lag, spelare och tränare – Free Role Lab" },
      {
        name: "description",
        content: "Sök bland ligor, lag, spelare och tränare från Transfermarkt.",
      },
      { property: "og:title", content: "Sök – Free Role Lab" },
      {
        property: "og:description",
        content: "Sök bland ligor, lag, spelare och tränare från Transfermarkt.",
      },
    ],
  }),
  component: SearchPage,
});

const eur = (v?: number | null) =>
  v ? (v >= 1e6 ? `€${(v / 1e6).toFixed(1)}m` : `€${Math.round(v / 1000)}k`) : "–";

type Tab = "alla" | "ligor" | "lag" | "spelare" | "tranare";

const PREVIEW = { lag: 6, spelare: 8, tranare: 6 } as const;
const PAGE = { lag: 30, spelare: 30, tranare: 30 } as const;

function Avatar({
  src,
  name,
  round = true,
}: {
  src?: string | undefined;
  name: string;
  round?: boolean;
}) {
  const shape = round ? "rounded-full" : "rounded-md";
  return src ? (
    <img
      src={src}
      alt=""
      className={`size-9 ${shape} bg-muted object-cover`}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  ) : (
    <div
      className={`flex size-9 items-center justify-center ${shape} bg-muted font-display text-xs font-bold`}
    >
      {name.slice(0, 2)}
    </div>
  );
}

function SearchPage() {
  const { q } = Route.useSearch();
  const [tab, setTab] = useState<Tab>("alla");
  const [limit, setLimit] = useState<Record<string, number>>({});

  const term = q.trim();
  const leagueOnly = isLeagueSearch(q);
  const searchTm = term.length > 1 && !leagueOnly;

  const tm = useQuery({
    queryKey: ["tm-search", term.toLocaleLowerCase("sv")],
    queryFn: () => tmSearchAll({ data: term }),
    enabled: searchTm,
    staleTime: 3600_000,
    gcTime: 3600_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const leagues = term.length > 1 ? matchingLeagues(q) : [];
  const clubs = tm.data?.clubs ?? [];
  const players = tm.data?.players ?? [];
  const coaches = tm.data?.coaches ?? [];

  const counts: Record<Tab, number | null> = {
    alla: null,
    ligor: leagues.length,
    lag: searchTm ? (tm.data ? clubs.length : null) : 0,
    spelare: searchTm ? (tm.data ? players.length : null) : 0,
    tranare: searchTm ? (tm.data ? coaches.length : null) : 0,
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "alla", label: "Alla" },
    { id: "ligor", label: "Ligor" },
    { id: "lag", label: "Lag" },
    { id: "spelare", label: "Spelare" },
    { id: "tranare", label: "Tränare" },
  ];

  const show = (t: Exclude<Tab, "alla">) => tab === "alla" || tab === t;
  const cap = (key: "lag" | "spelare" | "tranare", total: number) => {
    if (tab === "alla") return PREVIEW[key];
    return limit[key] ?? Math.min(PAGE[key], total);
  };
  const more = (key: "lag" | "spelare" | "tranare", total: number) => {
    const shown = cap(key, total);
    if (shown >= total) return null;
    return (
      <div className="mt-4 text-center">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (tab === "alla") {
              setTab(key === "lag" ? "lag" : key === "spelare" ? "spelare" : "tranare");
            } else {
              setLimit((l) => ({ ...l, [key]: total }));
            }
          }}
        >
          {tab === "alla" ? `Visa alla ${total}` : `Visa alla ${total}`}
        </Button>
      </div>
    );
  };

  const nothingFound =
    term.length > 1 &&
    !tm.isLoading &&
    leagues.length === 0 &&
    clubs.length === 0 &&
    players.length === 0 &&
    coaches.length === 0;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div key={q}>
        <SearchBox initial={q} big />
      </div>
      <h1 className="font-display text-3xl font-bold">Resultat för "{q}"</h1>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Typ av resultat">
        {tabs.map((t) => (
          <Button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            variant={tab === t.id ? "default" : "outline"}
            size="sm"
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {counts[t.id] != null && (
              <span className="ml-1.5 text-xs opacity-80">{counts[t.id]}</span>
            )}
          </Button>
        ))}
      </div>

      {term.length <= 1 && (
        <p className="text-sm text-muted-foreground">Skriv minst två tecken för att söka.</p>
      )}

      {show("ligor") && leagues.length > 0 && (
        <Section title="Ligor">
          <ul className="divide-y text-sm">
            {leagues.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-3">
                <Link to="/liga/$id" params={{ id: l.id }} className="min-w-0 hover:text-primary">
                  <span className="block font-semibold">{l.name}</span>
                  <span className="text-xs text-muted-foreground">{l.country}</span>
                </Link>
                <Button variant="outline" asChild>
                  <Link to="/liga/$id" params={{ id: l.id }}>
                    Öppna ligan
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {searchTm && (
        <>
          {show("lag") && (
            <Section
              title={`Lag${tm.data ? ` (${clubs.length})` : ""}`}
              right={<span className="text-xs text-muted-foreground">Transfermarkt</span>}
            >
              {tm.isLoading && <p className="text-sm text-muted-foreground">Söker bland lag…</p>}
              {tm.error && (
                <p className="text-sm text-destructive">{(tm.error as Error).message}</p>
              )}
              {tm.data && clubs.length === 0 && (
                <p className="text-sm text-muted-foreground">Inga lag hittades.</p>
              )}
              <ul className="divide-y">
                {clubs.slice(0, cap("lag", clubs.length)).map((c) => (
                  <li key={c.id}>
                    <Link
                      to="/lag/$id"
                      params={{ id: c.id }}
                      search={{ n: c.name }}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm transition-colors hover:text-primary"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar src={c.imageUrl} name={c.name} round={false} />
                        <div className="min-w-0">
                          <span className="block truncate font-semibold">{c.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {[c.country, c.squadSize ? `${c.squadSize} spelare` : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </div>
                      </div>
                      <span className="shrink-0 font-display text-base font-extrabold text-primary">
                        {eur(c.marketValue)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {more("lag", clubs.length)}
            </Section>
          )}

          {show("spelare") && (
            <Section
              title={`Spelare${tm.data ? ` (${players.length})` : ""}`}
              right={<span className="text-xs text-muted-foreground">Transfermarkt</span>}
            >
              {tm.isLoading && (
                <p className="text-sm text-muted-foreground">Söker bland spelare…</p>
              )}
              {tm.data && players.length === 0 && (
                <p className="text-sm text-muted-foreground">Inga spelare hittades.</p>
              )}
              <ul className="divide-y">
                {players.slice(0, cap("spelare", players.length)).map((p) => (
                  <li key={p.id}>
                    <Link
                      to="/proffs/spelare/$id"
                      params={{ id: p.id }}
                      search={{ n: p.name }}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm transition-colors hover:text-primary"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar src={p.imageUrl} name={p.name} />
                        <div className="min-w-0">
                          <span className="block truncate font-semibold">{p.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {[
                              p.position,
                              p.club?.name,
                              p.age ? `${p.age} år` : null,
                              p.nationalities?.join(", "),
                            ]
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
              {more("spelare", players.length)}
            </Section>
          )}

          {show("tranare") && (
            <Section
              title={`Tränare${tm.data ? ` (${coaches.length})` : ""}`}
              right={<span className="text-xs text-muted-foreground">Transfermarkt</span>}
            >
              {tm.isLoading && (
                <p className="text-sm text-muted-foreground">Söker bland tränare…</p>
              )}
              {tm.data && coaches.length === 0 && (
                <p className="text-sm text-muted-foreground">Inga tränare hittades.</p>
              )}
              <ul className="divide-y">
                {coaches.slice(0, cap("tranare", coaches.length)).map((c) => (
                  <li key={c.id}>
                    <Link
                      to="/proffs/tranare/$id"
                      params={{ id: c.id }}
                      search={{ n: c.name }}
                      className="flex items-center gap-3 py-2.5 text-sm transition-colors hover:text-primary"
                    >
                      <Avatar src={c.imageUrl} name={c.name} />
                      <span className="font-semibold">{c.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              {more("tranare", coaches.length)}
            </Section>
          )}
        </>
      )}

      {nothingFound && (
        <p className="text-sm text-muted-foreground">
          Inga träffar.
          {tm.data?.meta.error
            ? ` Transfermarkt svarade inte just nu (${tm.data.meta.error}). Försök igen om en stund.`
            : ""}
        </p>
      )}

      {tm.data && (
        <p className="text-center text-xs text-muted-foreground">
          Källa:{" "}
          {tm.data.meta.source === "transfermarkt-api"
            ? "Transfermarkt (via API-tjänst)"
            : "Transfermarkt"}
          .
        </p>
      )}
    </main>
  );
}
