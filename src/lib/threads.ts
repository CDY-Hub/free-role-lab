import type { UIMessage } from "ai";

export type Thread = { id: string; title: string; updatedAt: number; messages: UIMessage[] };
const KEY = "scoutlab-threads";

export function loadThreads(): Thread[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveThreads(t: Thread[]) {
  localStorage.setItem(KEY, JSON.stringify(t));
  window.dispatchEvent(new Event("threads-changed"));
}

export function ensureThread(id: string): Thread {
  const all = loadThreads();
  let t = all.find((x) => x.id === id);
  if (!t) {
    t = { id, title: "Ny chatt", updatedAt: Date.now(), messages: [] };
    saveThreads([t, ...all]);
  }
  return t;
}

export function updateThread(id: string, messages: UIMessage[]) {
  const all = loadThreads();
  const firstText = messages
    .find((m) => m.role === "user")
    ?.parts.find((p) => p.type === "text") as { text: string } | undefined;
  const next = all.map((t) =>
    t.id === id
      ? {
          ...t,
          messages,
          updatedAt: Date.now(),
          title: firstText ? firstText.text.slice(0, 50) : t.title,
        }
      : t,
  );
  if (!next.some((t) => t.id === id))
    next.unshift({
      id,
      title: firstText?.text.slice(0, 50) ?? "Ny chatt",
      updatedAt: Date.now(),
      messages,
    });
  saveThreads(next);
}

export function deleteThread(id: string) {
  saveThreads(loadThreads().filter((t) => t.id !== id));
}

export const newId = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
