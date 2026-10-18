// This catalogue identifies competitions; all table rows still come from Transfermarkt.
export const LEAGUES = [
  { id: "SE1", name: "Allsvenskan", country: "Sverige" },
  { id: "SE2", name: "Superettan", country: "Sverige" },
  { id: "GB1", name: "Premier League", country: "England" },
  { id: "ES1", name: "LaLiga", country: "Spanien" },
  { id: "L1", name: "Bundesliga", country: "Tyskland" },
  { id: "IT1", name: "Serie A", country: "Italien" },
  { id: "FR1", name: "Ligue 1", country: "Frankrike" },
];

const normalize = (value: string) => value.trim().toLocaleLowerCase("sv").replace(/\s+/g, " ");

export function matchingLeagues(query: string) {
  const filter = normalize(query);
  return LEAGUES.filter((league) => !filter || normalize(league.name).includes(filter) || normalize(league.country).includes(filter));
}

export function isLeagueSearch(query: string) {
  return LEAGUES.some((league) => normalize(league.name) === normalize(query));
}