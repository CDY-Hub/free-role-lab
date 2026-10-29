import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Section } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { matchesByDate, type MatchItem } from "@/lib/matches.functions";
import { shiftDate } from "@/lib/matches-parse";

export const Route = createFileRoute("/matcher")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Matcher och liveresultat – Free Role Lab" },
      {
        name: "description",
        content:
          "Dagens fotbollsmatcher, liveresultat och kommande matcher – uppdateras automatiskt.",
      },
      { property: "og:title", content: "Matcher och liveresultat – Free Role Lab" },
      {
        property: "og:description",
        content:
          "Dagens fotbollsmatcher, liveresultat och kommande matcher – uppdateras automatiskt.",
      },
    ],
  }),
  component: MatchesPage,
});

// Dagen räknas i svensk tid, både här och på servern. toISOString() ger UTC-datum, vilket efter
// midnatt (svensk tid) pekade på gårdagen och därför visade fel matcher.
const iso = (d: Date) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
const shift = shiftDate;

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
  if (m.status === "finished")
    return <span className="text-xs font-bold text-muted-foreground">Slut</span>;
  if (m.statusText === "Uppskjuten" || m.statusText === "Inställd")
    return <span className="text-xs font-semibold text-muted-foreground">{m.statusText}</span>;
  return <span className="text-xs text-muted-foreground">{time(m)}</span>;
}

function LeagueTitle({ m }: { m: MatchItem }) {
  return (
    <span className="flex items-center gap-2">
      {m.countryFlag ? (
        <img
          src={m.countryFlag}
          alt={m.country ?? ""}
          title={m.country}
          className="h-4 w-6 rounded-sm object-cover"
          loading="lazy"
        />
      ) : (
        <span aria-hidden="true">🌍</span>
      )}
      <span>{m.league}</span>
      {m.country && <span className="text-xs font-normal text-muted-foreground">{m.country}</span>}
    </span>
  );
}

function MatchesPage() {
  const [date, setDate] = useState(() => iso(new Date()));
  const today = iso(new Date());
  const q = useQuery({
    queryKey: ["matches", date],
    queryFn: () => matchesByDate({ data: date }),
    // Uppdatera bara medan man tittar på idag. Andra dagar ändras sällan.
    refetchInterval: date === today ? 60_000 : false,
    staleTime: 30_000,
    retry: 1,
    placeholderData: (prev) => prev,
  });

  // Gruppera per tävling (liga-ID), inte per namn, så att olika länders "Serie A" hålls isär.
  const groups = new Map<string, MatchItem[]>();
  for (const m of q.data?.matches ?? []) {
    const list = groups.get(m.leagueKey) ?? [];
    list.push(m);
    groups.set(m.leagueKey, list);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16">
      <section className="py-10">
        <p className="font-display text-sm font-bold tracking-widest text-primary">
          Uppdateras automatiskt varje minut
        </p>
        <h1 className="mt-2 font-display text-5xl font-extrabold leading-none">
          Matcher och liveresultat
        </h1>
        <div className="mt-6 flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setDate(shift(date, -1))}
            aria-label="Föregående dag"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-40 text-center font-display text-lg font-bold">
            {date === today
              ? "Idag"
              : new Date(`${date}T12:00:00Z`).toLocaleDateString("sv-SE", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setDate(shift(date, 1))}
            aria-label="Nästa dag"
          >
            <ChevronRight className="size-4" />
          </Button>
          {date !== today && (
            <Button variant="ghost" onClick={() => setDate(today)}>
              Till idag
            </Button>
          )}
        </div>
      </section>

      {q.isLoading && <p className="text-sm text-muted-foreground">Hämtar matcherna…</p>}
      {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}

      {q.data?.stale && (
        <p className="mb-4 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
          Matchkällorna svarar inte just nu. Visar senast hämtade matcher
          {q.data.fetchedAt
            ? ` (${new Date(q.data.fetchedAt).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })})`
            : ""}
          .
        </p>
      )}

      {q.data && groups.size === 0 && q.data.source !== "none" && (
        <p className="text-sm text-muted-foreground">Inga matcher hittades det här datumet.</p>
      )}

      {q.data && q.data.source === "none" && groups.size === 0 && (
        <div className="rounded-xl border p-5 text-sm">
          {q.data.diagnostics.some((d) => d.ok) ? (
            <p className="text-muted-foreground">Inga matcher hittades det här datumet.</p>
          ) : (
            <>
              <p className="font-semibold">Det gick inte att hämta matcher just nu.</p>
              <p className="mt-1 text-muted-foreground">
                Alla matchkällor svarade fel. Försök igen om en stund.
              </p>
              {q.data.diagnostics.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                  {q.data.diagnostics.map((d) => (
                    <li key={d.source}>
                      {d.source}: {d.reason ?? "inget svar"}
                    </li>
                  ))}
                </ul>
              )}
              {q.data.missingConfig && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Ingen matchnyckel är inställd. Lägg till <code>API_FOOTBALL_KEY</code> i
                  miljövariablerna om du vill ha data från api-football.com.
                </p>
              )}
              <Button variant="outline" size="sm" className="mt-3" onClick={() => q.refetch()}>
                Försök igen
              </Button>
            </>
          )}
        </div>
      )}

      <div className="space-y-6">
        {[...groups.entries()].map(([key, matches]) => (
          <div key={key}>
            <Section title={<LeagueTitle m={matches[0]!} />}>
              <ol className="divide-y">
                {matches.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 py-3">
                    <span className="w-16 shrink-0 text-center">
                      <StatusBadge m={m} />
                    </span>
                    <div className="flex flex-1 items-center justify-end gap-2 text-right">
                      <span className="font-semibold">{m.home}</span>
                      {m.homeLogo && (
                        <img
                          src={m.homeLogo}
                          alt=""
                          className="size-5 object-contain"
                          loading="lazy"
                        />
                      )}
                    </div>
                    <span className="w-16 shrink-0 text-center font-display text-lg font-extrabold text-primary">
                      {m.homeScore != null && m.awayScore != null
                        ? `${m.homeScore}–${m.awayScore}`
                        : "–"}
                    </span>
                    <div className="flex flex-1 items-center justify-start gap-2 text-left">
                      {m.awayLogo && (
                        <img
                          src={m.awayLogo}
                          alt=""
                          className="size-5 object-contain"
                          loading="lazy"
                        />
                      )}
                      <span className="font-semibold">{m.away}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </Section>
          </div>
        ))}
      </div>

      {q.data && q.data.source !== "none" && (
        <p className="mt-10 text-center text-xs text-muted-foreground">
          Källa:{" "}
          {q.data.source === "api-football"
            ? "api-football.com"
            : q.data.source === "espn"
              ? "ESPN"
              : q.data.source === "livescore"
                ? "Egen livescore-server"
                : "football-data.org"}
          . Top 5-ligor, Allsvenskan, Portugal, Nederländerna, UEFA- och FIFA-turneringar.
        </p>
      )}
    </main>
  );
}
