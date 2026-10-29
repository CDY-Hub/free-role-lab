/** Säsongsväljare för UEFA-tävlingarna. Varje säsong pekar på en artikel på engelska Wikipedia. */

export interface SeasonItem {
  label: string;
  wikiPage: string;
}

export interface DecadeGroup {
  id: string;
  label: string;
  seasons: SeasonItem[];
}

export function getDecades(slug: string): DecadeGroup[] {
  if (slug === "champions-league") {
    return [
      {
        id: "2020s",
        label: "20–21 till 26–27",
        seasons: [
          { label: "2026–27", wikiPage: "2026–27 UEFA Champions League" },
          { label: "2025–26", wikiPage: "2025–26 UEFA Champions League" },
          { label: "2024–25", wikiPage: "2024–25 UEFA Champions League" },
          { label: "2023–24", wikiPage: "2023–24 UEFA Champions League" },
          { label: "2022–23", wikiPage: "2022–23 UEFA Champions League" },
          { label: "2021–22", wikiPage: "2021–22 UEFA Champions League" },
          { label: "2020–21", wikiPage: "2020–21 UEFA Champions League" },
        ],
      },
      {
        id: "2010s",
        label: "10–11 till 19–20",
        seasons: [
          { label: "2019–20", wikiPage: "2019–20 UEFA Champions League" },
          { label: "2018–19", wikiPage: "2018–19 UEFA Champions League" },
          { label: "2017–18", wikiPage: "2017–18 UEFA Champions League" },
          { label: "2016–17", wikiPage: "2016–17 UEFA Champions League" },
          { label: "2015–16", wikiPage: "2015–16 UEFA Champions League" },
          { label: "2014–15", wikiPage: "2014–15 UEFA Champions League" },
          { label: "2013–14", wikiPage: "2013–14 UEFA Champions League" },
          { label: "2012–13", wikiPage: "2012–13 UEFA Champions League" },
          { label: "2011–12", wikiPage: "2011–12 UEFA Champions League" },
          { label: "2010–11", wikiPage: "2010–11 UEFA Champions League" },
        ],
      },
      {
        id: "2000s",
        label: "00–01 till 09–10",
        seasons: [
          { label: "2009–10", wikiPage: "2009–10 UEFA Champions League" },
          { label: "2008–09", wikiPage: "2008–09 UEFA Champions League" },
          { label: "2007–08", wikiPage: "2007–08 UEFA Champions League" },
          { label: "2006–07", wikiPage: "2006–07 UEFA Champions League" },
          { label: "2005–06", wikiPage: "2005–06 UEFA Champions League" },
          { label: "2004–05", wikiPage: "2004–05 UEFA Champions League" },
          { label: "2003–04", wikiPage: "2003–04 UEFA Champions League" },
          { label: "2002–03", wikiPage: "2002–03 UEFA Champions League" },
          { label: "2001–02", wikiPage: "2001–02 UEFA Champions League" },
          { label: "2000–01", wikiPage: "2000–01 UEFA Champions League" },
        ],
      },
      {
        id: "1990s",
        label: "90–91 till 99–00",
        seasons: [
          { label: "1999–00", wikiPage: "1999–2000 UEFA Champions League" },
          { label: "1998–99", wikiPage: "1998–99 UEFA Champions League" },
          { label: "1997–98", wikiPage: "1997–98 UEFA Champions League" },
          { label: "1996–97", wikiPage: "1996–97 UEFA Champions League" },
          { label: "1995–96", wikiPage: "1995–96 UEFA Champions League" },
          { label: "1994–95", wikiPage: "1994–95 UEFA Champions League" },
          { label: "1993–94", wikiPage: "1993–94 UEFA Champions League" },
          { label: "1992–93", wikiPage: "1992–93 UEFA Champions League" },
          { label: "1991–92", wikiPage: "1991–92 European Cup" },
          { label: "1990–91", wikiPage: "1990–91 European Cup" },
        ],
      },
      {
        id: "1980s",
        label: "80–81 till 89–90",
        seasons: [
          { label: "1989–90", wikiPage: "1989–90 European Cup" },
          { label: "1988–89", wikiPage: "1988–89 European Cup" },
          { label: "1987–88", wikiPage: "1987–88 European Cup" },
          { label: "1986–87", wikiPage: "1986–87 European Cup" },
          { label: "1985–86", wikiPage: "1985–86 European Cup" },
          { label: "1984–85", wikiPage: "1984–85 European Cup" },
          { label: "1983–84", wikiPage: "1983–84 European Cup" },
          { label: "1982–83", wikiPage: "1982–83 European Cup" },
          { label: "1981–82", wikiPage: "1981–82 European Cup" },
          { label: "1980–81", wikiPage: "1980–81 European Cup" },
        ],
      },
      {
        id: "1970s",
        label: "70–71 till 79–80",
        seasons: [
          { label: "1979–80", wikiPage: "1979–80 European Cup" },
          { label: "1978–79", wikiPage: "1978–79 European Cup" },
          { label: "1977–78", wikiPage: "1977–78 European Cup" },
          { label: "1976–77", wikiPage: "1976–77 European Cup" },
          { label: "1975–76", wikiPage: "1975–76 European Cup" },
          { label: "1974–75", wikiPage: "1974–75 European Cup" },
          { label: "1973–74", wikiPage: "1973–74 European Cup" },
          { label: "1972–73", wikiPage: "1972–73 European Cup" },
          { label: "1971–72", wikiPage: "1971–72 European Cup" },
          { label: "1970–71", wikiPage: "1970–71 European Cup" },
        ],
      },
      {
        id: "1960s",
        label: "60–61 till 69–70",
        seasons: [
          { label: "1969–70", wikiPage: "1969–70 European Cup" },
          { label: "1968–69", wikiPage: "1968–69 European Cup" },
          { label: "1967–68", wikiPage: "1967–68 European Cup" },
          { label: "1966–67", wikiPage: "1966–67 European Cup" },
          { label: "1965–66", wikiPage: "1965–66 European Cup" },
          { label: "1964–65", wikiPage: "1964–65 European Cup" },
          { label: "1963–64", wikiPage: "1963–64 European Cup" },
          { label: "1962–63", wikiPage: "1962–63 European Cup" },
          { label: "1961–62", wikiPage: "1961–62 European Cup" },
          { label: "1960–61", wikiPage: "1960–61 European Cup" },
        ],
      },
      {
        id: "1950s",
        label: "55–56 till 59–60",
        seasons: [
          { label: "1959–60", wikiPage: "1959–60 European Cup" },
          { label: "1958–59", wikiPage: "1958–59 European Cup" },
          { label: "1957–58", wikiPage: "1957–58 European Cup" },
          { label: "1956–57", wikiPage: "1956–57 European Cup" },
          { label: "1955–56", wikiPage: "1955–56 European Cup" },
        ],
      },
    ];
  }

  if (slug === "europa-league") {
    return [
      {
        id: "2020s",
        label: "20–21 till 26–27",
        seasons: [
          { label: "2026–27", wikiPage: "2026–27 UEFA Europa League" },
          { label: "2025–26", wikiPage: "2025–26 UEFA Europa League" },
          { label: "2024–25", wikiPage: "2024–25 UEFA Europa League" },
          { label: "2023–24", wikiPage: "2023–24 UEFA Europa League" },
          { label: "2022–23", wikiPage: "2022–23 UEFA Europa League" },
          { label: "2021–22", wikiPage: "2021–22 UEFA Europa League" },
          { label: "2020–21", wikiPage: "2020–21 UEFA Europa League" },
        ],
      },
      {
        id: "2010s",
        label: "10–11 till 19–20",
        seasons: [
          { label: "2019–20", wikiPage: "2019–20 UEFA Europa League" },
          { label: "2018–19", wikiPage: "2018–19 UEFA Europa League" },
          { label: "2017–18", wikiPage: "2017–18 UEFA Europa League" },
          { label: "2016–17", wikiPage: "2016–17 UEFA Europa League" },
          { label: "2015–16", wikiPage: "2015–16 UEFA Europa League" },
          { label: "2014–15", wikiPage: "2014–15 UEFA Europa League" },
          { label: "2013–14", wikiPage: "2013–14 UEFA Europa League" },
          { label: "2012–13", wikiPage: "2012–13 UEFA Europa League" },
          { label: "2011–12", wikiPage: "2011–12 UEFA Europa League" },
          { label: "2010–11", wikiPage: "2010–11 UEFA Europa League" },
        ],
      },
      {
        id: "2000s",
        label: "00–01 till 09–10",
        seasons: [
          { label: "2009–10", wikiPage: "2009–10 UEFA Europa League" },
          { label: "2008–09", wikiPage: "2008–09 UEFA Cup" },
          { label: "2007–08", wikiPage: "2007–08 UEFA Cup" },
          { label: "2006–07", wikiPage: "2006–07 UEFA Cup" },
          { label: "2005–06", wikiPage: "2005–06 UEFA Cup" },
          { label: "2004–05", wikiPage: "2004–05 UEFA Cup" },
          { label: "2003–04", wikiPage: "2003–04 UEFA Cup" },
          { label: "2002–03", wikiPage: "2002–03 UEFA Cup" },
          { label: "2001–02", wikiPage: "2001–02 UEFA Cup" },
          { label: "2000–01", wikiPage: "2000–01 UEFA Cup" },
        ],
      },
      {
        id: "1990s",
        label: "90–91 till 99–00",
        seasons: [
          { label: "1999–00", wikiPage: "1999–2000 UEFA Cup" },
          { label: "1998–99", wikiPage: "1998–99 UEFA Cup" },
          { label: "1997–98", wikiPage: "1997–98 UEFA Cup" },
          { label: "1996–97", wikiPage: "1996–97 UEFA Cup" },
          { label: "1995–96", wikiPage: "1995–96 UEFA Cup" },
          { label: "1994–95", wikiPage: "1994–95 UEFA Cup" },
          { label: "1993–94", wikiPage: "1993–94 UEFA Cup" },
          { label: "1992–93", wikiPage: "1992–93 UEFA Cup" },
          { label: "1991–92", wikiPage: "1991–92 UEFA Cup" },
          { label: "1990–91", wikiPage: "1990–91 UEFA Cup" },
        ],
      },
      {
        id: "1980s",
        label: "80–81 till 89–90",
        seasons: [
          { label: "1989–90", wikiPage: "1989–90 UEFA Cup" },
          { label: "1988–89", wikiPage: "1988–89 UEFA Cup" },
          { label: "1987–88", wikiPage: "1987–88 UEFA Cup" },
          { label: "1986–87", wikiPage: "1986–87 UEFA Cup" },
          { label: "1985–86", wikiPage: "1985–86 UEFA Cup" },
          { label: "1984–85", wikiPage: "1984–85 UEFA Cup" },
          { label: "1983–84", wikiPage: "1983–84 UEFA Cup" },
          { label: "1982–83", wikiPage: "1982–83 UEFA Cup" },
          { label: "1981–82", wikiPage: "1981–82 UEFA Cup" },
          { label: "1980–81", wikiPage: "1980–81 UEFA Cup" },
        ],
      },
      {
        id: "1970s",
        label: "71–72 till 79–80",
        seasons: [
          { label: "1979–80", wikiPage: "1979–80 UEFA Cup" },
          { label: "1978–79", wikiPage: "1978–79 UEFA Cup" },
          { label: "1977–78", wikiPage: "1977–78 UEFA Cup" },
          { label: "1976–77", wikiPage: "1976–77 UEFA Cup" },
          { label: "1975–76", wikiPage: "1975–76 UEFA Cup" },
          { label: "1974–75", wikiPage: "1974–75 UEFA Cup" },
          { label: "1973–74", wikiPage: "1973–74 UEFA Cup" },
          { label: "1972–73", wikiPage: "1972–73 UEFA Cup" },
          { label: "1971–72", wikiPage: "1971–72 UEFA Cup" },
        ],
      },
    ];
  }

  if (slug === "conference-league") {
    return [
      {
        id: "2020s",
        label: "21–22 till 26–27",
        seasons: [
          { label: "2026–27", wikiPage: "2026–27 UEFA Conference League" },
          { label: "2025–26", wikiPage: "2025–26 UEFA Conference League" },
          { label: "2024–25", wikiPage: "2024–25 UEFA Conference League" },
          { label: "2023–24", wikiPage: "2023–24 UEFA Europa Conference League" },
          { label: "2022–23", wikiPage: "2022–23 UEFA Europa Conference League" },
          { label: "2021–22", wikiPage: "2021–22 UEFA Europa Conference League" },
        ],
      },
    ];
  }

  return [];
}

/** Tävlingar som har säsongsväljare. */
export const SEASON_COMPETITIONS = ["champions-league", "europa-league", "conference-league"];

/** Innevarande säsong ändras bara en gång per år, så den behöver kortare cache än historiken. */
export function isCurrentSeason(label: string, now = new Date()): boolean {
  const y = now.getUTCFullYear();
  const start = now.getUTCMonth() >= 6 ? y : y - 1;
  return label.startsWith(String(start));
}
