import { describe, it, expect } from 'vitest';
import {
  localDateKey,
  localDateTimeInputValue,
  localDateTimeToISO,
  localDateOnlyToISO,
  isOnLocalDay,
  newId,
  formatDuration,
  formatDurationShort
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

describe('formatDuration', () => {
  it('renders sub-hour lengths in minutes', () => {
    expect(formatDuration(30)).toBe('30 min');
    expect(formatDuration(45)).toBe('45 min');
  });

  it('renders whole hours, singular vs plural', () => {
    expect(formatDuration(60)).toBe('1 hour');
    expect(formatDuration(120)).toBe('2 hours');
  });

  it('renders half hours as decimals', () => {
    expect(formatDuration(90)).toBe('1.5 hours');
    expect(formatDuration(150)).toBe('2.5 hours');
  });

  it('renders odd leftovers without lying about the length', () => {
    expect(formatDuration(75)).toBe('1 hr 15 min');
  });

  it('does not render nonsense for missing/zero durations', () => {
    expect(formatDuration(0)).toBe('—');
    expect(formatDuration(NaN)).toBe('—');
    expect(formatDuration(undefined as unknown as number)).toBe('—');
  });
});

describe('formatDurationShort', () => {
  it('compacts lengths for dense calendar cells', () => {
    expect(formatDurationShort(30)).toBe('30m');
    expect(formatDurationShort(60)).toBe('1h');
    expect(formatDurationShort(90)).toBe('1.5h');
    expect(formatDurationShort(120)).toBe('2h');
    expect(formatDurationShort(75)).toBe('1h15');
  });

  it('renders nothing when there is no duration to show', () => {
    expect(formatDurationShort(0)).toBe('');
    expect(formatDurationShort(NaN)).toBe('');
  });
});
