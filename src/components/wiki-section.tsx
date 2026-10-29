import { useQuery } from "@tanstack/react-query";
import { Section } from "@/components/ui-bits";
import { wikiArticle } from "@/lib/tm.functions";

const LABEL = {
  club: "Historia och information",
  player: "Karriär och bakgrund",
  coach: "Karriär och bakgrund",
};

/** Hämtar och visar fotbollsartikeln från Wikipedia för ett lag, en spelare eller en tränare. */
export function WikiSection({
  name,
  kind,
}: {
  name: string | undefined;
  kind: "club" | "player" | "coach";
}) {
  const q = useQuery({
    queryKey: ["wiki-article", kind, name?.toLowerCase()],
    queryFn: () => wikiArticle({ data: { name: name!, kind } }),
    enabled: !!name,
    staleTime: 3600_000,
    gcTime: 3600_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  return (
    <Section
      title={LABEL[kind]}
      right={<span className="text-xs text-muted-foreground">Källa: Wikipedia</span>}
    >
      {!name && <p className="text-sm text-muted-foreground">Väntar på namn…</p>}
      {name && q.isLoading && (
        <p className="text-sm text-muted-foreground">Hämtar från Wikipedia…</p>
      )}
      {name && q.data === null && (
        <p className="text-sm text-muted-foreground">
          Hittade ingen Wikipedia-artikel för {name}.{" "}
          <a
            className="text-primary underline"
            target="_blank"
            rel="noopener"
            href={`https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(name)}`}
          >
            Sök själv på Wikipedia
          </a>
        </p>
      )}
      {q.data && (
        <>
          <article className="wiki-body" dangerouslySetInnerHTML={{ __html: q.data.html }} />
          <p className="mt-4 text-xs text-muted-foreground">
            Texten kommer från{" "}
            <a className="text-primary underline" target="_blank" rel="noopener" href={q.data.url}>
              Wikipedia: {q.data.title}
            </a>{" "}
            (CC BY-SA).
          </p>
        </>
      )}
    </Section>
  );
}
