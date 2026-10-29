import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SearchBox } from "@/components/site-header";
import { Section } from "@/components/ui-bits";
import { tmCompetitionTable, tmMostValuableClubs, tmMostValuablePlayers } from "@/lib/tm.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Free Role Lab – sök vilken fotbollsspelare som helst" },
      {
        name: "description",
        content:
          "Spelarprofiler, marknadsvärden, tabeller och fotbollshistorik – allt från riktiga datakällor.",
      },
      { property: "og:title", content: "Free Role Lab – sök vilken fotbollsspelare som helst" },
      {
        property: "og:description",
        content:
          "Spelarprofiler, marknadsvärden, tabeller och fotbollshistorik – allt från riktiga datakällor.",
      },
    ],
  }),
  component: Index,
});

const FORM_LEAGUES = [
  { id: "GB1", name: "Premier League" },
  { id: "ES1", name: "LaLiga" },
  { id: "IT1", name: "Serie A" },
  { id: "L1", name: "Bundesliga" },
  { id: "FR1", name: "Ligue 1" },
  { id: "SE1", name: "Allsvenskan" },
];

const eur = (v?: number | null) =>
  v == null
    ? "–"
    : v >= 1e9
      ? `€${(v / 1e9).toFixed(2)} mdr`
      : v >= 1e6
        ? `€${(v / 1e6).toFixed(1)}m`
        : `€${Math.round(v / 1000)}k`;

const TABS = [
  { key: "world", label: "Dyraste i världen" },
  { key: "sweden", label: "Dyraste i Sverige" },
  { key: "clubs", label: "Mest värda klubbarna" },
  { key: "form", label: "Formstarkast i Europa" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const LIST_SIZE = 10;

function RankingError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <p className="text-sm text-destructive">
      {message}{" "}
      <button className="underline" onClick={onRetry}>
        Försök igen
      </button>
    </p>
  );
}

// Följer Transfermarkts egen lista (Most valuable players), så att ordning och siffror stämmer med
// källan. "Dyraste i Sverige" är samma lista filtrerad på svenska spelare.
function PlayerList({ scope }: { scope: "world" | "sweden" }) {
  const q = useQuery({
    queryKey: ["tm-valuable-players", scope],
    queryFn: () => tmMostValuablePlayers({ data: scope }),
    staleTime: 3600_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  if (q.isLoading) {
    return <p className="text-sm text-muted-foreground">Hämtar Transfermarkts spelarlista…</p>;
  }
  if (q.error || !q.data) {
    return (
      <RankingError
        message="Transfermarkts spelarlista gick inte att läsa just nu."
        onRetry={() => q.refetch()}
      />
    );
  }
  return (
    <ol className="divide-y">
      {q.data.slice(0, LIST_SIZE).map((p) => (
        <li key={p.id}>
          <Link
            to="/proffs/spelare/$id"
            params={{ id: p.id }}
            className="flex items-center gap-4 py-3 hover:text-primary"
          >
            <span className="w-6 font-display text-xl font-extrabold text-muted-foreground">
              {p.rank}
            </span>
            {p.imageUrl && (
              <img
                src={p.imageUrl}
                alt=""
                className="size-12 rounded-full border bg-muted object-cover object-top"
                loading="lazy"
              />
            )}
            <span className="flex-1">
              <span className="block font-display text-lg font-bold">{p.name}</span>
              <span className="text-xs text-muted-foreground">
                {[p.position, p.club?.name, p.age ? `${p.age} år` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            <span className="font-display text-xl font-extrabold text-primary">
              {eur(p.marketValue)}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

// Följer Transfermarkts egen lista (Most valuable teams). Klubbmärkena hämtas i storleken "big"
// (180 px) i stället för listans 15 px-ikoner, annars blir de suddiga och pixliga.
function ClubList() {
  const q = useQuery({
    queryKey: ["tm-valuable-clubs"],
    queryFn: () => tmMostValuableClubs(),
    staleTime: 3600_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  if (q.isLoading) {
    return <p className="text-sm text-muted-foreground">Hämtar Transfermarkts klubblista…</p>;
  }
  if (q.error || !q.data) {
    return (
      <RankingError
        message="Transfermarkts klubblista gick inte att läsa just nu."
        onRetry={() => q.refetch()}
      />
    );
  }
  return (
    <ol className="divide-y">
      {q.data.slice(0, LIST_SIZE).map((c) => (
        <li key={c.id}>
          <Link
            to="/lag/$id"
            params={{ id: c.id }}
            className="flex items-center gap-4 py-3 hover:text-primary"
          >
            <span className="w-6 font-display text-xl font-extrabold text-muted-foreground">
              {c.rank}
            </span>
            {c.imageUrl ? (
              <img
                src={c.imageUrl}
                alt=""
                width={48}
                height={48}
                className="size-12 shrink-0 object-contain"
                loading="lazy"
              />
            ) : (
              <span className="size-12 shrink-0" aria-hidden="true" />
            )}
            <span className="flex-1">
              <span className="block font-display text-lg font-bold">{c.name}</span>
              <span className="text-xs text-muted-foreground">
                {[c.league?.name, c.country].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span className="font-display text-xl font-extrabold text-primary">
              {eur(c.marketValue)}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

function FormList() {
  const tables = useQueries({
    queries: FORM_LEAGUES.map((l) => ({
      queryKey: ["tm-table", l.id],
      queryFn: () => tmCompetitionTable({ data: l.id }),
      staleTime: 1800_000,
      retry: 1,
    })),
  });
  const loading = tables.some((t: any) => t.isLoading);
  const rows: any[] = [];
  tables.forEach((t: any, i: number) => {
    for (const r of t.data?.[0]?.rows ?? []) {
      if (!r.matches) continue;
      rows.push({
        club: r.clubName,
        league: FORM_LEAGUES[i]!.name,
        matches: r.matches,
        w: r.wins,
        d: r.draws,
        l: r.losses,
        gf: r.goalsFor,
        ga: r.goalsAgainst,
        ppg: r.points / r.matches,
        gd: (r.goalsFor - r.goalsAgainst) / r.matches,
      });
    }
  });
  if (loading)
    return <p className="text-sm text-muted-foreground">Räknar ut formen i Europas ligor…</p>;
  const top = rows.sort((a, b) => b.ppg - a.ppg || b.gd - a.gd).slice(0, 5);
  return (
    <>
      <ol className="divide-y">
        {top.map((r, i) => (
          <li key={r.club} className="flex items-center gap-4 py-3">
            <span className="w-6 font-display text-xl font-extrabold text-muted-foreground">
              {i + 1}
            </span>
            <span className="flex-1">
              <span className="block font-display text-lg font-bold">{r.club}</span>
              <span className="text-xs text-muted-foreground">
                {r.league} · {r.w}V-{r.d}O-{r.l}F på {r.matches} matcher
              </span>
            </span>
            <span className="text-right">
              <span className="block font-display text-lg font-extrabold text-primary">
                {r.gf}–{r.ga}
              </span>
              <span className="text-xs text-muted-foreground">gjorda–insläppta</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-muted-foreground">
        Baseras på poäng per match och målskillnad i respektive liga, uppdateras löpande från
        Transfermarkt.
      </p>
    </>
  );
}

function Index() {
  const [tab, setTab] = useState<TabKey>("world");
  return (
    <main className="mx-auto max-w-7xl px-4 pb-16">
      <section className="py-12 md:py-16">
        <p className="font-display text-sm font-bold tracking-widest text-primary">
          Riktig data. Riktiga siffror. Alltid uppdaterat.
        </p>
        <h1 className="mt-2 max-w-3xl font-display text-5xl font-extrabold leading-none md:text-7xl">
          Varje spelare. Varje match. <span className="text-primary">Varje detalj.</span>
        </h1>
        <div className="mt-8 max-w-3xl">
          <SearchBox big />
        </div>
      </section>

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full border px-4 py-2 font-display text-sm font-bold transition-colors ${
              tab === t.key
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card hover:border-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Section
        title={TABS.find((t) => t.key === tab)!.label}
        right={<span className="text-xs text-muted-foreground">Källa: Transfermarkt</span>}
      >
        <div className={tab === "world" ? "block" : "hidden"}>
          <PlayerList scope="world" />
        </div>
        <div className={tab === "sweden" ? "block" : "hidden"}>
          <PlayerList scope="sweden" />
        </div>
        <div className={tab === "clubs" ? "block" : "hidden"}>
          <ClubList />
        </div>
        <div className={tab === "form" ? "block" : "hidden"}>
          <FormList />
        </div>
      </Section>

      <p className="mt-10 text-center text-xs text-muted-foreground">
        All data hämtas live från Transfermarkt och Wikipedia. Letar du efter en ligatabell? Sök på
        liganamnet, t.ex. "Allsvenskan".
      </p>
    </main>
  );
}
