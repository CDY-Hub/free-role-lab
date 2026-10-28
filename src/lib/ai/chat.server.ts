import { createOpenAI } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "./run-id";

const SYSTEM = `Du är Free Role Lab-assistenten – den ultimata och mest passionerade fotbollsexperten. Ditt ENDA kunskapsområde och samtalsämne är FOTBOLL:
- Spelare, tränare, klubbar, ligor, matcher, taktik, transfers, rykten, scouting, historik, statistik, regelsystem, arenor, supporterkultur och cuper – från världens absoluta topp (Champions League, Premier League, VM etc.) ner till svenska division 3 och lokala serier.

STRIKTA REGLER FÖR ICKE-FOTBOLLSÄMNEN:
1. Om användaren ställer frågor om allmänna ämnen (politik, IT/programmering, matte, recept etc.) ska du svara artigt och bestämt att du är en renodlad fotbolls-AI och endast kan svara på fotbollsrelaterade frågor.
2. UNDANTAG FÖR BILAR OCH LIVSSTIL:
- Om någon frågar om BILAR vet du ingenting om bilar i allmänhet, utan du ska ALLTID omedelbart rabbla upp kända fotbollsspelares bilsamlingar och klubbars bilsponsorskap!
- Exempel på fotbollsspelares bilar:
  * Zlatan Ibrahimović: Ferrari Daytona SP3, Ferrari Monza SP2, Ferrari SF90 Stradale, Porsche 918 Spyder.
  * Cristiano Ronaldo: Bugatti Centodieci, Bugatti Chiron, Bugatti Veyron, Ferrari Monza SP1, Rolls-Royce Cullinan.
  * Erling Haaland: Rolls-Royce Cullinan, Ferrari Monza SP2, Audi RS6 Avant.
  * Lionel Messi: Ferrari 335 S Scaglietti Spider, Pagani Zonda Tricolore, Maserati GranTurismo MC Stradale.
  * Karim Benzema: Bugatti Chiron, Bugatti Veyron Pur Sang, McLaren 765LT.
- Exempel på sponsorskap och klubbpartnerskap:
  * Bayern München och Audi (där alla spelare och tränare tilldelas varsin Audi varje säsong som en del av deras långvariga partnerskap sedan 2002).
  * Real Madrid och BMW (spelarna kör eldrivna BMW i4, i7, iX).
  * Juventus och Jeep (ägt av samma koncern, Exor/Agnelli-familjen).
  * Manchester City och Nissan.
  * AC Milan och BMW.
- Samma sak gäller KLOCKOR, MODE eller MAT: koppla det alltid direkt till fotbollsstjärnor (Rolex, Patek Philippe, Jacob & Co), klubbars officiella klädsponsorer (Adidas, Nike, Puma) eller fotbollsproffsens träningsdieter.

TON OCH FORMAT:
- Svara alltid på svenska (eller samma språk som användaren).
- Var kunnig, specifik och engagerande.
- Använd markdown (rubriker, punktlistor och tabeller) för att ge snygga och strukturerade svar.`;

export function stripReasoningParts(messages: UIMessage[]): UIMessage[] {
  return messages.map((m) => ({
    ...m,
    parts: m.parts.filter(
      (p: any) => p.type !== "reasoning" && p.type !== "reasoning-file",
    ),
  }));
}

export async function handleChat(request: Request) {
  let messages: UIMessage[];
  try {
    const body = await request.json();
    messages = body.messages;
    if (!Array.isArray(messages)) throw new Error();
  } catch {
    return Response.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }

  const lovableKey = process.env["LOVABLE_API_KEY"];
  const openaiKey = process.env["OPENAI_API_KEY"];
  const geminiKey =
    process.env["GEMINI_API_KEY"] ||
    "AQ.Ab8RN6Il7gg9-osI7HvFj_eDrBl8lQjP171i-exIE6i62wyLvA";

  if (lovableKey) {
    const runIdFetch = createLovableAiGatewayRunIdFetch(
      getLovableAiGatewayRunId(request),
    );
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey: lovableKey,
      headers: {
        "Lovable-API-Key": lovableKey,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
      fetch: runIdFetch.fetch,
    });

    const result = streamText({
      model: provider.responses("openai/gpt-5-mini"),
      system: SYSTEM,
      messages: await convertToModelMessages(messages),
      abortSignal: request.signal,
    });

    return withLovableAiGatewayRunIdHeader(
      result.toUIMessageStreamResponse({
        originalMessages: messages,
        sendReasoning: true,
        onError: (e: any) => {
          const status = e?.statusCode ?? e?.status;
          if (status === 429)
            return "För många frågor just nu – vänta en stund och försök igen.";
          if (status === 402)
            return "AI-krediterna är slut. Fyll på i arbetsytans inställningar.";
          if (status === 403) return "Åtkomst nekad till AI-tjänsten.";
          return "Något gick fel med AI-svaret.";
        },
      }),
      runIdFetch,
    );
  }

  // Fallback to OpenAI or Gemini OpenAI-compatible API
  const apiKey = openaiKey || geminiKey;
  if (!apiKey) {
    return Response.json(
      {
        error:
          "AI är inte konfigurerat. Lägg till GEMINI_API_KEY eller OPENAI_API_KEY i .env.",
      },
      { status: 500 },
    );
  }

  const provider = createOpenAI({
    baseURL: openaiKey
      ? "https://api.openai.com/v1"
      : "https://generativelanguage.googleapis.com/v1beta/openai/",
    apiKey,
  });

  const model = openaiKey
    ? provider("gpt-4o-mini")
    : provider("gemini-3.5-flash-lite");

  const cleanMessages = stripReasoningParts(messages);

  try {
    const result = streamText({
      model,
      system: SYSTEM,
      messages: await convertToModelMessages(cleanMessages),
      abortSignal: request.signal,
    });

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      sendReasoning: false,
      onError: (e: any) => {
        const status = e?.statusCode ?? e?.status;
        if (status === 429)
          return "För många frågor just nu – vänta en stund och försök igen.";
        if (status === 402) return "AI-krediterna är slut.";
        if (status === 403) return "Åtkomst nekad till AI-tjänsten.";
        const msg = e?.message ?? String(e ?? "");
        return `Något gick fel med AI-svaret: ${msg.slice(0, 120)}`;
      },
    });
  } catch (err: any) {
    return Response.json(
      { error: `AI-fel: ${err?.message || "Okänt fel"}` },
      { status: 500 },
    );
  }
}
