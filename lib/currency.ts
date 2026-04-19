// All monetary amounts are stored in the base currency (CNY).
// The UI toggles between CNY and AUD for display only.

export type Currency = 'CNY' | 'AUD';

export const BASE_CURRENCY: Currency = 'CNY';

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  CNY: '¥',
  AUD: 'A$'
};

export const CURRENCY_LABELS: Record<Currency, string> = {
  CNY: 'CNY',
  AUD: 'AUD'
};

// Free, auth-free exchange-rate sources. We try them in order so a single
// outage (or a CORS-unfriendly redirect, which is how frankfurter.app broke)
// doesn't kill the feature.
const RATE_SOURCES: Array<(from: Currency, to: Currency) => Promise<number>> = [
  // Frankfurter (ECB data). Note: api.frankfurter.app now 301-redirects to
  // api.frankfurter.dev, and browsers fail the redirected fetch — so hit the
  // new host directly.
  async (from, to) => {
    const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`);
    if (!res.ok) throw new Error(`frankfurter ${res.status}`);
    const data = await res.json();
    const rate = data?.rates?.[to];
    if (typeof rate !== 'number') throw new Error('frankfurter: bad payload');
    return rate;
  },
  // Fawaz Ahmed's currency-api on jsDelivr — daily-updated, very reliable CDN.
  async (from, to) => {
    const f = from.toLowerCase();
    const t = to.toLowerCase();
    const res = await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${f}.min.json`);
    if (!res.ok) throw new Error(`jsdelivr ${res.status}`);
    const data = await res.json();
    const rate = data?.[f]?.[t];
    if (typeof rate !== 'number') throw new Error('jsdelivr: bad payload');
    return rate;
  },
  // open.er-api.com — another free, no-auth fallback.
  async (from, to) => {
    const res = await fetch(`https://open.er-api.com/v6/latest/${from}`);
    if (!res.ok) throw new Error(`er-api ${res.status}`);
    const data = await res.json();
    const rate = data?.rates?.[to];
    if (typeof rate !== 'number') throw new Error('er-api: bad payload');
    return rate;
  }
];

export async function fetchRate(from: Currency, to: Currency): Promise<number> {
  if (from === to) return 1;
  const errors: string[] = [];
  for (const source of RATE_SOURCES) {
    try {
      return await source(from, to);
    } catch (e: any) {
      errors.push(e?.message ?? String(e));
    }
  }
  throw new Error(`All rate sources failed: ${errors.join('; ')}`);
}

// Formats an amount stored in BASE_CURRENCY into the requested display currency.
export function formatMoney(
  amountInBase: number,
  currency: Currency,
  rate: number
): string {
  const symbol = CURRENCY_SYMBOLS[currency];
  const sign = amountInBase < 0 ? '-' : '';
  const abs = Math.abs(amountInBase);
  if (currency === BASE_CURRENCY) {
    // CNY: round to whole yuan for cleanliness.
    return `${sign}${symbol}${Math.round(abs).toLocaleString()}`;
  }
  const converted = abs * rate;
  return `${sign}${symbol}${converted.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}
