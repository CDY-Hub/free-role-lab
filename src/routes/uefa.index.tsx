import { createFileRoute, Link } from "@tanstack/react-router";
import { Section } from "@/components/ui-bits";

export const Route = createFileRoute("/uefa/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "UEFA – alla cuper och vinnare – Free Role Lab" },
      {
        name: "description",
        content:
          "Champions League, Europa League, Conference League, Cupvinnarcupen och Supercupen – alla vinnare genom tiderna.",
      },
      { property: "og:title", content: "UEFA – alla cuper och vinnare – Free Role Lab" },
      { property: "og:description", content: "Alla UEFA-cuper och deras vinnare genom tiderna." },
    ],
  }),
  component: UefaPage,
});

export const UEFA_COMPS = [
  {
    slug: "vinnare",
    name: "Alla vinnare – översikt",
    desc: "Samtliga klubbar som vunnit UEFA-tävlingar",
    wiki: "List of UEFA club competition winners",
  },
  {
    slug: "champions-league",
    name: "Champions League",
    desc: "Europacupen/Champions League – alla säsonger sedan 1955–56, inklusive 2026–27",
    wiki: "List of European Cup and UEFA Champions League finals",
  },
  {
    slug: "europa-league",
    name: "Europa League",
    desc: "UEFA-cupen/Europa League – alla säsonger sedan 1971–72, inklusive 2026–27",
    wiki: "List of UEFA Cup and Europa League finals",
  },
  {
    slug: "conference-league",
    name: "Conference League",
    desc: "Alla säsonger 2021–22 till 2026–27",
    wiki: "List of UEFA Conference League finals",
  },
  {
    slug: "cupvinnarcupen",
    name: "Cupvinnarcupen",
    desc: "Alla finaler 1960–1999",
    wiki: "List of UEFA Cup Winners' Cup finals",
  },
  {
    slug: "supercupen",
    name: "Supercupen",
    desc: "Alla matcher sedan 1972",
    wiki: "List of UEFA Super Cup matches",
  },
  {
    slug: "intertoto",
    name: "Intertotocupen",
    desc: "Alla vinnare 1961–2008",
    wiki: "UEFA Intertoto Cup",
  },
];

function UefaPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <p className="font-display text-sm font-bold tracking-widest text-primary">UEFA</p>
      <h1 className="font-display text-4xl font-extrabold">UEFA:s cuper</h1>
      <p className="text-sm text-muted-foreground">
        Alla UEFA-tävlingar och deras vinnare genom tiderna.
      </p>
      <Section title="Välj tävling">
        <div className="grid gap-2 sm:grid-cols-2">
          {UEFA_COMPS.map((c) => (
            <Link
              key={c.slug}
              to="/uefa/$slug"
              params={{ slug: c.slug }}
              className="rounded-lg border bg-card p-4 transition-colors hover:border-primary"
            >
              <span className="block font-display text-xl font-extrabold">{c.name}</span>
              <span className="text-xs text-muted-foreground">{c.desc}</span>
            </Link>
          ))}
        </div>
      </Section>
    </main>
  );
}
