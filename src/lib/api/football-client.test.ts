import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { footballFetch } from "./football-client";

describe("footballFetch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returnerar ok-svar direkt utan retry", async () => {
    const mock = vi.fn().mockResolvedValue(new Response("data", { status: 200 }));
    vi.stubGlobal("fetch", mock);

    const res = await footballFetch("https://example.test");

    expect(res.status).toBe(200);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("retryar en gång vid 429 och returnerar andra svaret", async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", mock);

    const promise = footballFetch("https://example.test");
    await vi.runAllTimersAsync();
    const res = await promise;

    expect(res.status).toBe(200);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("returnerar 429 efter en retry om servern fortsätter svara 429", async () => {
    const mock = vi.fn().mockResolvedValue(new Response(null, { status: 429 }));
    vi.stubGlobal("fetch", mock);

    const promise = footballFetch("https://example.test");
    await vi.runAllTimersAsync();
    const res = await promise;

    expect(res.status).toBe(429);
    expect(mock).toHaveBeenCalledTimes(2);
  });
});
