// @ts-nocheck -- generated sample data; strict index checks add no value here
// Exempeldata – deterministiskt genererad så att samma spelare alltid ser likadan ut.

export type League = { id: string; name: string; country: string; tier: number };
export type Club = { id: string; name: string; short: string; leagueId: string; city: string; founded: number; stadium: string };
export type Position = "MV" | "HB" | "MB" | "VB" | "DM" | "CM" | "OM" | "HY" | "VY" | "AN";

export type MatchAppearance = {
  id: string;
  date: string;
  competition: string;
  home: string;
  away: string;
  scoreHome: number;
  scoreAway: number;
  isHome: boolean;
  minutes: number;
  goals: number;
  assists: number;
  rating: number;
  yellow: boolean;
  red: boolean;
  shots: number;
  passAcc: number;
};

export type SeasonStat = {
  season: string;
  clubId: string;
  apps: number;
  goals: number;
  assists: number;
  minutes: number;
  avgRating: number;
  yellow: number;
  red: number;
  cleanSheets?: number;
};

export type Transfer = { date: string; fromClub: string; toClub: string; fee: string; type: "Köp" | "Lån" | "Fri" | "Ungdom" };
export type ScoutReport = { scout: string; agency: string; date: string; rating: number; potential: number; text: string };

export type Player = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  age: number;
  birthDate: string;
  birthPlace: string;
  nationality: string;
  clubId: string;
  position: Position;
  secondary: Position[];
  shirt: number;
  height: number;
  weight: number;
  foot: "Höger" | "Vänster" | "Båda";
  marketValue: number;
  contractUntil: string;
  agent: string;
  attributes: { group: string; items: { name: string; value: number }[] }[];
  matches: MatchAppearance[];
  seasons: SeasonStat[];
  transfers: Transfer[];
  scoutReports: ScoutReport[];
  injuries: { from: string; to: string; type: string }[];
  car?: string;
  strengths: string[];
  weaknesses: string[];
};

export type Coach = {
  id: string;
  name: string;
  age: number;
  nationality: string;
  clubId: string;
  formation: string;
  style: string;
  license: string;
  since: string;
  career: { from: string; to: string; club: string; role: string; matches: number; winPct: number }[];
  trophies: string[];
  playerCareer?: { from: string; to: string; club: string; apps: number; goals: number }[];
  bio: string;
};

export const leagues: League[] = [
  { id: "allsvenskan", name: "Allsvenskan", country: "Sverige", tier: 1 },
  { id: "superettan", name: "Superettan", country: "Sverige", tier: 2 },
  { id: "div1-norra", name: "Ettan Norra", country: "Sverige", tier: 3 },
  { id: "div2-sodra", name: "Division 2 Södra Götaland", country: "Sverige", tier: 4 },
  { id: "div3-sydvastra", name: "Division 3 Sydvästra Götaland", country: "Sverige", tier: 5 },
  { id: "div3-norra-svea", name: "Division 3 Norra Svealand", country: "Sverige", tier: 5 },
];

const clubSeed: [string, string, string, string][] = [
  ["Malmö Norra IF", "MNI", "allsvenskan", "Malmö"],
  ["Stockholm Kungsholmen FF", "SKF", "allsvenskan", "Stockholm"],
  ["Göteborgs Hamn BK", "GHB", "allsvenskan", "Göteborg"],
  ["Norrköping Strömmen", "NST", "allsvenskan", "Norrköping"],
  ["Helsingborg Sund IF", "HSI", "superettan", "Helsingborg"],
  ["Örebro Svartån FK", "ÖSF", "superettan", "Örebro"],
  ["Sundsvall Kusten IK", "SKI", "superettan", "Sundsvall"],
  ["Gävle Hamnar IF", "GHI", "div1-norra", "Gävle"],
  ["Uppsala Fyris FF", "UFF", "div1-norra", "Uppsala"],
  ["Växjö Sjöstad BK", "VSB", "div2-sodra", "Växjö"],
  ["Kalmar Slott IF", "KSI", "div2-sodra", "Kalmar"],
  ["Lunds Stadspark FK", "LSF", "div3-sydvastra", "Lund"],
  ["Trelleborg Hamnen IF", "THI", "div3-sydvastra", "Trelleborg"],
  ["Ystad Österlen BK", "YÖB", "div3-sydvastra", "Ystad"],
  ["Eslöv Ringsjö IK", "ERI", "div3-sydvastra", "Eslöv"],
  ["Västerås Mälaren FF", "VMF", "div3-norra-svea", "Västerås"],
  ["Falun Dalarna IF", "FDI", "div3-norra-svea", "Falun"],
  ["Borlänge Dalälven BK", "BDB", "div3-norra-svea", "Borlänge"],
];

export const clubs: Club[] = clubSeed.map(([name, short, leagueId, city], i) => ({
  id: slug(name),
  name,
  short,
  leagueId,
  city,
  founded: 1890 + ((i * 7) % 90),
  stadium: `${city} ${["Arena", "Idrottsplats", "Stadion", "IP", "Vallen"][i % 5]}`,
}));

function slug(s: string) {
  return s
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const firstNames = ["Erik", "Oscar", "Lucas", "William", "Hugo", "Elias", "Alexander", "Liam", "Noah", "Adam", "Viktor", "Filip", "Isak", "Anton", "Emil", "Jonathan", "Gustav", "Ludvig", "Albin", "Leo", "Samuel", "Omar", "Ali", "Amir", "Mohammed", "Dino", "Marko", "Nikola", "Jesper", "Rasmus", "Kevin", "Simon", "Jakob", "Theo", "Melvin", "Edvin", "Axel", "Arvid", "Carl", "Max"];
const lastNames = ["Andersson", "Johansson", "Karlsson", "Nilsson", "Eriksson", "Larsson", "Olsson", "Persson", "Svensson", "Gustafsson", "Pettersson", "Jonsson", "Lindberg", "Lindqvist", "Berg", "Holm", "Ahmed", "Hassan", "Kovačević", "Petrović", "Lund", "Ek", "Sandberg", "Forsberg", "Nyström", "Sjöberg", "Wallin", "Engström", "Hedlund", "Öberg", "Isaksson", "Bergström", "Mansour", "Yilmaz", "Jallow", "Diallo", "Okafor", "Mendes", "Haddad", "Lindgren"];
const nations = ["Sverige", "Sverige", "Sverige", "Sverige", "Sverige", "Bosnien", "Serbien", "Irak", "Somalia", "Gambia", "Nigeria", "Finland", "Danmark", "Norge", "Turkiet"];
const birthPlaces = ["Malmö", "Göteborg", "Stockholm", "Uppsala", "Lund", "Örebro", "Västerås", "Helsingborg", "Jönköping", "Linköping", "Umeå", "Borås"];
const agents = ["Nordic Sports Mgmt", "Skandia Football Agency", "Fri agent", "Elite Talent AB", "Baltic Stars", "Familjerepresentant"];
const scouts = [
  ["Lars Hedström", "Nordscout AB"],
  ["Maria Ekdahl", "Svensk Talangbank"],
  ["Johan Brink", "FC Scouting Network"],
  ["Ahmed Farouk", "Eurotalent Scouting"],
  ["Peter Lund", "Allsvensk Scoutpool"],
];
const cars = ["Volvo XC60", "Audi RS3", "VW Golf GTI", "Tesla Model 3", "BMW M2", "Polestar 2", "Mercedes A45 AMG", "Volvo V60", "Toyota Corolla", "Kia EV6"];
const injuryTypes = ["Hamstring", "Fotledsstukning", "Ljumske", "Knäskada (MCL)", "Hjärnskakning", "Vadmuskel", "Lårkaka"];

const positions: Position[] = ["MV", "MV", "HB", "HB", "MB", "MB", "MB", "VB", "VB", "DM", "CM", "CM", "OM", "HY", "VY", "HY", "AN", "AN"];
export const positionNames: Record<Position, string> = {
  MV: "Målvakt",
  HB: "Högerback",
  MB: "Mittback",
  VB: "Vänsterback",
  DM: "Defensiv mittfältare",
  CM: "Central mittfältare",
  OM: "Offensiv mittfältare",
  HY: "Högerytter",
  VY: "Vänsterytter",
  AN: "Anfallare",
};

const tierValue = [0, 900000, 300000, 120000, 50000, 15000];
const tierRatingBase = [0, 14, 12, 10.5, 9, 8];

function buildPlayer(club: Club, idx: number, ci: number): Player {
  const r = rng(ci * 1000 + idx * 31 + 7);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const league = leagues.find((l) => l.id === club.leagueId)!;
  const firstName = pick(firstNames);
  const lastName = pick(lastNames);
  const age = 17 + Math.floor(r() * 17);
  const position = positions[idx % positions.length];
  const base = tierRatingBase[league.tier] + r() * 3;
  const att = (bias = 0) => Math.max(1, Math.min(20, Math.round(base + bias + (r() - 0.5) * 6)));
  const isGk = position === "MV";
  const isAtt = ["AN", "HY", "VY", "OM"].includes(position);
  const isDef = ["MB", "HB", "VB", "DM"].includes(position);

  const attributes = isGk
    ? [
        { group: "Målvakt", items: ["Reflexer", "Positionering", "Uthopp", "Utspark", "Kommunikation", "En mot en", "Handhavande"].map((n) => ({ name: n, value: att(2) })) },
        { group: "Mental", items: ["Koncentration", "Beslutsfattande", "Ledarskap", "Lugn", "Mod"].map((n) => ({ name: n, value: att() })) },
        { group: "Fysisk", items: ["Hopp", "Snabbhet", "Styrka", "Smidighet", "Uthållighet"].map((n) => ({ name: n, value: att() })) },
      ]
    : [
        { group: "Teknisk", items: ["Avslut", "Passning", "Dribbling", "Första touch", "Inlägg", "Nickspel", "Tackling", "Fasta situationer"].map((n) => ({ name: n, value: att(n === "Tackling" ? (isDef ? 3 : -3) : n === "Avslut" ? (isAtt ? 3 : -3) : 0) })) },
        { group: "Mental", items: ["Spelförståelse", "Positionering", "Arbetsvilja", "Beslutsfattande", "Lugn", "Ledarskap", "Rörelse utan boll"].map((n) => ({ name: n, value: att() })) },
        { group: "Fysisk", items: ["Acceleration", "Snabbhet", "Styrka", "Uthållighet", "Balans", "Hopp"].map((n) => ({ name: n, value: att() })) },
      ];

  const opponents = clubs.filter((c) => c.leagueId === club.leagueId && c.id !== club.id);
  const opp = opponents.length ? opponents : clubs.filter((c) => c.id !== club.id).slice(0, 5);
  const matches: MatchAppearance[] = Array.from({ length: 14 }, (_, m) => {
    const isHome = r() > 0.5;
    const o = opp[m % opp.length];
    const sh = Math.floor(r() * 4);
    const sa = Math.floor(r() * 4);
    const minutes = r() > 0.2 ? 90 : 20 + Math.floor(r() * 60);
    const goals = isGk ? 0 : r() < (isAtt ? 0.35 : 0.08) ? 1 + (r() > 0.85 ? 1 : 0) : 0;
    const assists = isGk ? 0 : r() < 0.18 ? 1 : 0;
    const d = new Date(2026, 9, 10 - m * 7);
    return {
      id: `${club.short}-${idx}-${m}`,
      date: d.toISOString().slice(0, 10),
      competition: m === 4 ? "Svenska Cupen" : league.name,
      home: isHome ? club.name : o.name,
      away: isHome ? o.name : club.name,
      scoreHome: Math.max(sh, isHome ? goals : 0),
      scoreAway: Math.max(sa, isHome ? 0 : goals),
      isHome,
      minutes,
      goals,
      assists,
      rating: Math.round((6 + r() * 2.4 + goals * 0.6 + assists * 0.3) * 10) / 10,
      yellow: r() < 0.12,
      red: r() < 0.015,
      shots: isGk ? 0 : Math.floor(r() * (isAtt ? 5 : 2)),
      passAcc: Math.round(65 + r() * 28),
    };
  });

  const seasons: SeasonStat[] = [2026, 2025, 2024, 2023].slice(0, Math.max(1, Math.min(4, age - 16))).map((y, k) => {
    const apps = 10 + Math.floor(r() * 20);
    return {
      season: String(y),
      clubId: k < 2 ? club.id : pick(clubs).id,
      apps,
      goals: isGk ? 0 : Math.floor(r() * apps * (isAtt ? 0.5 : 0.1)),
      assists: isGk ? 0 : Math.floor(r() * apps * 0.25),
      minutes: apps * (60 + Math.floor(r() * 30)),
      avgRating: Math.round((6.4 + r() * 1.2) * 100) / 100,
      yellow: Math.floor(r() * 6),
      red: r() < 0.1 ? 1 : 0,
      cleanSheets: isGk ? Math.floor(r() * apps * 0.4) : undefined,
    };
  });

  const prevClub = pick(clubs.filter((c) => c.id !== club.id));
  const transfers: Transfer[] = [
    { date: `${2026 - Math.min(age - 17, 2)}-01-15`, fromClub: prevClub.name, toClub: club.name, fee: league.tier <= 2 ? `${(r() * 4 + 0.2).toFixed(1)} MSEK` : "Fri övergång", type: league.tier <= 2 ? "Köp" : "Fri" },
    { date: `${2026 - Math.min(age - 16, 6)}-07-01`, fromClub: `${pick(birthPlaces)} BoIS U19`, toClub: prevClub.name, fee: "–", type: "Ungdom" },
  ];

  const sr = scouts[Math.floor(r() * scouts.length)];
  const ratingStars = Math.round((base / 4) * 2) / 2;
  const strengthsPool = isGk ? ["Reflexer", "Distribution", "Ledarskap", "Utgångar"] : isAtt ? ["Avslutning", "Djupledslöpningar", "Dribbling", "Snabbhet", "Kombinationsspel"] : isDef ? ["Duellspel", "Spelförståelse", "Huvudspel", "Uppspel", "Positionering"] : ["Passningsspel", "Arbetskapacitet", "Spelavlämning", "Pressspel"];
  const weakPool = ["Svag vänsterfot", "Kan tappa koncentration", "Begränsad snabbhet", "Disciplin", "Luftdueller", "Konsistens"];

  return {
    id: `${slug(firstName)}-${slug(lastName)}-${club.short.toLowerCase().replace(/[^a-z]/g, "")}${idx}`,
    firstName,
    lastName,
    name: `${firstName} ${lastName}`,
    age,
    birthDate: `${2026 - age}-${String(1 + Math.floor(r() * 12)).padStart(2, "0")}-${String(1 + Math.floor(r() * 28)).padStart(2, "0")}`,
    birthPlace: pick(birthPlaces),
    nationality: pick(nations),
    clubId: club.id,
    position,
    secondary: position === "MV" ? [] : [pick(positions.filter((p) => p !== "MV" && p !== position))],
    shirt: idx === 0 ? 1 : ((idx * 3) % 98) + 2,
    height: isGk ? 186 + Math.floor(r() * 10) : 170 + Math.floor(r() * 20),
    weight: 66 + Math.floor(r() * 20),
    foot: r() > 0.78 ? "Vänster" : r() > 0.95 ? "Båda" : "Höger",
    marketValue: Math.round((tierValue[league.tier] * (0.4 + r() * 2) * (age < 24 ? 1.6 : age > 30 ? 0.6 : 1)) / 5000) * 5000,
    contractUntil: `${2026 + 1 + Math.floor(r() * 4)}-12-31`,
    agent: pick(agents),
    attributes,
    matches,
    seasons,
    transfers,
    scoutReports: [
      {
        scout: sr[0],
        agency: sr[1],
        date: "2026-09-" + String(1 + Math.floor(r() * 28)).padStart(2, "0"),
        rating: Math.min(5, Math.max(1, ratingStars)),
        potential: Math.min(5, Math.max(1, ratingStars + (age < 22 ? 1 : 0))),
        text: `${firstName} är en ${age < 22 ? "lovande" : "rutinerad"} ${positionNames[position].toLowerCase()} som sticker ut med ${pick(strengthsPool).toLowerCase()}. ${league.tier >= 4 ? `Kan mycket väl ta steget upp från ${league.name}.` : "Etablerad på nivån och med kapacitet för mer."} Bör följas upp under ${age < 22 ? "kommande säsong" : "vårens matcher"}.`,
      },
    ],
    injuries: r() < 0.35 ? [{ from: "2026-04-02", to: "2026-05-10", type: pick(injuryTypes) }] : [],
    car: league.tier <= 2 || r() > 0.5 ? pick(cars) : undefined,
    strengths: [pick(strengthsPool), pick(strengthsPool)].filter((v, i, a) => a.indexOf(v) === i),
    weaknesses: [pick(weakPool)],
  };
}

export const players: Player[] = clubs.flatMap((club, ci) =>
  Array.from({ length: 18 }, (_, i) => buildPlayer(club, i, ci)),
);

const coachNames = ["Mikael Stahre", "Anna Signeul", "Jens Gustavsson", "Thomas Lagerlöf", "Henrik Rydström", "Kalle Björklund", "Magnus Pehrsson", "Per-Ola Ljung", "Andreas Alm", "Jonas Thern", "Sanna Lindh", "Bosse Ekberg", "Olof Mellberg", "Rikard Norling", "Patrik Jarl", "Fredrik Holm", "Daniel Ahl", "Tobias Rehn"];
const styles = ["Högpress och snabba omställningar", "Bollinnehav med positionsspel", "Kompakt försvar och kontringar", "Direkt spel med långa bollar", "Offensivt 4-3-3 med ytterbackar högt"];
const formations = ["4-3-3", "4-4-2", "3-5-2", "4-2-3-1", "5-3-2"];

export const coaches: Coach[] = clubs.map((club, i) => {
  const r = rng(9000 + i * 17);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const name = coachNames[i % coachNames.length] + (i >= coachNames.length ? " Jr" : "");
  const wasPlayer = r() > 0.35;
  const age = 38 + Math.floor(r() * 22);
  const pastClubs = clubs.filter((c) => c.id !== club.id);
  const career = [
    { from: "2024", to: "nu", club: club.name, role: "Huvudtränare", matches: 40 + Math.floor(r() * 30), winPct: Math.round(35 + r() * 30) },
    { from: "2020", to: "2023", club: pick(pastClubs).name, role: "Huvudtränare", matches: 80 + Math.floor(r() * 40), winPct: Math.round(30 + r() * 30) },
    { from: "2016", to: "2019", club: pick(pastClubs).name, role: "Assisterande tränare", matches: 100 + Math.floor(r() * 30), winPct: Math.round(30 + r() * 25) },
  ];
  return {
    id: slug(name),
    name,
    age,
    nationality: r() > 0.8 ? "Norge" : "Sverige",
    clubId: club.id,
    formation: pick(formations),
    style: pick(styles),
    license: club.leagueId === "allsvenskan" || club.leagueId === "superettan" ? "UEFA Pro" : r() > 0.5 ? "UEFA A" : "UEFA B",
    since: "2024-01-01",
    career,
    trophies: r() > 0.5 ? [`Seriesegrare ${pick(leagues).name} 2022`, r() > 0.6 ? "Svenska Cupen 2021" : "Årets tränare (distrikt) 2023"] : ["Uppflyttning 2021"],
    playerCareer: wasPlayer
      ? [
          { from: String(1990 + (age - 38)), to: String(1996 + (age - 38)), club: pick(pastClubs).name, apps: 80 + Math.floor(r() * 120), goals: Math.floor(r() * 30) },
          { from: String(1996 + (age - 38)), to: String(2002 + (age - 38)), club: pick(pastClubs).name, apps: 60 + Math.floor(r() * 100), goals: Math.floor(r() * 20) },
        ]
      : undefined,
    bio: `${name} tog över ${club.name} inför säsongen 2024 och är känd för ${pick(styles).toLowerCase()}. ${wasPlayer ? "Hade en lång karriär som spelare innan tränarbanan." : "Har aldrig spelat på elitnivå utan byggt sin karriär via ungdomsfotbollen."}`,
  };
});

export const getClub = (id: string) => clubs.find((c) => c.id === id);
export const getLeague = (id: string) => leagues.find((l) => l.id === id);
export const getPlayer = (id: string) => players.find((p) => p.id === id);
export const getCoach = (id: string) => coaches.find((c) => c.id === id);
export const coachOf = (clubId: string) => coaches.find((c) => c.clubId === clubId);

export function formatSEK(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".", ",")} MSEK`;
  if (v >= 1000) return `${Math.round(v / 1000)} tkr`;
  return `${v} kr`;
}

function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function search(q: string) {
  const n = norm(q.trim());
  if (!n) return { players: [], coaches: [], clubs: [] };
  return {
    players: players.filter((p) => norm(`${p.name} ${getClub(p.clubId)?.name} ${positionNames[p.position]}`).includes(n)).slice(0, 50),
    coaches: coaches.filter((c) => norm(c.name).includes(n)),
    clubs: clubs.filter((c) => norm(`${c.name} ${c.city}`).includes(n)),
  };
}

export type LiveMatch = { id: string; leagueId: string; home: string; away: string; sh: number; sa: number; minute: string };
export const todaysMatches: LiveMatch[] = leagues.flatMap((l, li) => {
  const lc = clubs.filter((c) => c.leagueId === l.id);
  const out: LiveMatch[] = [];
  for (let i = 0; i + 1 < lc.length; i += 2) {
    const r = rng(li * 50 + i);
    out.push({ id: `${l.id}-${i}`, leagueId: l.id, home: lc[i].name, away: lc[i + 1].name, sh: Math.floor(r() * 4), sa: Math.floor(r() * 3), minute: ["67'", "HT", "FT", "19:00", "23'"][Math.floor(r() * 5)] });
  }
  return out;
});
