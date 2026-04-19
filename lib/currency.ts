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

// Frankfurter is a free, auth-free ECB-backed exchange-rate API.
// Docs: https://www.frankfurter.app
export async function fetchRate(from: Currency, to: Currency): Promise<number> {
  if (from === to) return 1;
  const res = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`);
  if (!res.ok) throw new Error(`Exchange rate fetch failed (${res.status})`);
  const data = await res.json();
  const rate = data?.rates?.[to];
  if (typeof rate !== 'number') throw new Error('Unexpected rate payload');
  return rate;
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
