import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { wikiPage } from "@/lib/tm.functions";
import { Section } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { UEFA_COMPS } from "./uefa.index";
import {
  getDecades,
  isCurrentSeason,
  SEASON_COMPETITIONS,
  type SeasonItem,
} from "@/lib/uefa-seasons";

export const Route = createFileRoute("/uefa/$slug")({
  validateSearch: (s: Record<string, unknown>): { season?: string | undefined } => ({
    season: typeof s["season"] === "string" ? s["season"] : undefined,
  }),
  loader: ({ params }: { params: any }) => {
    const comp = UEFA_COMPS.find((c) => c.slug === params.slug);
    if (!comp) throw notFound();
    return comp;
  },
  head: ({ loaderData }: { loaderData?: any }) => {
    const t = loaderData ? `${loaderData.name} – UEFA – Free Role Lab` : "UEFA – Free Role Lab";
    const d = loaderData ? `${loaderData.name}: ${loaderData.desc}.` : "UEFA-tävling";
    return {
      meta: [
        { title: t },
        { name: "description", content: d },
        { property: "og:title", content: t },
        { property: "og:description", content: d },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: UefaCompPage,
});

// key på slug: byter man tävling ska väljarna börja om, inte ärva föregående tävlings state.
function UefaCompPage() {
  const comp = Route.useLoaderData();
  return <UefaComp key={comp.slug} comp={comp} />;
}

function UefaComp({ comp }: { comp: any }) {
  const search = Route.useSearch();
  const isDecadeCup = SEASON_COMPETITIONS.includes(comp.slug);
  const decades = isDecadeCup ? getDecades(comp.slug) : [];

  const [activeDecadeId, setActiveDecadeId] = useState<string>(() => decades[0]?.id ?? "");
  const [showOverview, setShowOverview] = useState<boolean>(false);

  const activeDecade = decades.find((d) => d.id === activeDecadeId) ?? decades[0];

  // Default season to search.season or first season in active decade
  const [selectedSeasonLabel, setSelectedSeasonLabel] = useState<string>(() => {
    if (search.season) return search.season;
    return activeDecade?.seasons[0]?.label ?? "";
  });

  // Find wiki page to query
  let queryWiki = comp.wiki;
  let activeSeasonObj: SeasonItem | undefined;

  if (isDecadeCup && !showOverview) {
    activeSeasonObj =
      activeDecade?.seasons.find((s) => s.label === selectedSeasonLabel) ??
      activeDecade?.seasons[0];
    if (activeSeasonObj) {
      queryWiki = activeSeasonObj.wikiPage;
    }
  }

  const q = useQuery({
    queryKey: ["wiki", queryWiki],
    queryFn: () => wikiPage({ data: queryWiki }),
    // Pågående säsong uppdateras ofta på Wikipedia; historiken ändras sällan.
    staleTime: activeSeasonObj && isCurrentSeason(activeSeasonObj.label) ? 900_000 : 86_400_000,
    retry: 1,
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <p className="text-sm text-muted-foreground">
        <Link to="/uefa" className="text-primary underline">
          UEFA
        </Link>{" "}
        / {comp.name}
      </p>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-extrabold">{comp.name}</h1>
          <p className="text-sm text-muted-foreground">
            {isDecadeCup && !showOverview && activeSeasonObj
              ? `All information, matcher, tabeller och final för säsongen ${activeSeasonObj.label}.`
              : comp.desc}
          </p>
        </div>

        {isDecadeCup && (
          <Button variant="outline" size="sm" onClick={() => setShowOverview((v: boolean) => !v)}>
            {showOverview ? "← Tillbaka till säsongsväljaren" : "Visa alla finaler genom tiderna"}
          </Button>
        )}
      </div>

      {isDecadeCup && !showOverview && (
        <div className="mt-6 space-y-6">
          <Section title="Välj decennium">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {decades.map((d) => {
                const isActive = d.id === activeDecade?.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => {
                      setActiveDecadeId(d.id);
                      if (d.seasons[0]) {
                        setSelectedSeasonLabel(d.seasons[0].label);
                      }
                    }}
                    className={`rounded-lg border p-4 text-left transition-colors ${
                      isActive
                        ? "border-primary bg-primary/10 text-primary"
                        : "bg-card hover:border-primary"
                    }`}
                  >
                    <span className="block font-display text-xl font-extrabold">{d.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {d.seasons.length} säsonger
                    </span>
                  </button>
                );
              })}
            </div>
          </Section>

          {activeDecade && (
            <Section title={`Välj säsong (${activeDecade.label})`}>
              <div className="flex flex-wrap gap-2">
                {activeDecade.seasons.map((s) => {
                  const isSelected = s.label === (activeSeasonObj?.label ?? selectedSeasonLabel);
                  return (
                    <button
                      key={s.label}
                      onClick={() => setSelectedSeasonLabel(s.label)}
                      className={`rounded-md border px-3 py-1.5 font-display text-sm font-bold transition-colors ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-card hover:border-primary"
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </Section>
          )}
        </div>
      )}

      {q.isLoading && <p className="mt-8 text-sm text-muted-foreground">Hämtar data…</p>}
      {q.error && <p className="mt-8 text-sm text-destructive">{(q.error as Error).message}</p>}

      {q.data && (
        <div className="mt-8">
          <h2 className="font-display text-3xl font-extrabold">{q.data.title}</h2>
          <article className="wiki-body mt-4" dangerouslySetInnerHTML={{ __html: q.data.html }} />
          <p className="mt-8 text-xs text-muted-foreground">
            Innehåll från{" "}
            <a
              href={`https://en.wikipedia.org/wiki/${encodeURIComponent(queryWiki.replace(/ /g, "_"))}`}
              target="_blank"
              rel="noopener"
              className="text-primary underline"
            >
              Wikipedia
            </a>{" "}
            (CC BY-SA).
          </p>
        </div>
      )}
    </main>
  );
}
