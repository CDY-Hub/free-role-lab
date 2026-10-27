/**
 * Klient för API-Football med inbyggd rate limiting baserat på
 * X-RateLimit-* (per minut) och x-ratelimit-requests-* (per dag).
 *
 * Alla anrop till v3.football.api-sports.io bör gå via footballFetch()
 * istället för rå fetch().
 */

interface RateLimitState {
  minuteRemaining: number;
  minuteResetAt: number;
}

let state: RateLimitState = {
  minuteRemaining: 10,
  minuteResetAt: 0,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readMinuteHeaders(res: Response): void {
  const remainingRaw =
    res.headers.get("X-RateLimit-Remaining") ??
    res.headers.get("x-ratelimit-remaining");
  if (remainingRaw === null) return;

  const remaining = Number(remainingRaw);
  if (!Number.isFinite(remaining)) return;

  state = {
    minuteRemaining: remaining,
    minuteResetAt: Date.now() + 60_000,
  };
}

function readDailyHeaders(res: Response): void {
  // Vi läser dem för framtida bruk / loggning.
  // Daglig gräns är 100 anrop på free tier, så den är mindre kritisk
  // än per-minut-gränsen.
  const dailyRemaining = res.headers.get("x-ratelimit-requests-remaining");
  if (dailyRemaining !== null) {
    // no-op just nu – kan användas för att varna i UI
  }
}

async function waitForMinuteBudget(): Promise<void> {
  if (state.minuteRemaining <= 1 && Date.now() < state.minuteResetAt) {
    const waitMs = state.minuteResetAt - Date.now();
    await sleep(waitMs);
  }
}

export async function footballFetch(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  await waitForMinuteBudget();

  let res = await fetch(url, init);
  readMinuteHeaders(res);
  readDailyHeaders(res);

  if (res.status === 429) {
    // API-Football skickar inte alltid Retry-After.
    // Vänta en fast stund och försök en gång till.
    await sleep(2_000);
    res = await fetch(url, init);
    readMinuteHeaders(res);
    readDailyHeaders(res);
  }

  return res;
}
