import { describe, expect, it } from "vitest";
import {
  parseClubs,
  parseCoaches,
  parseMarketValue,
  parsePlayers,
  positionGroup,
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
