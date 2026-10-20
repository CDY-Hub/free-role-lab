import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Section } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { matchesByDate, type MatchItem } from "@/lib/matches.functions";

export const Route = createFileRoute("/matcher")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Matcher och liveresultat – Free Role Lab" },
      { name: "description", content: "Dagens fotbollsmatcher, liveresultat och kommande matcher – uppdateras automatiskt." },
      { property: "og:title", content: "Matcher och liveresultat – Free Role Lab" },
      { property: "og:description", content: "Dagens fotbollsmatcher, liveresultat och kommande matcher – uppdateras automatiskt." },
    ],
  }),
  component: MatchesPage,
});

const iso = (d: Date) => d.toISOString().slice(0, 10);
const shift = (date: string, days: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
};

const time = (m: MatchItem) => {
  if (!m.kickoff) return "";
  if (m.kickoff.includes("T")) {
    const d = new Date(m.kickoff);
    return d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
  }
  return m.kickoff;
};

function StatusBadge({ m }: { m: MatchItem }) {
  if (m.status === "live")
    return (
      <span className="flex items-center gap-1.5 text-xs font-bold text-destructive">
        <span className="size-2 animate-pulse rounded-full bg-destructive" />
        {m.statusText === "LIVE" ? "LIVE" : m.statusText}
      </span>
    );
  if (m.status === "finished") return <span className="text-xs font-bold text-muted-foreground">Slut</span>;
  return <span className="text-xs text-muted-foreground">{time(m)}</span>;
}

function MatchesPage() {
  const [date, setDate] = useState(() => iso(new Date()));
  const q = useQuery({
    queryKey: ["matches", date],
    queryFn: () => matchesByDate({ data: date }),
    refetchInterval: 60_000,
    retry: 1,
  });

  const groups = new Map<string, MatchItem[]>();
  for (const m of q.data?.matches ?? []) {
    const list = groups.get(m.league) ?? [];
    list.push(m);
    groups.set(m.league, list);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16">
      <section className="py-10">
        <p className="font-display text-sm font-bold tracking-widest text-primary">Uppdateras automatiskt varje minut</p>
        <h1 className="mt-2 font-display text-5xl font-extrabold leading-none">Matcher och liveresultat</h1>
        <div className="mt-6 flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setDate(shift(date, -1))} aria-label="Föregående dag">
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-40 text-center font-display text-lg font-bold">
            {date === iso(new Date()) ? "Idag" : new Date(`${date}T12:00:00Z`).toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" })}
          </span>
          <Button variant="outline" size="icon" onClick={() => setDate(shift(date, 1))} aria-label="Nästa dag">
            <ChevronRight className="size-4" />
          </Button>
          {date !== iso(new Date()) && (
            <Button variant="ghost" onClick={() => setDate(iso(new Date()))}>
              Till idag
            </Button>
          )}
        </div>
      </section>

      {q.isLoading && <p className="text-sm text-muted-foreground">Hämtar matcherna…</p>}
      {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}

      {q.data && groups.size === 0 && (
        <p className="text-sm text-muted-foreground">Inga matcher hittades det här datumet.</p>
      )}

      <div className="space-y-6">
        {[...groups.entries()].map(([league, matches]) => (
          <Section key={league} title={league}>
            <ol className="divide-y">
              {matches.map((m) => (
                <li key={m.id} className="flex items-center gap-4 py-2.5">
                  <span className="w-16 shrink-0 text-center">
                    <StatusBadge m={m} />
                  </span>
                  <span className="flex-1 text-right font-semibold">{m.home}</span>
                  <span className="w-16 shrink-0 text-center font-display text-lg font-extrabold text-primary">
                    {m.homeScore != null && m.awayScore != null ? `${m.homeScore}–${m.awayScore}` : "–"}
                  </span>
                  <span className="flex-1 font-semibold">{m.away}</span>
                </li>
              ))}
            </ol>
          </Section>
        ))}
      </div>

      {q.data && (
        <p className="mt-10 text-center text-xs text-muted-foreground">
          Källa: {q.data.source === "livescore" ? "Livescore" : "football-data.org"}. Resultaten uppdateras löpande.
        </p>
      )}
    </main>
  );
}
