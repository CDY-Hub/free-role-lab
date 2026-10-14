import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import logo from "@/assets/scout-logo.png";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { ensureThread, loadThreads, updateThread, deleteThread, newId, type Thread } from "@/lib/threads";

export const Route = createFileRoute("/chat/$threadId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "AI-chatt om fotboll – ScoutLab" },
      { name: "description", content: "Fråga vad som helst om fotboll – spelare, tränare, taktik och mer." },
      { property: "og:title", content: "AI-chatt om fotboll – ScoutLab" },
      { property: "og:description", content: "Fråga vad som helst om fotboll – spelare, tränare, taktik och mer." },
    ],
  }),
  component: ChatPage,
});

function useThreads() {
  const [threads, setThreads] = useState<Thread[]>(() => loadThreads());
  useEffect(() => {
    const h = () => setThreads(loadThreads());
    window.addEventListener("threads-changed", h);
    return () => window.removeEventListener("threads-changed", h);
  }, []);
  return [...threads].sort((a, b) => b.updatedAt - a.updatedAt);
}

function ChatPage() {
  const { threadId } = Route.useParams();
  const threads = useThreads();
  const navigate = useNavigate();
  const initial = useMemo(() => ensureThread(threadId).messages, [threadId]);

  return (
    <div className="mx-auto grid h-[calc(100vh-4rem)] max-w-7xl grid-cols-1 md:grid-cols-[16rem_1fr]">
      <aside className="hidden flex-col border-r p-3 md:flex">
        <Button onClick={() => navigate({ to: "/chat/$threadId", params: { threadId: newId() } })} className="mb-3">
          <Plus className="size-4" /> Ny chatt
        </Button>
        <ul className="flex-1 space-y-1 overflow-y-auto">
          {threads.map((t) => (
            <li key={t.id} className={`group flex items-center rounded-md text-sm ${t.id === threadId ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`}>
              <Link to="/chat/$threadId" params={{ threadId: t.id }} className="flex-1 truncate px-2 py-2">{t.title}</Link>
              <button
                aria-label="Radera chatt"
                className="px-2 opacity-0 group-hover:opacity-100"
                onClick={() => {
                  deleteThread(t.id);
                  if (t.id === threadId) navigate({ to: "/chat" });
                }}
              >
                <Trash2 className="size-4 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <ChatWindow key={threadId} threadId={threadId} initial={initial} />
    </div>
  );
}

const suggestions = [
  "Vem är bästa svenska anfallaren just nu?",
  "Förklara gegenpressing enkelt",
  "Vilka bilar kör Bayern Münchens spelare?",
  "Hur fungerar seriesystemet i Sverige ner till division 3?",
];

function ChatWindow({ threadId, initial }: { threadId: string; initial: UIMessage[] }) {
  const [error, setError] = useState<string | null>(null);
  const { messages, sendMessage, status, stop } = useChat({
    id: threadId,
    messages: initial,
    transport: new DefaultChatTransport({ api: "/api/chat", body: { threadId } }),
    onError: (e) => setError(e.message || "Kunde inte nå AI:n."),
  });

  useEffect(() => {
    if (messages.length && status !== "streaming") updateThread(threadId, messages);
  }, [messages, status, threadId]);

  const busy = status === "submitted" || status === "streaming";
  const send = (text: string) => {
    if (!text.trim() || busy) return;
    setError(null);
    sendMessage({ text });
  };

  return (
    <div className="flex min-h-0 flex-col">
      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl">
          {messages.length === 0 && (
            <div className="flex flex-col items-center py-16 text-center">
              <img src={logo} alt="ScoutLab" width={72} height={72} className="size-18" />
              <h1 className="mt-4 font-display text-4xl font-extrabold">Fråga om fotboll</h1>
              <p className="mt-2 text-muted-foreground">Spelare, tränare, taktik, övergångar – bara fotboll.</p>
              <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-lg border p-3 text-left text-sm hover:border-primary hover:text-primary">{s}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <Message key={m.id} from={m.role}>
              <MessageContent>
                {m.parts.map((p, i) =>
                  p.type === "text" ? (m.role === "assistant" ? <MessageResponse key={i}>{p.text}</MessageResponse> : <span key={i}>{p.text}</span>) : null,
                )}
              </MessageContent>
            </Message>
          ))}
          {status === "submitted" && <Shimmer>Tänker…</Shimmer>}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="mx-auto w-full max-w-3xl p-4">
        <PromptInput onSubmit={(msg) => send(msg.text)}>
          <PromptInputTextarea autoFocus placeholder="Fråga något om fotboll…" />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={stop} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
