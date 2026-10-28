import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
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

const MAX_MESSAGES = 40; // äldre meddelanden klipps bort innan de skickas till modellen
const MAX_TEXT_CHARS = 4000; // max tecken per användarmeddelande
const RATE_LIMIT_MAX = 20; // max anrop per fönster och IP
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

/**
 * Enkel rate limiter i minnet. På serverless gäller den per instans, så den
 * är ett grundskydd mot missbruk – inte en garanti. Byt mot t.ex. Upstash
 * Redis om du behöver en riktig gräns.
 */
export function createRateLimiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return function isAllowed(key: string, now: number = Date.now()): boolean {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) {
      for (const [k, v] of hits) {
        if (v.every((t) => now - t >= windowMs)) hits.delete(k);
      }
    }
    return true;
  };
}

const isAllowed = createRateLimiter(RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

function statusOf(e: unknown): number | undefined {
  if (e && typeof e === "object") {
    const o = e as { statusCode?: unknown; status?: unknown };
    const s = o.statusCode ?? o.status;
    return typeof s === "number" ? s : undefined;
  }
  return undefined;
}

function messageOf(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e ?? "");
}

function hasTooLongText(messages: UIMessage[]): boolean {
  return messages.some(
    (m) =>
      m.role === "user" &&
      m.parts.some(
        (p) => p.type === "text" && (p as { text: string }).text.length > MAX_TEXT_CHARS,
      ),
  );
}

export function stripReasoningParts(messages: UIMessage[]): UIMessage[] {
  return messages.map((m) => ({
    ...m,
    parts: m.parts.filter(
      (p: { type: string }) => p.type !== "reasoning" && p.type !== "reasoning-file",
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

  if (messages.length === 0) {
    return Response.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }
  if (hasTooLongText(messages)) {
    return Response.json(
      { error: `Meddelandet är för långt (max ${MAX_TEXT_CHARS} tecken).` },
      { status: 413 },
    );
  }
  if (!isAllowed(clientKey(request))) {
    return Response.json(
      { error: "För många frågor just nu – vänta en stund och försök igen." },
      { status: 429 },
    );
  }
  messages = messages.slice(-MAX_MESSAGES);

  const lovableKey = process.env["LOVABLE_API_KEY"];
  const openaiKey = process.env["OPENAI_API_KEY"];
  // Ingen inbyggd reservnyckel: nycklar ska bara komma från miljövariabler.
  const geminiKey = process.env["GEMINI_API_KEY"];

  if (lovableKey) {
    const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
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
        onError: (e: unknown) => {
          const status = statusOf(e);
          if (status === 429) return "För många frågor just nu – vänta en stund och försök igen.";
          if (status === 402) return "AI-krediterna är slut. Fyll på i arbetsytans inställningar.";
          if (status === 403) return "Åtkomst nekad till AI-tjänsten.";
          return "Något gick fel med AI-svaret.";
        },
      }),
      runIdFetch,
    );
  }

  // Reserv: OpenAI eller Gemini via OpenAI-kompatibelt API
  const apiKey = openaiKey || geminiKey;
  if (!apiKey) {
    return Response.json(
      {
        error: "AI är inte konfigurerat. Lägg till GEMINI_API_KEY eller OPENAI_API_KEY i .env.",
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

  const geminiModel = process.env["GEMINI_MODEL"] || "gemini-3.5-flash-lite";
  const model = openaiKey ? provider("gpt-4o-mini") : provider(geminiModel);

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
      onError: (e: unknown) => {
        const status = statusOf(e);
        if (status === 429) return "För många frågor just nu – vänta en stund och försök igen.";
        if (status === 402) return "AI-krediterna är slut.";
        if (status === 403) return "Åtkomst nekad till AI-tjänsten.";
        // Läck inte interna felmeddelanden till användaren.
        console.error("AI-fel:", messageOf(e));
        return "Något gick fel med AI-svaret.";
      },
    });
  } catch (err: unknown) {
    console.error("AI-fel:", messageOf(err));
    return Response.json({ error: "Något gick fel med AI-svaret." }, { status: 500 });
  }
}
