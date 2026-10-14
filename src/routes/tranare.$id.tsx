import { createFileRoute, notFound } from "@tanstack/react-router";
import { Section, Stat, InfoRow, Badge2 } from "@/components/ui-bits";
import { getCoach, getClub, getLeague } from "@/lib/data";

export const Route = createFileRoute("/tranare/$id")({
  loader: ({ params }) => {
    const c = getCoach(params.id);
    if (!c) throw notFound();
    return c;
  },
  head: ({ loaderData }) => {
    const t = loaderData ? `${loaderData.name} – tränarprofil | ScoutLab` : "Tränare | ScoutLab";
    const d = loaderData ? `Klubbar, meriter och spelarkarriär för ${loaderData.name}.` : "Tränarprofil";
    return { meta: [{ title: t }, { name: "description", content: d }, { property: "og:title", content: t }, { property: "og:description", content: d }] };
  },
  component: CoachPage,
});

function CoachPage() {
  const c = Route.useLoaderData();
  const club = getClub(c.clubId)!;
  const total = c.career.reduce((s, x) => s + x.matches, 0);
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="rounded-xl border bg-card p-6">
        <div className="flex gap-2"><Badge2>Huvudtränare</Badge2><Badge2>{c.license}</Badge2></div>
        <h1 className="mt-2 font-display text-5xl font-extrabold">{c.name}</h1>
        <p className="text-muted-foreground">{club.name} · {getLeague(club.leagueId)?.name} · {c.age} år · {c.nationality}</p>
        <p className="mt-4 max-w-3xl">{c.bio}</p>
      </header>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Matcher som tränare" value={total} />
        <Stat label="Vinst% nuvarande klubb" value={`${c.career[0].winPct}%`} />
        <Stat label="Formation" value={c.formation} />
        <Stat label="Titlar" value={c.trophies.length} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Tränarkarriär">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-2">Period</th><th>Klubb</th><th>Roll</th><th>Matcher</th><th>Vinst%</th></tr></thead>
              <tbody className="divide-y">
                {c.career.map((x, i) => (
                  <tr key={i}><td className="py-2">{x.from}–{x.to}</td><td className="font-semibold">{x.club}</td><td>{x.role}</td><td>{x.matches}</td><td className="font-bold text-primary">{x.winPct}%</td></tr>
                ))}
              </tbody>
            </table>
          </Section>
          <Section title="Karriär som spelare">
            {c.playerCareer ? (
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-2">Period</th><th>Klubb</th><th>Matcher</th><th>Mål</th></tr></thead>
                <tbody className="divide-y">
                  {c.playerCareer.map((x, i) => (<tr key={i}><td className="py-2">{x.from}–{x.to}</td><td className="font-semibold">{x.club}</td><td>{x.apps}</td><td>{x.goals}</td></tr>))}
                </tbody>
              </table>
            ) : <p className="text-sm text-muted-foreground">Spelade aldrig på elitnivå.</p>}
          </Section>
        </div>
        <div className="space-y-6">
          <Section title="Profil">
            <InfoRow label="Spelstil" value={c.style} />
            <InfoRow label="Favoritformation" value={c.formation} />
            <InfoRow label="Licens" value={c.license} />
            <InfoRow label="I klubben sedan" value={c.since} />
          </Section>
          <Section title="Meriter">
            <ul className="list-inside list-disc space-y-1 text-sm">{c.trophies.map((t) => <li key={t}>{t}</li>)}</ul>
          </Section>
        </div>
      </div>
    </main>
  );
}
