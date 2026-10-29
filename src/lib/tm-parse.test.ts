import { describe, expect, it } from "vitest";
import {
  parseClubHeader,
  parseClubs,
  parseCoaches,
  parseMarketValue,
  parsePlayers,
  parseProfileHeader,
  pickWikiTitle,
  parseInfoTable,
  parseValuableClubs,
  parseValuablePlayers,
  positionGroup,
  resizeTmImage,
  trimWikiHtml,
} from "./tm-parse";

// Exempel-HTML som följer Transfermarkts struktur (rader sträcker sig över flera rader,
// spelare har en nästlad tabell med position, klubben visas som en liten vapenbild).
const PLAYER_ROWS = `
<table class="items">
<tbody>
<tr class="odd">
  <td>
    <table class="inline-table">
      <tr>
        <td rowspan="2">
          <img src="https://img.a.transfermarkt.technology/portrait/small/433177-1.jpg" title="Martin Ødegaard" alt="Martin Ødegaard" class="bilderrahmen-fixed" />
        </td>
        <td class="hauptlink">
          <a title="Martin Ødegaard" href="/martin-odegaard/profil/spieler/316264">Martin Ødegaard</a>
        </td>
      </tr>
      <tr>
        <td>Attacking Midfield</td>
      </tr>
    </table>
  </td>
  <td class="zentriert">26</td>
  <td class="zentriert"><img src="x.png" title="Norway" alt="Norway" class="flaggenrahmen" /></td>
  <td class="zentriert"><a title="Arsenal FC" href="/fc-arsenal/startseite/verein/11"><img src="w.png" class="tiny_wappen" /></a></td>
  <td class="rechts hauptlink">€90.00m</td>
</tr>
<tr class="even">
  <td>
    <table class="inline-table">
      <tr>
        <td rowspan="2">
          <img src="//img.a.transfermarkt.technology/portrait/small/9-1.jpg" class="bilderrahmen-fixed" />
        </td>
        <td class="hauptlink">
          <a href="/viktor-gyokeres/profil/spieler/433177" title="Viktor Gyökeres">Viktor Gy&ouml;keres</a>
        </td>
      </tr>
      <tr>
        <td>Centre-Forward</td>
      </tr>
    </table>
  </td>
  <td class="zentriert">27</td>
  <td class="zentriert"><img src="x.png" title="Sweden" class="flaggenrahmen" /></td>
  <td class="rechts hauptlink">€800k</td>
</tr>
</tbody>
</table>`;

const CLUB_ROWS = `
<table class="items">
<tr class="odd">
  <td class="zentriert suche-vereinswappen">
    <a href="/fc-arsenal/startseite/verein/11"><img src="https://tmssl.akamaized.net/images/wappen/tiny/11.png" /></a>
  </td>
  <td class="hauptlink">
    <a title="Arsenal FC" href="/fc-arsenal/startseite/verein/11">Arsenal FC</a>
  </td>
  <td class="zentriert"><img src="x.png" title="England" class="flaggenrahmen" /></td>
  <td class="zentriert">31</td>
  <td class="rechts">€1.20bn</td>
</tr>
</table>`;

const COACH_ROWS = `
<tr>
  <td><img src="https://img.a.transfermarkt.technology/portrait/small/1-1.jpg" class="bilderrahmen-fixed" /></td>
  <td class="hauptlink"><a title="Mikel Arteta" href="/mikel-arteta/profil/trainer/47620">Mikel Arteta</a></td>
</tr>`;

describe("parsePlayers", () => {
  const players = parsePlayers(PLAYER_ROWS);

  it("hittar alla spelare även när raderna är flerradiga", () => {
    expect(players.map((p) => p.id)).toEqual(["316264", "433177"]);
  });

  it("läser namn, position, ålder, marknadsvärde, klubb och land", () => {
    expect(players[0]).toMatchObject({
      name: "Martin Ødegaard",
      position: "Attacking Midfield",
      age: 26,
      marketValue: 90_000_000,
      club: { id: "11", name: "Arsenal FC" },
      nationalities: ["Norway"],
    });
  });

  it("avkodar HTML-entiteter och hanterar attribut i annan ordning", () => {
    expect(players[1]?.name).toBe("Viktor Gyökeres");
    expect(players[1]?.marketValue).toBe(800_000);
    expect(players[1]?.position).toBe("Centre-Forward");
  });

  it("hittar porträttbilden och gör protokollrelativa URL:er absoluta", () => {
    expect(players[0]?.imageUrl).toContain("433177-1.jpg");
    expect(players[1]?.imageUrl?.startsWith("https://")).toBe(true);
  });

  it("returnerar tom lista för HTML utan spelare", () => {
    expect(parsePlayers("<html><body>Inget här</body></html>")).toEqual([]);
  });
});

describe("parseClubs", () => {
  it("läser lag med land, trupp och värde, och blandar inte ihop klubbikoner i spelarrader", () => {
    const clubs = parseClubs(CLUB_ROWS);
    expect(clubs).toHaveLength(1);
    expect(clubs[0]).toMatchObject({
      id: "11",
      name: "Arsenal FC",
      country: "England",
      squadSize: 31,
    });
    expect(clubs[0]?.imageUrl).toContain("wappen");
    // Klubbikonen i en spelarrad är ingen lagträff
    expect(parseClubs(PLAYER_ROWS)).toEqual([]);
  });
});

describe("parseCoaches", () => {
  it("läser tränare med bild", () => {
    const coaches = parseCoaches(COACH_ROWS);
    expect(coaches).toEqual([
      {
        id: "47620",
        name: "Mikel Arteta",
        imageUrl: "https://img.a.transfermarkt.technology/portrait/small/1-1.jpg",
      },
    ]);
  });
});

describe("parseMarketValue", () => {
  it.each([
    ["€150.00m", 150_000_000],
    ["€800k", 800_000],
    ["€1.20bn", 1_200_000_000],
    ["€500 Th.", 500_000],
    // Så skriver Transfermarkt i sina rankinglistor.
    ["€1.5B", 1_500_000_000],
    ["€929M", 929_000_000],
    ["€220M", 220_000_000],
  ])("tolkar %s", (input, expected) => {
    expect(parseMarketValue(input)).toBe(expected);
  });

  it("ger undefined för streck och tomt", () => {
    expect(parseMarketValue("-")).toBeUndefined();
    expect(parseMarketValue(undefined)).toBeUndefined();
  });
});

describe("positionGroup", () => {
  it.each([
    ["Goalkeeper", "Målvakter"],
    ["Centre-Back", "Försvarare"],
    ["Central Midfield", "Mittfältare"],
    ["Left Winger", "Anfallare"],
    ["Centre-Forward", "Anfallare"],
    [undefined, "Övriga"],
  ])("%s -> %s", (pos, group) => {
    expect(positionGroup(pos)).toBe(group);
  });
});

const PROFILE = `
<header class="data-header">
  <div class="data-header__profile-container">
    <img src="https://img.a.transfermarkt.technology/portrait/header/433177-1.jpg" class="data-header__profile-image" title="Viktor Gyökeres" />
  </div>
  <h1 class="data-header__headline-wrapper data-header__headline-wrapper--oswald">
    <span class="data-header__shirt-number">
      #9
    </span>
    Viktor <strong>Gy&ouml;keres</strong>
  </h1>
  <span class="data-header__club">
    <a href="/fc-arsenal/startseite/verein/11">Arsenal FC</a>
  </span>
  <a class="data-header__market-value-wrapper" href="/x/marktwertverlauf/spieler/433177">
    €60.00m <span class="waehrung">Last update: Oct 1, 2026</span>
  </a>
</header>
<div class="info-table info-table--right-space">
  <span class="info-table__content info-table__content--regular">Date of birth/Age:</span>
  <span class="info-table__content info-table__content--bold">
    <a href="/x">Jun 4, 1998</a> (28)
  </span>
  <span class="info-table__content info-table__content--regular">Height:</span>
  <span class="info-table__content info-table__content--bold">1,87&nbsp;m</span>
  <span class="info-table__content info-table__content--regular">Citizenship:</span>
  <span class="info-table__content info-table__content--bold">
    <img src="a.png" title="Sweden" class="flaggenrahmen" /> Sweden
  </span>
  <span class="info-table__content info-table__content--regular">Position:</span>
  <span class="info-table__content info-table__content--bold">Attack - Centre-Forward</span>
</div>`;

describe("parseProfileHeader", () => {
  const h = parseProfileHeader(PROFILE);

  it("läser namn utan tröjnummer, bild, värde och klubb", () => {
    expect(h.name).toBe("Viktor Gyökeres");
    expect(h.shirtNumber).toBe("9");
    expect(h.imageUrl).toContain("433177-1.jpg");
    expect(h.marketValue).toBe(60_000_000);
    expect(h.club).toEqual({ id: "11", name: "Arsenal FC" });
  });

  it("läser faktarutan", () => {
    expect(h.info["Height"]?.text).toContain("1,87");
    expect(h.info["Citizenship"]?.flags).toEqual(["Sweden"]);
    expect(h.info["Position"]?.text).toBe("Attack - Centre-Forward");
    expect(h.info["Date of birth/Age"]?.text).toContain("(28)");
  });

  it("faller tillbaka på <title> när h1 saknas", () => {
    expect(
      parseProfileHeader("<title>Arsenal FC - Club profile | Transfermarkt</title>").name,
    ).toBe("Arsenal FC");
  });
});

describe("parseClubHeader", () => {
  it("läser klubbnamn", () => {
    const html = `<h1 class="data-header__headline-wrapper">Arsenal FC</h1><img class="data-header__profile-image" src="https://tmssl.akamaized.net/images/wappen/head/11.png">`;
    const c = parseClubHeader(html);
    expect(c.name).toBe("Arsenal FC");
    expect(c.imageUrl).toContain("wappen");
  });
});

describe("trimWikiHtml", () => {
  it("klipper bort referenser och externa länkar men behåller historiken", () => {
    const html = `<p>History</p><div class="mw-heading mw-heading2"><h2 id="Honours">Honours</h2></div><p>Titles</p><div class="mw-heading mw-heading2"><h2 id="References">References</h2></div><p>refs</p>`;
    const out = trimWikiHtml(html);
    expect(out).toContain("Titles");
    expect(out).not.toContain("refs");
  });
});

describe("pickWikiTitle", () => {
  it("väljer klubbartikeln och inte säsongs- eller listsidor", () => {
    const hits = [
      { title: "2025–26 Arsenal F.C. season", snippet: "football season" },
      { title: "Arsenal F.C.", snippet: "English professional <b>football</b> club" },
      { title: "Arsenal (disambiguation)", snippet: "Arsenal may refer to" },
    ];
    expect(pickWikiTitle("Arsenal", hits)).toBe("Arsenal F.C.");
  });

  it("returnerar null när inget är säkert", () => {
    expect(pickWikiTitle("Zzzz", [{ title: "Banana", snippet: "fruit" }])).toBeNull();
  });
});

// Radstrukturen är kopierad från Transfermarkts riktiga sidor
// (marktwertetop/wertvollstemannschaften och marktwerte/wertvollstespieler/marktwertetop).
describe("parseValuableClubs", () => {
  const row = (
    cls: "odd" | "even",
    rank: number,
    slug: string,
    id: number,
    name: string,
    flagId: number,
    country: string,
    lgId: string,
    lg: string,
    value: string,
  ) => `<tr class="${cls}">
<td class="zentriert">${rank}</td><td class="zentriert no-border-rechts"><a title="${name}" href="/${slug}/startseite/verein/${id}/saison_id/2026"><img src="https://img.a.transfermarkt.technology/wappen/tiny/${id}.png?lm=1789459190" title="${name}" alt="${name}" class="tiny_wappen" /></a></td><td class="no-border-links hauptlink"><a title="${name}" href="/${slug}/startseite/verein/${id}">${name}</a></td><td class="links"><img src="https://img.a.transfermarkt.technology/flagge/tiny/157.png?lm=1791356396" title="${country}" alt="${country}" class="flaggenrahmen" /> <a title="${lg}" href="/wettbewerb/startseite/wettbewerb/${lgId}">${lg}</a></td><td class="rechts"><b>${value}</b><span class="icons_sprite green-arrow-ten">&nbsp;</span></td></tr>`;

  // Sidan har fler listor före huvudtabellen (sidofält). Bara tabellen "items" ska läsas.
  const sidebar = `<div class="box"><a title="Sidofält" href="/sidofalt-fc/startseite/verein/9999">Sidofält FC</a> €9.9B</div>`;

  const html = `${sidebar}<table class="items"><thead>
<tr>
<th class="zentriert" id="yw1_c0">#</th><th class="zentriert no-border-rechts" id="yw1_c1"></th><th class="no-border-links" id="yw1_c2">Club</th><th class="links" id="yw1_c3">Competition</th><th class="rechts" id="yw1_c4">Market Value</th></tr>
</thead>
<tbody>
${row("odd", 1, "real-madrid", 418, "Real Madrid", 157, "Spain", "ES1", "LaLiga", "€1.5B")}
${row("even", 2, "manchester-city", 281, "Manchester City", 189, "England", "GB1", "Premier League", "€1.5B")}
${row("odd", 3, "fc-arsenal", 11, "Arsenal FC", 189, "England", "GB1", "Premier League", "€1.4B")}
${row("even", 9, "manchester-united", 985, "Manchester United", 189, "England", "GB1", "Premier League", "€929M")}
${row("odd", 14, "brighton-amp-hove-albion", 1237, "Brighton &amp; Hove Albion", 189, "England", "GB1", "Premier League", "€700M")}
</tbody></table>`;

  it("keeps Transfermarkts own order, even when clubs share the same rounded value", () => {
    const clubs = parseValuableClubs(html);
    expect(clubs.map((c) => c.name)).toEqual([
      "Real Madrid",
      "Manchester City",
      "Arsenal FC",
      "Manchester United",
      "Brighton & Hove Albion",
    ]);
    expect(clubs.map((c) => c.rank)).toEqual([1, 2, 3, 9, 14]);
  });

  it("reads billions (B) and millions (M) so the biggest clubs are not mistaken for tiny ones", () => {
    const byId = (id: string) => parseValuableClubs(html).find((c) => c.id === id);
    expect(byId("418")?.marketValue).toBe(1_500_000_000);
    expect(byId("11")?.marketValue).toBe(1_400_000_000);
    expect(byId("985")?.marketValue).toBe(929_000_000);
  });

  it("reads competition and country, and ignores the sidebar", () => {
    const clubs = parseValuableClubs(html);
    expect(clubs[0]?.league).toEqual({ id: "ES1", name: "LaLiga" });
    expect(clubs[0]?.country).toBe("Spain");
    expect(clubs.some((c) => c.id === "9999")).toBe(false);
  });

  it("uses the large crest instead of the 15 px icon from the list", () => {
    const real = parseValuableClubs(html).find((c) => c.id === "418");
    expect(real?.imageUrl).toBe(
      "https://img.a.transfermarkt.technology/wappen/big/418.png?lm=1789459190",
    );
    expect(real?.imageUrl).not.toContain("/tiny/");
  });

  it("ignores header rows and de-duplicates", () => {
    const dup = html.replace(
      "</tbody>",
      `${row("odd", 30, "real-madrid", 418, "Real Madrid", 157, "Spain", "ES1", "LaLiga", "€1B")}</tbody>`,
    );
    expect(parseValuableClubs(dup)).toHaveLength(5);
    expect(parseValuableClubs('<table class="items"><tr><th>#</th></tr></table>')).toEqual([]);
    expect(parseValuableClubs("")).toEqual([]);
  });
});

describe("parseValuablePlayers", () => {
  const row = (
    cls: "odd" | "even",
    rank: number,
    slug: string,
    id: number,
    name: string,
    position: string,
    age: number,
    flagId: number,
    country: string,
    clubSlug: string,
    clubId: number,
    club: string,
    value: string,
  ) => `<tr class="${cls}">
<td class="zentriert">${rank}</td><td class=""><table class="inline-table"><tr><td rowspan="2"><a href="#"><img src="https://img.a.transfermarkt.technology/portrait/small/${id}-1773173768.jpg?lm=4711" title="${name}" alt="${name}" class="bilderrahmen-fixed" /></a></td><td class="hauptlink"><a title="${name}" href="/${slug}/profil/spieler/${id}">${name}</a></td></tr><tr><td>${position}</td></tr></table></td><td class="zentriert">${age}</td><td class="zentriert"><img src="https://img.a.transfermarkt.technology/flagge/verysmall/${flagId}.png?lm=1791356396" title="${country}" alt="${country}" class="flaggenrahmen" /></td><td class="zentriert"><a title="${club}" href="/${clubSlug}/startseite/verein/${clubId}"><img src="https://img.a.transfermarkt.technology/wappen/verysmall/${clubId}.png?lm=1789459175" title="${club}" alt="${club}" class="" /></a></td><td class="rechts hauptlink"><a href="/${slug}/marktwertverlauf/spieler/${id}">${value}</a>&nbsp;</td></tr>`;

  const html = `<div class="box"><a title="Sidofält" href="/sidofalt/profil/spieler/9999">Sidofält Spelare</a></div><table class="items"><thead><tr><th>#</th><th>Player</th></tr></thead><tbody>
${row("odd", 1, "lamine-yamal", 937958, "Lamine Yamal", "Right Winger", 19, 157, "Spain", "fc-barcelona", 131, "FC Barcelona", "€220M")}
${row("even", 1, "erling-haaland", 418560, "Erling Haaland", "Centre-Forward", 26, 125, "Norway", "manchester-city", 281, "Manchester City", "€220M")}
${row("odd", 3, "kylian-mbappe", 342229, "Kylian Mbapp&eacute;", "Centre-Forward", 27, 50, "France", "real-madrid", 418, "Real Madrid", "€200M")}
${row("even", 4, "michael-olise", 735136, "Michael Olise", "Right Winger", 24, 50, "France", "fc-bayern-munchen", 27, "FC Bayern Munich", "€180M")}
</tbody></table>`;

  it("keeps Transfermarkts order and shared places (1, 1, 3, 4)", () => {
    const players = parseValuablePlayers(html);
    expect(players.map((p) => p.name)).toEqual([
      "Lamine Yamal",
      "Erling Haaland",
      "Kylian Mbappé",
      "Michael Olise",
    ]);
    expect(players.map((p) => p.rank)).toEqual([1, 1, 3, 4]);
  });

  it("reads value, position, age, club and nationality", () => {
    const [yamal] = parseValuablePlayers(html);
    expect(yamal).toMatchObject({
      id: "937958",
      position: "Right Winger",
      age: 19,
      marketValue: 220_000_000,
      club: { id: "131", name: "FC Barcelona" },
      nationalities: ["Spain"],
    });
  });

  it("uses the larger portrait instead of the 28x36 px thumbnail", () => {
    const [yamal] = parseValuablePlayers(html);
    expect(yamal?.imageUrl).toBe(
      "https://img.a.transfermarkt.technology/portrait/header/937958-1773173768.jpg?lm=4711",
    );
  });

  it("ignores the sidebar and returns nothing for an empty page", () => {
    expect(parseValuablePlayers(html).some((p) => p.id === "9999")).toBe(false);
    expect(parseValuablePlayers("")).toEqual([]);
  });
});

describe("resizeTmImage", () => {
  it("swaps the size segment and keeps the rest of the address", () => {
    expect(
      resizeTmImage(
        "https://img.a.transfermarkt.technology/wappen/tiny/418.png?lm=1",
        "wappen",
        "big",
      ),
    ).toBe("https://img.a.transfermarkt.technology/wappen/big/418.png?lm=1");
    expect(
      resizeTmImage(
        "https://img.a.transfermarkt.technology/portrait/small/1-2.jpg",
        "portrait",
        "header",
      ),
    ).toBe("https://img.a.transfermarkt.technology/portrait/header/1-2.jpg");
  });

  it("leaves other addresses and missing values alone", () => {
    expect(resizeTmImage(undefined, "wappen", "big")).toBeUndefined();
    expect(resizeTmImage("https://example.test/x.png", "wappen", "big")).toBe(
      "https://example.test/x.png",
    );
  });
});

describe("parseInfoTable", () => {
  const html = `
  <span class="info-table__content info-table__content--regular">Citizenship:</span>
  <span class="info-table__content info-table__content--bold"><img src="https://img.a.transfermarkt.technology/flagge/verysmall/145.png" title="Sweden" alt="Sweden" class="flaggenrahmen"> Sweden</span>
  <span class="info-table__content info-table__content--regular">Position:</span>
  <span class="info-table__content info-table__content--bold">Attack - Centre-Forward</span>
  <span class="info-table__content info-table__content--regular">Foot:</span>
  <span class="info-table__content info-table__content--bold">right</span>`;

  it("does not leak half a tag from the next label into the previous value", () => {
    const info = parseInfoTable(html);
    expect(info["Citizenship"]?.text).toBe("Sweden");
    expect(info["Citizenship"]?.flags).toEqual(["Sweden"]);
    expect(info["Position"]?.text).toBe("Attack - Centre-Forward");
    expect(info["Foot"]?.text).toBe("right");
    for (const v of Object.values(info)) expect(v.text).not.toMatch(/[<>]|info-table/);
  });
});
