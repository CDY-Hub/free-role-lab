// This catalogue identifies competitions; all table rows still come from Transfermarkt.
// Fokus: de fem stora ligorna, Allsvenskan, Portugal och Nederländerna. Lägre divisioner
// (Superettan, Ettan, andradivisioner m.fl.) är medvetet borttagna.
export type League = {
  id: string;
  name: string;
  country: string;
  aliases?: string[];
  /** Artikelnamn på engelska Wikipedia (utan säsong), om det skiljer sig från `name`. */
  wiki?: string;
};

export const LEAGUES: League[] = [
  { id: "SE1", name: "Allsvenskan", country: "Sverige" },
  { id: "GB1", name: "Premier League", country: "England" },
  { id: "ES1", name: "LaLiga", country: "Spanien", wiki: "La Liga" },
  { id: "L1", name: "Bundesliga", country: "Tyskland" },
  { id: "IT1", name: "Serie A", country: "Italien" },
  { id: "FR1", name: "Ligue 1", country: "Frankrike" },
  {
    id: "PO1",
    name: "Liga Portugal",
    country: "Portugal",
    aliases: ["Liga NOS", "Primeira Liga", "Liga Portugal Betclic"],
    wiki: "Primeira Liga",
  },
  {
    id: "NL1",
    name: "Eredivisie",
    country: "Nederländerna",
    aliases: ["Holland", "Holländska ligan"],
  },
];

// League names are commonly written with or without spaces (La liga/LaLiga).
const normalize = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("sv")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[\s\p{P}]+/gu, "");

const names = (l: League) => [l.name, ...(l.aliases ?? [])].map(normalize);

export function matchingLeagues(query: string) {
  const filter = normalize(query);
  if (!filter) return LEAGUES;
  // Ett exakt namn/alias vinner över delträffar ("La liga" ska inte även ge "LaLiga 2").
  const exact = LEAGUES.filter((league) => names(league).includes(filter));
  if (exact.length > 0) return exact;
  return LEAGUES.filter(
    (league) =>
      names(league).some((n) => n.includes(filter)) || normalize(league.country).includes(filter),
  );
}

export function isLeagueSearch(query: string) {
  return LEAGUES.some((league) => names(league).includes(normalize(query)));
}
