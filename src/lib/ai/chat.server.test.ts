import { describe, it, expect } from "vitest";
import { createRateLimiter, handleChat, stripReasoningParts } from "./chat.server";
import type { UIMessage } from "ai";

describe("stripReasoningParts", () => {
  it("tar bort reasoning- och reasoning-file-delar", () => {
    const messages: UIMessage[] = [
      {
        id: "1",
        role: "user",
        parts: [
          { type: "text", text: "Vem vann CL 2024?" },
          { type: "reasoning", text: "intern tanke" } as unknown as UIMessage["parts"][number],
          { type: "reasoning-file", url: "x" } as unknown as UIMessage["parts"][number],
        ],
      },
    ];

    const out = stripReasoningParts(messages);

    expect(out[0]?.parts).toHaveLength(1);
    expect(out[0]?.parts[0]).toEqual({
      type: "text",
      text: "Vem vann CL 2024?",
    });
  });

  it("lämnar meddelanden utan reasoning orörda", () => {
    const messages: UIMessage[] = [
      {
        id: "1",
        role: "user",
        parts: [{ type: "text", text: "Hej" }],
      },
    ];

    const out = stripReasoningParts(messages);
    expect(out).toEqual(messages);
  });

  it("kastar inte på tom historik", () => {
    expect(() => stripReasoningParts([])).not.toThrow();
  });
});

describe("handleChat", () => {
  it("returnerar 400 vid ogiltig förfrågan", async () => {
    const req = new Request("https://example.test", {
      method: "POST",
      body: JSON.stringify({ notMessages: true }),
    });

    const res = await handleChat(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Ogiltig förfrågan");
  });
});

describe("handleChat – skydd", () => {
  const post = (body: unknown) =>
    new Request("https://example.test", { method: "POST", body: JSON.stringify(body) });

  it("avvisar för långa meddelanden med 413", async () => {
    const res = await handleChat(
      post({
        messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "x".repeat(5000) }] }],
      }),
    );
    expect(res.status).toBe(413);
  });

  it("ger 500 utan API-nycklar (ingen inbyggd reservnyckel)", async () => {
    const saved = { ...process.env };
    delete process.env["LOVABLE_API_KEY"];
    delete process.env["OPENAI_API_KEY"];
    delete process.env["GEMINI_API_KEY"];
    try {
      const res = await handleChat(
        post({
          messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "Hej" }] }],
        }),
      );
      expect(res.status).toBe(500);
    } finally {
      process.env = saved;
    }
  });
});

describe("createRateLimiter", () => {
  it("släpper igenom upp till max och blockerar därefter", () => {
    const allowed = createRateLimiter(2, 1000);
    expect(allowed("a", 0)).toBe(true);
    expect(allowed("a", 10)).toBe(true);
    expect(allowed("a", 20)).toBe(false);
    expect(allowed("b", 20)).toBe(true);
  });

  it("återställs när fönstret gått ut", () => {
    const allowed = createRateLimiter(1, 1000);
    expect(allowed("a", 0)).toBe(true);
    expect(allowed("a", 500)).toBe(false);
    expect(allowed("a", 1500)).toBe(true);
  });
});
