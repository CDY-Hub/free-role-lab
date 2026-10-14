import { createFileRoute, Link } from "@tanstack/react-router";
import { Section, InfoRow, Badge2 } from "@/components/ui-bits";
import { tmCoachProfile } from "@/lib/tm.functions";

export const Route = createFileRoute("/proffs/tranare/$id")({
  loader: ({ params }) => tmCoachProfile({ data: params.id }),
  head: ({ loaderData }) => {
    const t = loaderData?.name ? `${loaderData.name} – tränarprofil | ScoutLab` : "Tränare | ScoutLab";
    const d = loaderData?.name ? `Profil och bakgrund för tränaren ${loaderData.name}.` : "Tränarprofil";
    const meta: any[] = [{ title: t }, { name: "description", content: d }, { property: "og:title", content: t }, { property: "og:description", content: d }];
    if (loaderData?.imageUrl?.startsWith("https://")) meta.push({ property: "og:image", content: loaderData.imageUrl }, { name: "twitter:image", content: loaderData.imageUrl });
    return { meta };
  },
  component: ProCoach,
});

function ProCoach() {
  const c = Route.useLoaderData();
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-end gap-6 rounded-xl border bg-card p-6">
        {c.imageUrl && <img src={c.imageUrl} alt={c.name} width={96} height={124} className="h-32 w-24 rounded-lg object-cover" />}
        <div>
          <div className="flex gap-2"><Badge2>Tränare</Badge2>{c.license && <Badge2>{c.license}</Badge2>}</div>
          <h1 className="mt-2 font-display text-5xl font-extrabold">{c.name}</h1>
          <p className="text-muted-foreground">{c.age} år · {c.citizenship?.join(", ")}</p>
        </div>
      </header>
      <div className="grid gap-6 md:grid-cols-2">
        <Section title="Profil">
          <InfoRow label="Fullständigt namn" value={c.nameInHomeCountry ?? c.name} />
          <InfoRow label="Född" value={c.dateOfBirth} />
          <InfoRow label="Födelseort" value={[c.placeOfBirth?.city, c.placeOfBirth?.country].filter(Boolean).join(", ")} />
          <InfoRow label="Licens" value={c.license} />
        </Section>
        <Section title="Karriär & meriter">
          <p className="text-sm text-muted-foreground">
            Transfermarkt delar bara grundprofilen för tränare. Fråga AI-chatten om {c.name}s klubbar, titlar och spelarkarriär.
          </p>
          <Link to="/chat" className="mt-3 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Fråga AI-chatten</Link>
        </Section>
      </div>
      <p className="text-xs text-muted-foreground">Källa: Transfermarkt.</p>
    </main>
  );
}
