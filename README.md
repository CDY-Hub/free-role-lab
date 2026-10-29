# Free Role Lab

En fotbollsplattform som kombinerar liveresultat, spelar- och tränardata och en AI-assistent. Tänk Forza Fotboll/Flashscore, Transfermarkt och Football Manager-scouting i ett, med fokus på de fem stora ligorna, Allsvenskan, Portugal, Nederländerna samt UEFA- och FIFA-turneringar.

**Live-demo:** https://pitch-brain-hub.vercel.app

<!-- Lägg en skärmbild i docs/screenshot.png och ta bort kommentaren runt raden nedan:
![Skärmbild av Free Role Lab](docs/screenshot.png)
-->

> **Status:** tidigt skede. Projektet är under aktiv utveckling och inte färdigt. Det är ett lärprojekt för att öva på moderna webbverktyg, API-integrationer, generativ AI och driftsättning. Demon kan vara ofullständig eller ändras.

## Vision och funktioner

Det här är målbilden. Delar av den är byggda, resten är på vägen.

- **Matcher och liveresultat** från flera källor som kompletterar varandra: ESPN (nyckelfri) för de fem stora ligorna, Allsvenskan, Championship, 2. Bundesliga, LaLiga Hypermotion, Serie B, Ligue 2, Portugal, Nederländerna, Belgien, Skottland, Österrike och Grekland samt cuper, UEFA och FIFA. OpenLigaDB (öppet) för 3. Liga. API-Football för Ekstraklasa, schweiziska Super League och irländska Premier Division, som ESPN saknar. Sidan säger tydligt när en liga saknas för att en källa inte svarar.
- **Sök på spelare och tränare** via Transfermarkt. Spelarsidan ska visa tidigare matcher och prestationer. Tränarsidan ska visa klubbar och bakgrund, inklusive tidigare spelarkarriär.
- **Tabeller och ligor**: Premier League, LaLiga, Bundesliga, Serie A, Ligue 1, Allsvenskan, Liga Portugal och Eredivisie. Lägre divisioner ingår medvetet inte.
- **FIFA och UEFA**: VM-översikt och historik för Champions League, Europa League med flera.
- **AI-chatt som bara svarar på fotboll.** Frågor utanför fotboll avvisas. Chatten drivs av Gemini (OpenAI eller Lovables AI-gateway kan användas som alternativ).
- **Ljust och mörkt läge** med blå accentfärg.

## Teknik

| Område        | Val                                                                       |
| ------------- | ------------------------------------------------------------------------- |
| Ramverk       | TanStack Start (React 19, TanStack Router), Vite, TypeScript              |
| UI            | Tailwind CSS 4, shadcn/ui                                                 |
| Data          | API-Football v3, football-data.org (alternativ), Transfermarkt, Wikipedia |
| AI            | Vercel AI SDK med Google Gemini (OpenAI som alternativ)                   |
| Kvalitet      | Vitest, ESLint, Prettier, GitHub Actions                                  |
| Paket         | npm (Bun fungerar också)                                                  |
| Driftsättning | Vercel                                                                    |
| Utveckling    | Lovable med AI-stödd kodgenerering                                        |

## Så här fungerar arbetet

Projektet är byggt med AI-stödd utveckling i Lovable. Jag formulerar kraven, granskar den genererade koden, felsöker och styr arkitekturen. Hemligheter ligger aldrig i repot utan hanteras som miljövariabler hos driftsättningen.

## Kom igång lokalt

Krav: Node 20 eller senare.

```bash
git clone https://github.com/CDY-Hub/free-role-lab.git
cd free-role-lab
npm install
cp .env.example .env   # fyll i egna nycklar
npm run dev
```

Appen kraschar inte om en nyckel saknas: matchsidan visar en setup-guide och chatten svarar att AI inte är konfigurerat.

### Skript

| Kommando                | Gör                         |
| ----------------------- | --------------------------- |
| `npm run dev`           | Startar utvecklingsservern  |
| `npm run build`         | Produktionsbygge            |
| `npm run lint`          | ESLint                      |
| `npm run typecheck`     | TypeScript-kontroll         |
| `npm test`              | Kör testerna                |
| `npm run test:coverage` | Tester med täckningsrapport |
| `npm run format`        | Formaterar med Prettier     |

## Miljövariabler

Kopiera `.env.example` till `.env` och fyll i dina egna värden. Checka aldrig in `.env`.

| Variabel              | Används till                                   |
| --------------------- | ---------------------------------------------- |
| `API_FOOTBALL_KEY`    | Liveresultat och matchdata (API-Football)      |
| `FOOTBALL_DATA_TOKEN` | Alternativ datakälla (football-data.org)       |
| `LIVESCORE_API_URL`   | Egen livescore-server (valfritt)               |
| `GEMINI_API_KEY`      | AI-chatten (Gemini)                            |
| `GEMINI_MODEL`        | Valfritt: välj Gemini-modell                   |
| `OPENAI_API_KEY`      | AI-chatten, alternativ leverantör              |
| `LOVABLE_API_KEY`     | Lovables AI-gateway (valfritt)                 |
| `NITRO_PRESET`        | Sätt till `vercel` vid driftsättning på Vercel |

AI-leverantör väljs i ordningen `LOVABLE_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`.

## Driftsättning på Vercel

1. Importera repot i Vercel.
2. Lägg in miljövariablerna ovan, inklusive `NITRO_PRESET=vercel` (utan den byggs appen för Cloudflare).
3. Deploya. Alla `main`-pushar bygger om automatiskt.

## Roadmap

Se [roadmap.md](roadmap.md) för vad som är klart. Kvar att göra:

- [ ] Fler divisioner (pausat: fokus ligger på de åtta ligorna ovan)
- [ ] Transferdata och trupphantering
- [ ] Fördjupade spelarprofiler med matchhistorik
- [ ] Mer testtäckning
- [ ] Cachelagring av matchdata för att spara API-anrop

## Bidra

Se [CONTRIBUTING.md](CONTRIBUTING.md).

## Licens

MIT, se [LICENSE](LICENSE).

## Kontakt

Christian D'Amico Yachouh, Junior DevOps & Systemadministratör
https://github.com/CDY-Hub · christian.damicoyachouh@gmail.com
