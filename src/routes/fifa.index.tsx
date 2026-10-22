import { createFileRoute, Link } from "@tanstack/react-router";
import { Section } from "@/components/ui-bits";

export const Route = createFileRoute("/fifa/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "FIFA – Världsmästerskapen – Free Role Lab" },
      { name: "description", content: "Alla fotbolls-VM genom tiderna – välj ett år och läs allt om mästerskapet." },
      { property: "og:title", content: "FIFA – Världsmästerskapen – Free Role Lab" },
      { property: "og:description", content: "Alla fotbolls-VM genom tiderna." },
    ],
  }),
  component: FifaPage,
});

const WC_YEARS: { year: number; host: string }[] = [
  { year: 2026, host: "USA / Kanada / Mexiko" },
  { year: 2022, host: "Qatar" }, { year: 2018, host: "Ryssland" }, { year: 2014, host: "Brasilien" },
  { year: 2010, host: "Sydafrika" }, { year: 2006, host: "Tyskland" }, { year: 2002, host: "Sydkorea/Japan" },
  { year: 1998, host: "Frankrike" }, { year: 1994, host: "USA" }, { year: 1990, host: "Italien" },
  { year: 1986, host: "Mexiko" }, { year: 1982, host: "Spanien" }, { year: 1978, host: "Argentina" },
  { year: 1974, host: "Västtyskland" }, { year: 1970, host: "Mexiko" }, { year: 1966, host: "England" },
  { year: 1962, host: "Chile" }, { year: 1958, host: "Sverige" }, { year: 1954, host: "Schweiz" },
  { year: 1950, host: "Brasilien" }, { year: 1938, host: "Frankrike" }, { year: 1934, host: "Italien" },
  { year: 1930, host: "Uruguay" },
];

function FifaPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <p className="font-display text-sm font-bold tracking-widest text-primary">FIFA</p>
      <h1 className="font-display text-4xl font-extrabold">Världsmästerskapen</h1>
      <p className="text-sm text-muted-foreground">Välj ett år för att se all information om mästerskapet – grupper, matcher, målskyttar och historik.</p>
      <Section title="Välj mästerskap">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {WC_YEARS.map(({ year, host }) => (
            <Link
              key={year}
              to="/fifa/vm/$year"
              params={{ year: String(year) }}
              className="rounded-lg border bg-card p-4 transition-colors hover:border-primary"
            >
              <span className="block font-display text-2xl font-extrabold">{year}</span>
              <span className="text-xs text-muted-foreground">{host}</span>
            </Link>
          ))}
        </div>
      </Section>
    </main>
  );
}
