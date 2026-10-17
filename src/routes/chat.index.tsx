import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { loadThreads, newId } from "@/lib/threads";

export const Route = createFileRoute("/chat/")({
  head: () => ({
    meta: [
      { title: "AI-chatt om fotboll – Free Role Lab" },
      { name: "description", content: "Fråga vad som helst om fotboll." },
      { property: "og:title", content: "AI-chatt om fotboll – Free Role Lab" },
      { property: "og:description", content: "Fråga vad som helst om fotboll." },
    ],
  }),
  component: ChatIndex,
});

function ChatIndex() {
  const navigate = useNavigate();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const t = loadThreads().sort((a, b) => b.updatedAt - a.updatedAt)[0];
    navigate({ to: "/chat/$threadId", params: { threadId: t?.id ?? newId() }, replace: true });
  }, [navigate]);
  return null;
}
