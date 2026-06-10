import { describe, it, expect } from 'vitest';
import { formatMoney } from '../lib/currency';

describe('formatMoney', () => {
  it('formats base currency (CNY) rounded to whole yuan', () => {
    expect(formatMoney(400, 'CNY', 1)).toBe('¥400');
    expect(formatMoney(400.6, 'CNY', 1)).toBe('¥401');
    expect(formatMoney(-250, 'CNY', 1)).toBe('-¥250');
  });

  it('converts to AUD with a valid rate', () => {
    expect(formatMoney(100, 'AUD', 0.21)).toBe('A$21.00');
  });

  // Regression guard: a failed/missing rate must NOT relabel raw CNY magnitudes
  // as AUD (a ~4.7x overstatement). It should fall back to base-currency display.
  it('falls back to base currency when the rate is invalid', () => {
    expect(formatMoney(400, 'AUD', NaN)).toBe('¥400');
    expect(formatMoney(400, 'AUD', 0)).toBe('¥400');
    expect(formatMoney(400, 'AUD', -1)).toBe('¥400');
  });
});
