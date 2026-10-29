/**
 * Nätverkshjälpare för servern: cache med minnestak, dubblettskydd för identiska anrop,
 * timeout, strypning och en "säkring" som gör att vi slutar knacka på en tjänst som just
 * har sagt nej. Inget här pratar med nätet på egen hand, så allt går att testa.
 */

type Entry = { value: unknown; expiry: number; size: number };

function sizeOf(value: unknown): number {
  try {
    if (typeof value === "string") return value.length * 2;
    return (JSON.stringify(value)?.length ?? 8) * 2;
  } catch {
    return 1024;
  }
}

/**
 * Cache med både tidsgräns och minnestak. Äldst använda poster åker ut först.
 * Tidigare cache räknade bara poster, så ett par hundra hela HTML-sidor kunde fylla servern.
 */
export class TtlCache {
  private map = new Map<string, Entry>();
  private bytes = 0;

  constructor(
    private readonly maxEntries: number,
    private readonly maxBytes: number,
  ) {}

  get size() {
    return this.map.size;
  }

  get totalBytes() {
    return this.bytes;
  }

  get<T>(key: string, now = Date.now()): T | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (now > e.expiry) {
      this.remove(key);
      return undefined;
    }
    // Flytta sist så att senast använda överlever.
    this.map.delete(key);
    this.map.set(key, e);
    return e.value as T;
  }

  /** Som get, men ger även gamla poster. Används för "visa gammalt hellre än inget". */
  getStale<T>(key: string): T | undefined {
    return this.map.get(key)?.value as T | undefined;
  }

  set(key: string, value: unknown, ttlMs: number, now = Date.now()): void {
    const size = sizeOf(value);
    // En enskild post som aldrig ryms cachas inte alls.
    if (size > this.maxBytes) return;
    this.remove(key);
    this.map.set(key, { value, expiry: now + ttlMs, size });
    this.bytes += size;
    this.evict(now);
  }

  delete(key: string): void {
    this.remove(key);
  }

  clear(): void {
    this.map.clear();
    this.bytes = 0;
  }

  private remove(key: string) {
    const e = this.map.get(key);
    if (!e) return;
    this.bytes -= e.size;
    this.map.delete(key);
  }

  private evict(now: number) {
    if (this.map.size <= this.maxEntries && this.bytes <= this.maxBytes) return;
    // Först utgångna, sedan äldst.
    for (const [k, e] of this.map) {
      if (now > e.expiry) this.remove(k);
    }
    while (this.map.size > this.maxEntries || this.bytes > this.maxBytes) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.remove(oldest);
    }
  }
}

/** Identiska pågående anrop delar ett svar i stället för att skicka flera. */
export class Inflight {
  private pending = new Map<string, Promise<unknown>>();

  run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const hit = this.pending.get(key);
    if (hit) return hit as Promise<T>;
    const p = fn().finally(() => {
      if (this.pending.get(key) === p) this.pending.delete(key);
    });
    this.pending.set(key, p);
    return p;
  }

  get size() {
    return this.pending.size;
  }
}

/** Öppnas när en tjänst har sagt nej, så att följande anrop misslyckas direkt i stället för att vänta. */
export class Breaker {
  private until = 0;

  open(ms: number, now = Date.now()) {
    this.until = Math.max(this.until, now + ms);
  }

  isOpen(now = Date.now()) {
    return now < this.until;
  }

  remainingMs(now = Date.now()) {
    return Math.max(0, this.until - now);
  }

  reset() {
    this.until = 0;
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Håller ett minsta avstånd mellan anropsstarter mot tjänster som stryper (t.ex. ~2 anrop/3 s). */
export class Gate {
  private next = 0;

  constructor(private readonly gapMs: number) {}

  async wait(now = Date.now()): Promise<void> {
    const start = Math.max(now, this.next);
    this.next = start + this.gapMs;
    if (start > now) await sleep(start - now);
  }
}

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Tjänsten svarade inte inom ${Math.round(ms / 1000)} s`);
    this.name = "TimeoutError";
  }
}

/** fetch med tidsgräns. Utan den kan ett hängande anrop blockera en förfrågan hur länge som helst. */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  ms = 9000,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    if (ctrl.signal.aborted) throw new TimeoutError(ms);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Kör fn över items med högst `limit` anrop samtidigt. Ger resultaten i samma ordning och
 * kastar aldrig själv: fn ansvarar för sina egna fel. Skonar tjänster som stryper vid skurar.
 */
export async function runPool<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return results;
}
