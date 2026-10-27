Free Role Lab

En fotbollsplattform som kombinerar liveresultat, spelar- och tränardata och en AI-assistent. Tänk Forza Fotboll/Flashscore, Transfermarkt och Football Manager-scouting i ett, med målet att även täcka lägre svenska divisioner.

Live-demo: https://pitch-brain-hub.vercel.app

Skärmbild av Free Role Lab

Status: tidigt skede. Projektet är under aktiv utveckling och inte färdigt. Det är ett lärprojekt för att öva på moderna webbverktyg, API-integrationer, generativ AI och driftsättning. Demon kan vara ofullständig eller ändras.

Vision och funktioner

Det här är målbilden. Delar av den är byggda, resten är på vägen.

Liveresultat från API-Football: Top 5-ligorna, cuper, Champions League och Allsvenskan.
Sök på spelare och tränare. Spelarsidan ska visa tidigare matcher och prestationer. Tränarsidan ska visa klubbar och bakgrund, inklusive tidigare spelarkarriär.
AI-chatt som bara svarar på fotboll. Frågor utanför fotboll avvisas. Chatten drivs av Gemini (OpenAI kan användas som alternativ).
Ljust och mörkt läge med blå accentfärg.
Teknik
Område	Val
Frontend	Vite, TypeScript, shadcn/ui
Data	API-Football v3, football-data.org (alternativ)
AI	Google Gemini API
Kvalitet	Vitest, ESLint, Prettier
Paket	Bun / npm
Driftsättning	Vercel
Utveckling	Lovable med AI-stödd kodgenerering
Så här fungerar arbetet

Projektet är byggt med AI-stödd utveckling i Lovable. Jag formulerar kraven, granskar den genererade koden, felsöker och styr arkitekturen. Hemligheter ligger aldrig i repot utan hanteras som miljövariabler hos driftsättningen.

Kom igång lokalt
bash
git clone <repo-url>
cd <repo-mappen>
npm install
cp .env.example .env   # fyll i egna nycklar
npm run dev
Miljövariabler

Kopiera .env.example till .env och fyll i dina egna värden. Checka aldrig in .env.

Variabel	Används till
API_FOOTBALL_KEY	Liveresultat och matchdata (API-Football)
FOOTBALL_DATA_TOKEN	Alternativ datakälla (football-data.org)
LIVESCORE_API_URL	Egen livescore-server (valfritt)
GEMINI_API_KEY	AI-chatten (Gemini)
OPENAI_API_KEY	AI-chatten, alternativ leverantör
LOVABLE_API_KEY	Lovables AI-gateway (valfritt)
Roadmap
Fler divisioner, bland annat svenska division 1–3
Transferdata och trupphantering
Fördjupade spelarprofiler med matchhistorik
Mer testtäckning och en automatiserad pipeline med GitHub Actions
Kontakt

Christian D'Amico Yachouh, Junior DevOps & Systemadministratör https://github.com/CDY-Hub · christian.damicoyachouh@gmail.com
