import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { wikiPage } from "@/lib/tm.functions";

const VALID = /^(19[3-9]\d|20[0-3]\d)$/;

export const Route = createFileRoute("/fifa/vm/$year")({
  loader: ({ params }: { params: any }) => {
    if (!VALID.test(params.year)) throw notFound();
    return { year: params.year };
  },
  head: ({ loaderData }: { loaderData?: any }) => {
    const t = loaderData ? `VM ${loaderData.year} – Free Role Lab` : "VM – Free Role Lab";
    const d = loaderData ? `All information om fotbolls-VM ${loaderData.year}: grupper, matcher, resultat och målskyttar.` : "Fotbolls-VM";
    return { meta: [{ title: t }, { name: "description", content: d }, { property: "og:title", content: t }, { property: "og:description", content: d }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] };
  },
  component: WcYearPage,
});

function WcYearPage() {
  const { year } = Route.useLoaderData();
  const q = useQuery({
    queryKey: ["wiki", `${year}_FIFA_World_Cup`],
    queryFn: () => wikiPage({ data: `${year} FIFA World Cup` }),
    staleTime: 86_400_000,
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <p className="text-sm text-muted-foreground">
        <Link to="/fifa" className="text-primary underline">FIFA</Link> / VM {year}
      </p>
      {q.isLoading && <p className="mt-6 text-sm text-muted-foreground">Hämtar mästerskapet…</p>}
      {q.error && <p className="mt-6 text-sm text-destructive">{(q.error as Error).message}</p>}
      {q.data && (
        <>
          <h1 className="mt-2 font-display text-4xl font-extrabold">{q.data.title}</h1>
          <article className="wiki-body mt-6" dangerouslySetInnerHTML={{ __html: q.data.html }} />
          <p className="mt-8 text-xs text-muted-foreground">
            Innehåll från <a href={`https://en.wikipedia.org/wiki/${year}_FIFA_World_Cup`} target="_blank" rel="noopener" className="text-primary underline">Wikipedia</a> (CC BY-SA).
          </p>
        </>
      )}
    </main>
  );
}
