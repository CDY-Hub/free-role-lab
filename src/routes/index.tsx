import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SearchBox } from "@/components/site-header";
import { Section } from "@/components/ui-bits";
import {
  tmPlayersBatch,
  tmClubsBatch,
  tmCompetitionTable,
  tmMostValuableClubs,
} from "@/lib/tm.functions";

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

const WORLD_PLAYERS = [
  "342229",
  "418560",
  "937958",
  "581678",
  "371998",
  "433177",
  "598577",
  "580195",
  "683840",
  "369081",
];
const SWEDEN_PLAYERS = [
  "325443",
  "349066",
  "431755",
  "866246",
  "931838",
  "667287",
  "583189",
  "503075",
];
const TOP_CLUBS = [
  "418",
  "281",
  "11",
  "31",
  "131",
  "583",
  "27",
  "631",
  "46",
  "985",
  "148",
  "506",
  "13",
  "16",
];

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

function PlayerList({ ids }: { ids: string[] }) {
  const q = useQuery({
    queryKey: ["tm-batch", ids],
    queryFn: () => tmPlayersBatch({ data: ids }),
    staleTime: 3600_000,
  });
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Hämtar marknadsvärden…</p>;
  if (q.error) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;
  const top = [...(q.data ?? [])]
    .sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0))
    .slice(0, 5);
  return (
    <ol className="divide-y">
      {top.map((p: any, i: number) => (
        <li key={p.id}>
          <Link
            to="/proffs/spelare/$id"
            params={{ id: p.id }}
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
                {[
                  typeof p.position === "string" ? p.position : p.position?.main,
                  p.club?.name,
                  p.age ? `${p.age} år` : null,
                ]
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

function ClubRow({
  rank,
  name,
  image,
  meta,
  value,
}: {
  rank: number;
  name: string;
  image?: string | undefined;
  meta: string;
  value?: number | undefined;
}) {
  return (
    <li className="flex items-center gap-4 py-3">
      <span className="w-6 font-display text-xl font-extrabold text-muted-foreground">{rank}</span>
      {image && <img src={image} alt="" className="size-10 object-contain" loading="lazy" />}
      <span className="flex-1">
        <span className="block font-display text-lg font-bold">{name}</span>
        <span className="text-xs text-muted-foreground">{meta}</span>
      </span>
      <span className="font-display text-xl font-extrabold text-primary">{eur(value)}</span>
    </li>
  );
}

// Följer Transfermarkts egen rankinglista (Most valuable teams), så att siffrorna stämmer med källan.
// Bara om den inte går att läsa visas den äldre reservlistan, tydligt märkt.
function ClubList() {
  const ranking = useQuery({
    queryKey: ["tm-valuable-clubs"],
    queryFn: () => tmMostValuableClubs(),
    staleTime: 6 * 3600_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const fallback = useQuery({
    queryKey: ["tm-clubs", TOP_CLUBS],
    queryFn: () => tmClubsBatch({ data: TOP_CLUBS }),
    staleTime: 3600_000,
    enabled: ranking.isError,
    refetchOnWindowFocus: false,
  });

  if (ranking.isLoading) {
    return <p className="text-sm text-muted-foreground">Hämtar Transfermarkts rankinglista…</p>;
  }

  if (ranking.data) {
    return (
      <ol className="divide-y">
        {ranking.data.map((c) => (
          <ClubRow
            key={c.id}
            rank={c.rank}
            name={c.name}
            image={c.imageUrl}
            meta={[c.league?.name, c.squadSize ? `trupp på ${c.squadSize} spelare` : null]
              .filter(Boolean)
              .join(" · ")}
            value={c.marketValue}
          />
        ))}
      </ol>
    );
  }

  if (fallback.isLoading) {
    return <p className="text-sm text-muted-foreground">Hämtar truppvärden…</p>;
  }
  const top = [...(fallback.data ?? [])]
    .filter((c: any) => c.name && c.currentMarketValue)
    .sort((a: any, b: any) => (b.currentMarketValue ?? 0) - (a.currentMarketValue ?? 0))
    .slice(0, 5);
  return (
    <>
      <p className="mb-2 text-xs text-destructive">
        Transfermarkts rankinglista gick inte att läsa just nu. Visar ett urval av storklubbar i
        stället, så ordningen kan avvika från Transfermarkt.{" "}
        <button className="underline" onClick={() => ranking.refetch()}>
          Försök igen
        </button>
      </p>
      <ol className="divide-y">
        {top.map((c: any, i: number) => (
          <ClubRow
            key={c.id}
            rank={i + 1}
            name={c.name}
            image={c.image}
            meta={c.league?.name ?? ""}
            value={c.currentMarketValue}
          />
        ))}
      </ol>
    </>
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
          <PlayerList ids={WORLD_PLAYERS} />
        </div>
        <div className={tab === "sweden" ? "block" : "hidden"}>
          <PlayerList ids={SWEDEN_PLAYERS} />
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
