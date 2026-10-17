import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { wikiPage } from "@/lib/tm.functions";
import { UEFA_COMPS } from "./uefa.index";

export const Route = createFileRoute("/uefa/$slug")({
  loader: ({ params }) => {
    const comp = UEFA_COMPS.find((c) => c.slug === params.slug);
    if (!comp) throw notFound();
    return comp;
  },
  head: ({ loaderData }) => {
    const t = loaderData ? `${loaderData.name} – UEFA – Free Role Lab` : "UEFA – Free Role Lab";
    const d = loaderData ? `${loaderData.name}: ${loaderData.desc}.` : "UEFA-tävling";
    return { meta: [{ title: t }, { name: "description", content: d }, { property: "og:title", content: t }, { property: "og:description", content: d }] };
  },
  component: UefaCompPage,
});

function UefaCompPage() {
  const comp = Route.useLoaderData();
  const q = useQuery({
    queryKey: ["wiki", comp.wiki],
    queryFn: () => wikiPage({ data: comp.wiki }),
    staleTime: 86_400_000,
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <p className="text-sm text-muted-foreground">
        <Link to="/uefa" className="text-primary underline">UEFA</Link> / {comp.name}
      </p>
      {q.isLoading && <p className="mt-6 text-sm text-muted-foreground">Hämtar tävlingen…</p>}
      {q.error && <p className="mt-6 text-sm text-destructive">{(q.error as Error).message}</p>}
      {q.data && (
        <>
          <h1 className="mt-2 font-display text-4xl font-extrabold">{comp.name}</h1>
          <article className="wiki-body mt-6" dangerouslySetInnerHTML={{ __html: q.data.html }} />
          <p className="mt-8 text-xs text-muted-foreground">
            Innehåll från <a href={`https://en.wikipedia.org/wiki/${encodeURIComponent(comp.wiki.replace(/ /g, "_"))}`} target="_blank" rel="noopener" className="text-primary underline">Wikipedia</a> (CC BY-SA).
          </p>
        </>
      )}
    </main>
  );
}
