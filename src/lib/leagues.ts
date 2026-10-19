// This catalogue identifies competitions; all table rows still come from Transfermarkt.
export const LEAGUES: { id: string; name: string; country: string; aliases?: string[] }[] = [
  { id: "SE1", name: "Allsvenskan", country: "Sverige" },
  { id: "SE2", name: "Superettan", country: "Sverige" },
  { id: "GB1", name: "Premier League", country: "England" },
  { id: "ES1", name: "LaLiga", country: "Spanien" },
  { id: "L1", name: "Bundesliga", country: "Tyskland" },
  { id: "IT1", name: "Serie A", country: "Italien" },
  { id: "FR1", name: "Ligue 1", country: "Frankrike" },
  { id: "PO1", name: "Liga Portugal", country: "Portugal", aliases: ["Liga NOS", "Primeira Liga", "Liga Portugal Betclic"] },
  { id: "NL1", name: "Eredivisie", country: "Nederländerna", aliases: ["Holland", "Holländska ligan"] },
];

// League names are commonly written with or without spaces (La liga/LaLiga).
const normalize = (value: string) => value.trim().toLocaleLowerCase("sv").normalize("NFD").replace(/\p{M}/gu, "").replace(/[\s\p{P}]+/gu, "");

const names = (l: (typeof LEAGUES)[number]) => [l.name, ...(l.aliases ?? [])].map(normalize);

export function matchingLeagues(query: string) {
  const filter = normalize(query);
  return LEAGUES.filter((league) => !filter || names(league).some((n) => n.includes(filter)) || normalize(league.country).includes(filter));
}

export function isLeagueSearch(query: string) {
  return LEAGUES.some((league) => names(league).includes(normalize(query)));
}
