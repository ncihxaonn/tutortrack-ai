import { describe, it, expect } from 'vitest';
import {
  localDateKey,
  localDateTimeInputValue,
  localDateTimeToISO,
  localDateOnlyToISO,
  isOnLocalDay,
  newId
} from '../lib/dateUtils';

describe('localDateKey', () => {
  it('returns YYYY-MM-DD using LOCAL components, not UTC', () => {
    const d = new Date(2026, 4, 17, 23, 30, 0); // 2026-05-17 23:30 local
    expect(localDateKey(d)).toBe('2026-05-17');
  });

  it('pads month and day to two digits', () => {
    expect(localDateKey(new Date(2026, 0, 1))).toBe('2026-01-01');
  });

  it('accepts an ISO string and parses it as a Date', () => {
    const iso = new Date(2026, 4, 17, 9, 0, 0).toISOString();
    expect(localDateKey(iso)).toBe('2026-05-17');
  });
});

describe('localDateTimeInputValue', () => {
  it('formats YYYY-MM-DDTHH:MM in local time', () => {
    const d = new Date(2026, 4, 17, 9, 5, 0);
    expect(localDateTimeInputValue(d)).toBe('2026-05-17T09:05');
  });
});

describe('localDateTimeToISO', () => {
  it('round-trips a local datetime input back through Date as the same wall time', () => {
    const iso = localDateTimeToISO('2026-05-17', '21:30');
    const parsed = new Date(iso);
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(4);
    expect(parsed.getDate()).toBe(17);
    expect(parsed.getHours()).toBe(21);
    expect(parsed.getMinutes()).toBe(30);
  });
});

describe('localDateOnlyToISO', () => {
  it('treats YYYY-MM-DD as local midnight, not UTC midnight', () => {
    const iso = localDateOnlyToISO('2026-05-17');
    const parsed = new Date(iso);
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(4);
    expect(parsed.getDate()).toBe(17);
    // Hours are 0 in LOCAL, but the resulting ISO is offset by the timezone —
    // we only assert that the local date components are preserved.
  });
});

describe('isOnLocalDay', () => {
  it('returns true for an ISO whose local date matches the key', () => {
    const iso = new Date(2026, 4, 17, 23, 59).toISOString();
    expect(isOnLocalDay(iso, '2026-05-17')).toBe(true);
  });

  it('returns false for a different local date', () => {
    const iso = new Date(2026, 4, 17, 23, 59).toISOString();
    expect(isOnLocalDay(iso, '2026-05-18')).toBe(false);
  });
});

describe('newId', () => {
  it('generates unique values across calls', () => {
    const a = newId('s');
    const b = newId('s');
    expect(a).not.toBe(b);
  });

  it('applies the prefix', () => {
    expect(newId('p').startsWith('p')).toBe(true);
  });
});
