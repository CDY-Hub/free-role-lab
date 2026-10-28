# Contributing till Free Role Lab

Tack för att du vill bidra! Här är hur du kommer igång.

## Utvecklingsmiljö

Krav: Node 20 eller senare.

```bash
git clone https://github.com/CDY-Hub/free-role-lab.git
cd free-role-lab
npm ci
cp .env.example .env   # fyll i egna nycklar
npm run dev
```

## Innan du öppnar en pull request

Kör samma kontroller som CI:

```bash
npm run format      # formatera med Prettier
npm run lint        # ESLint
npm run typecheck   # TypeScript
npm test            # Vitest
npm run build       # produktionsbygge
```

## Riktlinjer

- Skapa en gren från `main` (`feature/...` eller `fix/...`) och öppna en PR mot `main`.
- Håll PR:er små och fokuserade, och lägg till tester för ny logik.
- Lägg aldrig API-nycklar eller andra hemligheter i koden eller i git. Använd miljövariabler.
- Anrop till externa API:er går via serverfunktioner (`*.functions.ts`, `*.server.ts`), inte från webbläsaren.
- Filen `src/routeTree.gen.ts` genereras automatiskt och ska inte redigeras för hand.
- Skriv commit-meddelanden som beskriver vad som ändrats och varför.

## Rapportera problem

Öppna ett issue på GitHub med steg för att återskapa felet. Rapportera aldrig säkerhetsproblem (t.ex. läckta nycklar) offentligt, kontakta ägaren direkt.
