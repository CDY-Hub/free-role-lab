import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Breaker,
  Gate,
  Inflight,
  TimeoutError,
  TtlCache,
  fetchWithTimeout,
  runPool,
} from "./tm-net";

describe("TtlCache", () => {
  it("returns fresh values and drops expired ones", () => {
    const c = new TtlCache(10, 1_000_000);
    c.set("a", "x", 1000, 0);
    expect(c.get("a", 500)).toBe("x");
    expect(c.get("a", 1500)).toBeUndefined();
    expect(c.size).toBe(0);
  });

  it("keeps stale values available for fallback", () => {
    const c = new TtlCache(10, 1_000_000);
    c.set("a", { v: 1 }, 10, 0);
    expect(c.get("a", 1000)).toBeUndefined();
    // utgången post togs bort av get, så stale finns bara kvar för poster som inte rörts
    c.set("b", { v: 2 }, 10, 0);
    expect(c.getStale<{ v: number }>("b")).toEqual({ v: 2 });
  });

  it("evicts the oldest entries when over the entry limit", () => {
    const c = new TtlCache(3, 1_000_000);
    for (const k of ["a", "b", "c", "d"]) c.set(k, k, 10_000, 0);
    expect(c.size).toBe(3);
    expect(c.get("a", 1)).toBeUndefined();
    expect(c.get("d", 1)).toBe("d");
  });

  it("evicts by memory use, not only by count (the slow-search bug)", () => {
    const page = "x".repeat(10_000); // ~20 000 byte enligt uppskattningen
    const c = new TtlCache(1000, 50_000);
    for (let i = 0; i < 20; i++) c.set(`page${i}`, page, 60_000, 0);
    expect(c.totalBytes).toBeLessThanOrEqual(50_000);
    expect(c.size).toBeLessThan(20);
    expect(c.get("page19", 1)).toBe(page);
    expect(c.get("page0", 1)).toBeUndefined();
  });

  it("does not cache a single value larger than the whole budget", () => {
    const c = new TtlCache(10, 100);
    c.set("big", "x".repeat(1000), 1000, 0);
    expect(c.size).toBe(0);
  });

  it("keeps recently used entries when evicting", () => {
    const c = new TtlCache(2, 1_000_000);
    c.set("a", 1, 10_000, 0);
    c.set("b", 2, 10_000, 0);
    c.get("a", 1); // a blir senast använd
    c.set("c", 3, 10_000, 2);
    expect(c.get("a", 3)).toBe(1);
    expect(c.get("b", 3)).toBeUndefined();
  });

  it("tracks bytes correctly when overwriting and deleting", () => {
    const c = new TtlCache(10, 1_000_000);
    c.set("a", "x".repeat(100), 1000, 0);
    const first = c.totalBytes;
    c.set("a", "x".repeat(100), 1000, 0);
    expect(c.totalBytes).toBe(first);
    c.delete("a");
    expect(c.totalBytes).toBe(0);
  });
});

describe("Inflight", () => {
  it("shares one call between identical concurrent requests", async () => {
    const inflight = new Inflight();
    const fn = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return 42;
    });
    const [a, b, c] = await Promise.all([
      inflight.run("k", fn),
      inflight.run("k", fn),
      inflight.run("k", fn),
    ]);
    expect([a, b, c]).toEqual([42, 42, 42]);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(inflight.size).toBe(0);
  });

  it("lets a new call through after a failure instead of caching the error", async () => {
    const inflight = new Inflight();
    await expect(inflight.run("k", () => Promise.reject(new Error("nej")))).rejects.toThrow("nej");
    await expect(inflight.run("k", async () => "ok")).resolves.toBe("ok");
  });
});

describe("Breaker", () => {
  it("is open for the given time and then closes", () => {
    const b = new Breaker();
    expect(b.isOpen(0)).toBe(false);
    b.open(1000, 0);
    expect(b.isOpen(500)).toBe(true);
    expect(b.remainingMs(500)).toBe(500);
    expect(b.isOpen(1000)).toBe(false);
  });

  it("never shortens an open period and can be reset", () => {
    const b = new Breaker();
    b.open(5000, 0);
    b.open(100, 0);
    expect(b.isOpen(4000)).toBe(true);
    b.reset();
    expect(b.isOpen(1)).toBe(false);
  });
});

describe("Gate", () => {
  afterEach(() => vi.useRealTimers());

  it("spaces call starts by the gap", async () => {
    vi.useFakeTimers();
    const gate = new Gate(500);
    const starts: number[] = [];
    const t0 = Date.now();
    const run = async () => {
      await gate.wait();
      starts.push(Date.now() - t0);
    };
    const all = Promise.all([run(), run(), run()]);
    await vi.advanceTimersByTimeAsync(1100);
    await all;
    expect(starts).toEqual([0, 500, 1000]);
  });
});

describe("fetchWithTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns the response when it arrives in time", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("ok", { status: 200 })));
    const res = await fetchWithTimeout("https://example.test", {}, 1000);
    expect(res.status).toBe(200);
  });

  it("aborts a hanging request with a TimeoutError", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () =>
              reject(new DOMException("x", "AbortError")),
            );
          }),
      ),
    );
    const p = fetchWithTimeout("https://example.test", {}, 2000);
    const assertion = expect(p).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(2100);
    await assertion;
  });

  it("passes other errors through unchanged", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("dns")));
    await expect(fetchWithTimeout("https://example.test", {}, 1000)).rejects.toThrow("dns");
  });
});

describe("runPool", () => {
  it("never runs more than the limit at once and keeps the order of the results", async () => {
    let active = 0;
    let peak = 0;
    const out = await runPool([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return n * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10, 12, 14]);
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1);
  });

  it("handles an empty list and a limit larger than the list", async () => {
    expect(await runPool([], 4, async (n: number) => n)).toEqual([]);
    expect(await runPool([1, 2], 10, async (n) => n + 1)).toEqual([2, 3]);
  });
});
