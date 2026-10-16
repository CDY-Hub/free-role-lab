import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Section, Stat, InfoRow, Badge2 } from "@/components/ui-bits";
import { tmPlayerProfile, tmPlayerMatches, tmPlayerMatchesSeason, tmPlayerStats, tmPlayerTransfers } from "@/lib/tm.functions";

export const Route = createFileRoute("/proffs/spelare/$id")({
  loader: ({ params }) => tmPlayerProfile({ data: params.id }),
  head: ({ loaderData }) => {
    const t = loaderData?.name ? `${loaderData.name} – spelarprofil | ScoutLab` : "Spelare | ScoutLab";
    const d = loaderData?.name ? `Matcher, statistik, övergångar och marknadsvärde för ${loaderData.name}.` : "Spelarprofil";
    const meta: any[] = [{ title: t }, { name: "description", content: d }, { property: "og:title", content: t }, { property: "og:description", content: d }];
    if (loaderData?.imageUrl?.startsWith("https://")) meta.push({ property: "og:image", content: loaderData.imageUrl }, { name: "twitter:image", content: loaderData.imageUrl });
    return { meta };
  },
  component: ProPlayer,
});

const eur = (v?: number | null) => (v ? (v >= 1e6 ? `€${(v / 1e6).toFixed(1)}m` : `€${Math.round(v / 1000)}k`) : "–");

function ProPlayer() {
  const p = Route.useLoaderData();
  const { id } = Route.useParams();
  const [season, setSeason] = useState<string | null>(null);
  const matches = useQuery({ queryKey: ["tm-m", id], queryFn: () => tmPlayerMatches({ data: id }), staleTime: 600_000 });
  const stats = useQuery({ queryKey: ["tm-s", id], queryFn: () => tmPlayerStats({ data: id }), enabled: !matches.isLoading, staleTime: 600_000 });
  const seasonMatches = useQuery({
    queryKey: ["tm-ms", id, season],
    queryFn: () => tmPlayerMatchesSeason({ data: { playerId: id, seasonId: season! } }),
    enabled: season !== null,
    staleTime: 3600_000,
  });
  const transfers = useQuery({ queryKey: ["tm-t", id], queryFn: () => tmPlayerTransfers({ data: id }), enabled: !stats.isLoading && !matches.isLoading, staleTime: 600_000 });

  const activeMatches = season === null ? matches : seasonMatches;
  const played = (activeMatches.data ?? []).filter((m: any) => m.participation === "played");
  const sum = (k: string) => played.reduce((s: number, m: any) => s + (m[k] ?? 0), 0);

  const bySeason: Record<string, any> = {};
  for (const s of stats.data ?? []) {
    const k = s.seasonId;
    bySeason[k] ??= { season: k, apps: 0, goals: 0, assists: 0, min: 0, y: 0, r: 0 };
    bySeason[k].apps += s.appearances ?? 0;
    bySeason[k].goals += s.goals ?? 0;
    bySeason[k].assists += s.assists ?? 0;
    bySeason[k].min += s.minutesPlayed ?? 0;
    bySeason[k].y += s.yellowCards ?? 0;
    bySeason[k].r += s.redCards ?? 0;
  }
  const seasons = Object.values(bySeason).sort((a: any, b: any) => b.season.localeCompare(a.season));

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-end gap-6 rounded-xl border bg-card p-6">
        {p.imageUrl && <img src={p.imageUrl} alt={p.name} width={96} height={124} className="h-32 w-24 rounded-lg object-cover" />}
        <div className="flex-1">
          <div className="flex flex-wrap gap-2"><Badge2>{p.position?.main}</Badge2>{p.nationalTeam?.name && <Badge2>Landslag: {p.nationalTeam.name}</Badge2>}</div>
          <h1 className="mt-2 font-display text-5xl font-extrabold">{p.name}</h1>
          <p className="text-muted-foreground">{p.club?.name} · {p.age} år · {p.citizenship?.join(", ")}</p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase text-muted-foreground">Marknadsvärde</div>
          <div className="font-display text-4xl font-extrabold text-primary">{eur(p.marketValue)}</div>
          {p.marketValueDetails?.highest && <div className="text-xs text-muted-foreground">Högsta: {eur(p.marketValueDetails.highest.value)} ({p.marketValueDetails.highest.date})</div>}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Matcher (senaste)" value={matches.isLoading ? "…" : played.length} />
        <Stat label="Mål" value={matches.isLoading ? "…" : sum("goals")} />
        <Stat label="Assist" value={matches.isLoading ? "…" : sum("assists")} />
        <Stat label="Minuter" value={matches.isLoading ? "…" : sum("minutesPlayed")} />
        <Stat label="Skott på mål" value={matches.isLoading ? "…" : sum("shotsOnTarget")} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Senaste matcherna">
            {matches.isLoading && <p className="text-sm text-muted-foreground">Hämtar matcher…</p>}
            {matches.error && <p className="text-sm text-destructive">{(matches.error as Error).message}</p>}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-2">Datum</th><th>Match</th><th>Res.</th><th>Min</th><th>M</th><th>A</th><th>Skott</th><th>Pass</th><th>Tackl.</th><th>Kort</th></tr></thead>
                <tbody className="divide-y">
                  {(matches.data ?? []).slice(0, 20).map((m: any) => (
                    <tr key={m.gameId} className={m.participation !== "played" ? "text-muted-foreground" : ""}>
                      <td className="py-2">{m.date?.slice(0, 10)}</td>
                      <td className="max-w-56 truncate"><span className="text-xs text-muted-foreground">{m.competition?.name}</span><br />{m.venue === "home" ? "vs" : "@"} {m.opponent?.name}</td>
                      <td className="font-bold">{m.clubGoals}-{m.opponentGoals}</td>
                      <td>{m.participation === "played" ? `${m.minutesPlayed}'` : "Ej spelat"}</td>
                      <td>{m.goals || ""}</td><td>{m.assists || ""}</td><td>{m.shots ?? ""}</td>
                      <td>{m.passes ? `${m.accuratePasses}/${m.passes}` : ""}</td><td>{m.tackles ?? ""}</td>
                      <td>{m.redCard ? "🟥" : m.yellowCard ? "🟨" : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
          <Section title="Säsongsstatistik (alla tävlingar)">
            {stats.isLoading || stats.isPending ? <p className="text-sm text-muted-foreground">Hämtar…</p> : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-2">Säsong</th><th>Matcher</th><th>Mål</th><th>Assist</th><th>Min</th><th>Gula</th><th>Röda</th></tr></thead>
                <tbody className="divide-y">
                  {seasons.slice(0, 12).map((s: any) => (<tr key={s.season}><td className="py-2 font-bold">{s.season}</td><td>{s.apps}</td><td>{s.goals}</td><td>{s.assists}</td><td>{s.min}</td><td>{s.y}</td><td>{s.r}</td></tr>))}
                </tbody>
              </table>
            )}
          </Section>
        </div>
        <div className="space-y-6">
          <Section title="Personuppgifter">
            <InfoRow label="Fullständigt namn" value={p.nameInHomeCountry ?? p.name} />
            <InfoRow label="Född" value={`${p.dateOfBirth} (${p.age})`} />
            <InfoRow label="Födelseort" value={[p.placeOfBirth?.city, p.placeOfBirth?.country].filter(Boolean).join(", ")} />
            <InfoRow label="Längd" value={p.height ? `${p.height} cm` : "–"} />
            <InfoRow label="Fot" value={p.foot === "right" ? "Höger" : p.foot === "left" ? "Vänster" : p.foot} />
            <InfoRow label="Position" value={p.position?.main} />
            <InfoRow label="Övriga" value={p.position?.other?.join(", ") || "–"} />
            <InfoRow label="Tröjnummer" value={p.shirtNumber} />
          </Section>
          <Section title="Klubb & kontrakt">
            <InfoRow label="Klubb" value={p.club?.name} />
            <InfoRow label="Ansluten" value={p.club?.joined} />
            <InfoRow label="Kontrakt till" value={p.club?.contractExpires} />
            <InfoRow label="Agent" value={p.agent?.name} />
            <InfoRow label="Utrustning" value={p.outfitter} />
          </Section>
          <Section title="Övergångar">
            {!transfers.data ? <p className="text-sm text-muted-foreground">Hämtar…</p> : (
              <ul className="space-y-3 text-sm">
                {transfers.data.map((t: any) => (
                  <li key={t.id} className="border-l-2 border-primary pl-3">
                    <div className="text-xs text-muted-foreground">{t.date} · {t.season}</div>
                    <div>{t.clubFrom?.name} → <span className="font-semibold">{t.clubTo?.name}</span></div>
                    <div className="text-xs font-bold text-primary">{t.fee ? eur(t.fee) : t.transferType}</div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Källa: Transfermarkt.</p>
    </main>
  );
}
