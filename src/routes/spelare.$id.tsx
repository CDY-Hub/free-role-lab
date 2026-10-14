import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Section, Stat, InfoRow, RatingPill, AttrBar, Badge2 } from "@/components/ui-bits";
import { getPlayer, getClub, getLeague, positionNames, formatSEK, coachOf } from "@/lib/data";

export const Route = createFileRoute("/spelare/$id")({
  loader: ({ params }) => {
    const p = getPlayer(params.id);
    if (!p) throw notFound();
    return p;
  },
  head: ({ loaderData }) => {
    const t = loaderData ? `${loaderData.name} – spelarprofil | ScoutLab` : "Spelare | ScoutLab";
    const d = loaderData ? `Matcher, statistik, attribut och scoutrapport för ${loaderData.name}.` : "Spelarprofil";
    return { meta: [{ title: t }, { name: "description", content: d }, { property: "og:title", content: t }, { property: "og:description", content: d }] };
  },
  component: PlayerPage,
});

function PlayerPage() {
  const p = Route.useLoaderData();
  const club = getClub(p.clubId)!;
  const league = getLeague(club.leagueId)!;
  const coach = coachOf(club.id);
  const tot = p.matches.reduce(
    (a, m) => ({ g: a.g + m.goals, a: a.a + m.assists, min: a.min + m.minutes, r: a.r + m.rating }),
    { g: 0, a: 0, min: 0, r: 0 },
  );
  const sr = p.scoutReports[0]!;

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-end gap-6 rounded-xl border bg-card p-6">
        <div className="flex size-24 items-center justify-center rounded-xl bg-ink font-display text-5xl font-extrabold text-ink-foreground">{p.shirt}</div>
        <div className="flex-1">
          <div className="flex flex-wrap gap-2">
            <Badge2>{positionNames[p.position]}</Badge2>
            <Badge2>{league.name}</Badge2>
          </div>
          <h1 className="mt-2 font-display text-5xl font-extrabold">{p.name}</h1>
          <p className="text-muted-foreground">{club.name} · {p.age} år · {p.nationality}</p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase text-muted-foreground">Marknadsvärde</div>
          <div className="font-display text-4xl font-extrabold text-primary">{formatSEK(p.marketValue)}</div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Matcher (14 senaste)" value={p.matches.length} />
        <Stat label="Mål" value={tot.g} />
        <Stat label="Assist" value={tot.a} />
        <Stat label="Minuter" value={tot.min} />
        <Stat label="Snittbetyg" value={(tot.r / p.matches.length).toFixed(2)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Senaste matcherna">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr><th className="py-2">Datum</th><th>Match</th><th>Res.</th><th>Min</th><th>M</th><th>A</th><th>Skott</th><th>Pass%</th><th>Kort</th><th>Betyg</th></tr>
                </thead>
                <tbody className="divide-y">
                  {p.matches.map((m) => (
                    <tr key={m.id}>
                      <td className="py-2 text-muted-foreground">{m.date.slice(5)}</td>
                      <td className="max-w-56 truncate"><span className="text-xs text-muted-foreground">{m.competition}</span><br />{m.isHome ? `vs ${m.away}` : `@ ${m.home}`}</td>
                      <td className="font-bold">{m.scoreHome}-{m.scoreAway}</td>
                      <td>{m.minutes}'</td><td>{m.goals || ""}</td><td>{m.assists || ""}</td><td>{m.shots}</td><td>{m.passAcc}</td>
                      <td>{m.red ? "🟥" : m.yellow ? "🟨" : ""}</td>
                      <td><RatingPill v={m.rating} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Säsongsstatistik">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr><th className="py-2">Säsong</th><th>Klubb</th><th>Matcher</th><th>Mål</th><th>Assist</th><th>Min</th><th>Gula</th><th>Röda</th><th>Snitt</th></tr>
              </thead>
              <tbody className="divide-y">
                {p.seasons.map((s) => (
                  <tr key={s.season}>
                    <td className="py-2 font-bold">{s.season}</td><td>{getClub(s.clubId)?.short}</td><td>{s.apps}</td>
                    <td>{s.cleanSheets !== undefined ? `${s.cleanSheets} nollor` : s.goals}</td><td>{s.assists}</td><td>{s.minutes}</td><td>{s.yellow}</td><td>{s.red}</td>
                    <td><RatingPill v={s.avgRating} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="Attribut">
            <div className="grid gap-6 md:grid-cols-2">
              {p.attributes.map((g) => (
                <div key={g.group} className="space-y-2">
                  <h3 className="font-display font-bold text-primary">{g.group}</h3>
                  {g.items.map((a) => <AttrBar key={a.name} {...a} />)}
                </div>
              ))}
            </div>
          </Section>

          <Section title="Scoutrapport">
            <div className="flex flex-wrap gap-6 text-sm">
              <div><div className="text-xs text-muted-foreground">Nuvarande nivå</div><div className="text-xl text-primary">{"★".repeat(Math.round(sr.rating))}<span className="text-muted">{"★".repeat(5 - Math.round(sr.rating))}</span></div></div>
              <div><div className="text-xs text-muted-foreground">Potential</div><div className="text-xl text-primary">{"★".repeat(Math.round(sr.potential))}<span className="text-muted">{"★".repeat(5 - Math.round(sr.potential))}</span></div></div>
            </div>
            <p className="mt-3">{sr.text}</p>
            <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
              <div><span className="font-semibold">Styrkor:</span> {p.strengths.join(", ")}</div>
              <div><span className="font-semibold">Svagheter:</span> {p.weaknesses.join(", ")}</div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{sr.scout}, {sr.agency} · {sr.date}</p>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Personuppgifter">
            <InfoRow label="Fullständigt namn" value={p.name} />
            <InfoRow label="Född" value={`${p.birthDate} (${p.age})`} />
            <InfoRow label="Födelseort" value={p.birthPlace} />
            <InfoRow label="Nationalitet" value={p.nationality} />
            <InfoRow label="Längd / vikt" value={`${p.height} cm / ${p.weight} kg`} />
            <InfoRow label="Fot" value={p.foot} />
            <InfoRow label="Position" value={positionNames[p.position]} />
            <InfoRow label="Sekundär" value={p.secondary.map((s) => positionNames[s]).join(", ") || "–"} />
            <InfoRow label="Tröjnummer" value={p.shirt} />
            <InfoRow label="Bil" value={p.car ?? "Okänt"} />
          </Section>
          <Section title="Klubb & kontrakt">
            <InfoRow label="Klubb" value={club.name} />
            <InfoRow label="Serie" value={league.name} />
            <InfoRow label="Hemmaarena" value={club.stadium} />
            <InfoRow label="Tränare" value={coach ? <Link to="/tranare/$id" params={{ id: coach.id }} className="text-primary underline">{coach.name}</Link> : "–"} />
            <InfoRow label="Kontrakt till" value={p.contractUntil} />
            <InfoRow label="Agent" value={p.agent} />
          </Section>
          <Section title="Övergångar">
            <ul className="space-y-3 text-sm">
              {p.transfers.map((t, i) => (
                <li key={i} className="border-l-2 border-primary pl-3">
                  <div className="text-xs text-muted-foreground">{t.date} · {t.type}</div>
                  <div>{t.fromClub} → <span className="font-semibold">{t.toClub}</span></div>
                  <div className="text-xs font-bold text-primary">{t.fee}</div>
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Skador">
            {p.injuries.length === 0 ? <p className="text-sm text-muted-foreground">Inga registrerade skador.</p> : p.injuries.map((i, k) => <InfoRow key={k} label={i.type} value={`${i.from} – ${i.to}`} />)}
          </Section>
        </div>
      </div>
    </main>
  );
}
