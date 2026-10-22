// This catalogue identifies competitions; all table rows still come from Transfermarkt.
export const LEAGUES: { id: string; name: string; country: string; aliases?: string[] }[] = [
  { id: "SE1", name: "Allsvenskan", country: "Sverige" },
  { id: "SE2", name: "Superettan", country: "Sverige" },
  { id: "SE3N", name: "Ettan Norra", country: "Sverige", aliases: ["Division 1 Norra", "Div 1 Norra"] },
  { id: "SE3S", name: "Ettan Södra", country: "Sverige", aliases: ["Division 1 Södra", "Div 1 Södra"] },
  { id: "GB1", name: "Premier League", country: "England" },
  { id: "GB2", name: "Championship", country: "England", aliases: ["EFL Championship"] },
  { id: "ES1", name: "LaLiga", country: "Spanien" },
  { id: "ES2", name: "LaLiga 2", country: "Spanien", aliases: ["Segunda Division"] },
  { id: "L1", name: "Bundesliga", country: "Tyskland" },
  { id: "L2", name: "2. Bundesliga", country: "Tyskland" },
  { id: "IT1", name: "Serie A", country: "Italien" },
  { id: "IT2", name: "Serie B", country: "Italien" },
  { id: "FR1", name: "Ligue 1", country: "Frankrike" },
  { id: "FR2", name: "Ligue 2", country: "Frankrike" },
  { id: "PO1", name: "Liga Portugal", country: "Portugal", aliases: ["Liga NOS", "Primeira Liga", "Liga Portugal Betclic"] },
  { id: "NL1", name: "Eredivisie", country: "Nederländerna", aliases: ["Holland", "Holländska ligan"] },
  { id: "DK1", name: "Superliga", country: "Danmark", aliases: ["Danska ligan"] },
  { id: "NO1", name: "Eliteserien", country: "Norge", aliases: ["Norska ligan"] },
  { id: "TR1", name: "Süper Lig", country: "Turkiet" },
  { id: "SA1", name: "Saudi Pro League", country: "Saudiarabien" },
  { id: "MLS1", name: "MLS", country: "USA", aliases: ["Major League Soccer"] },
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
