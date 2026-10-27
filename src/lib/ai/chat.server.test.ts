import { describe, it, expect } from "vitest";
import { handleChat, stripReasoningParts } from "./chat.server";
import type { UIMessage } from "ai";

describe("stripReasoningParts", () => {
  it("tar bort reasoning- och reasoning-file-delar", () => {
    const messages: UIMessage[] = [
      {
        id: "1",
        role: "user",
        parts: [
          { type: "text", text: "Vem vann CL 2024?" },
          { type: "reasoning", text: "intern tanke" } as any,
          { type: "reasoning-file", url: "x" } as any,
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
