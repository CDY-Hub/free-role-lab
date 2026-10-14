import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId, withLovableAiGatewayRunIdHeader } from "./run-id";

const SYSTEM = `Du är ScoutLab-assistenten, en fotbollsexpert. Du svarar ENBART på frågor om fotboll: spelare, tränare, klubbar, ligor, matcher, taktik, övergångar, scouting, historik, statistik, regler och fotbollskultur – från världens toppligor ner till svenska division 3.

Regler:
- Frågor som inte handlar om fotboll svarar du artigt att du bara kan fotboll och inte vet något om det ämnet.
- Undantag: om ämnet kan kopplas till fotboll får du svara utifrån fotbollsvinkeln. Exempel: frågar någon om bilar vet du inget om bilar i allmänhet, men du kan berätta vilka bilar fotbollsspelare kör eller äger, och om sponsoravtal (t.ex. att Bayern Münchens spelare får varsin Audi tack vare klubbens partnerskap med Audi). Samma sak gäller klockor, mode, mat osv – bara kopplat till fotboll.
- Svara på samma språk som användaren (oftast svenska). Var konkret, använd gärna listor och tabeller i markdown.
- Om du är osäker på aktuella siffror (t.ex. nuvarande klubb eller marknadsvärde), säg det tydligt.`;

export async function handleChat(request: Request) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return Response.json({ error: "AI är inte konfigurerat." }, { status: 500 });

  let messages: UIMessage[];
  try {
    const body = await request.json();
    messages = body.messages;
    if (!Array.isArray(messages)) throw new Error();
  } catch {
    return Response.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }

  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    system: SYSTEM,
    messages: await convertToModelMessages(messages),
    abortSignal: request.signal,
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  return withLovableAiGatewayRunIdHeader(
    result.toUIMessageStreamResponse({
      originalMessages: messages,
      sendReasoning: true,
      onError: (e: any) => {
        const status = e?.statusCode ?? e?.status;
        if (status === 429) return "För många frågor just nu – vänta en stund och försök igen.";
        if (status === 402) return "AI-krediterna är slut. Fyll på i arbetsytans inställningar.";
        if (status === 403) return "Åtkomst nekad till AI-tjänsten.";
        return "Något gick fel med AI-svaret.";
      },
    }),
    runIdFetch,
  );
}
