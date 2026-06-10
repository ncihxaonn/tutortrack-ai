// Local-date helpers. The whole app stores timestamps as ISO UTC strings, but
// calendar grouping, date filters, and `<input type="date">` values all need
// to operate in the user's local timezone — otherwise sessions near midnight
// land in the wrong day. Using `toISOString().slice(0, 10)` is the common bug.

const pad = (n: number) => String(n).padStart(2, '0');

// Returns a YYYY-MM-DD string for the given date in the LOCAL timezone.
export const localDateKey = (d: Date | string): string => {
  const date = typeof d === 'string' ? new Date(d) : d;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

// Returns YYYY-MM-DDTHH:MM in LOCAL time, suitable for `<input type="datetime-local">`.
export const localDateTimeInputValue = (d: Date | string): string => {
  const date = typeof d === 'string' ? new Date(d) : d;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

// Returns HH:MM in LOCAL time, suitable for `<input type="time">`.
export const localTimeInputValue = (d: Date | string): string => {
  const date = typeof d === 'string' ? new Date(d) : d;
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

// Converts a date-only string (YYYY-MM-DD) + time-only string (HH:MM) from local
// inputs into a proper ISO UTC string. Plain concatenation produces an ambiguous
// timestamp (no timezone) which Postgres parses as UTC, shifting the stored time.
export const localDateTimeToISO = (date: string, time: string): string => {
  const [y, m, d] = date.split('-').map(Number);
  const [hh = 0, mm = 0] = time.split(':').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh, mm, 0).toISOString();
};

// Converts a date-only input (YYYY-MM-DD) into an ISO string anchored to local
// midnight — avoids the UTC-midnight shift you get from `new Date('2024-01-01')`.
export const localDateOnlyToISO = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0).toISOString();
};

// Parses a date-only 'YYYY-MM-DD' string into a Date at LOCAL midnight. Use this
// for display instead of `new Date('YYYY-MM-DD')`, which parses as UTC midnight
// and renders one day earlier in UTC-negative timezones.
export const parseLocalDateKey = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

// Returns true if the given ISO timestamp falls on the same LOCAL day as `dayKey` (YYYY-MM-DD).
export const isOnLocalDay = (iso: string, dayKey: string): boolean => {
  return localDateKey(iso) === dayKey;
};

// Returns true if the given ISO timestamp falls on the same LOCAL day as the
// provided Date object.
export const isSameLocalDay = (iso: string, date: Date): boolean => {
  return localDateKey(iso) === localDateKey(date);
};

// Today's local YYYY-MM-DD.
export const todayLocalKey = (): string => localDateKey(new Date());

// Generate a fresh unique ID — uses crypto.randomUUID when available, falls
// back to a Date.now() + random suffix so older environments don't crash.
export const newId = (prefix = ''): string => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      const uuid = crypto.randomUUID();
      return prefix ? `${prefix}_${uuid}` : uuid;
    }
  } catch {
    /* fall through */
  }
  const rand = Math.random().toString(36).slice(2, 10);
  const stamp = Date.now().toString(36);
  return prefix ? `${prefix}_${stamp}${rand}` : `${stamp}${rand}`;
};
