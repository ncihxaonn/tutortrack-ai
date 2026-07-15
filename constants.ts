// Pricing defaults for newly-logged sessions. All amounts are stored in the
// base currency (CNY); display conversion happens in lib/currency.ts.
export const PRICE_1ON1 = 40;
export const PRICE_GROUP = 30; // Per student

// Default package size used by lesson-numbering in the student detail view.
export const DEFAULT_PACKAGE_SIZE = 10;

// Default session duration in minutes. Most students are on 30-minute classes,
// so the session log pre-selects 30 and longer bookings are the exception.
export const DEFAULT_SESSION_MINUTES = 30;

// Duration choices offered when logging a class. Duration is descriptive only —
// it does not affect price, which is per-class (see PRICE_1ON1 / PRICE_GROUP).
export const SESSION_DURATION_CHOICES = [30, 45, 60, 90, 120];

// Default values for the "renew package" flow on the student detail page.
export const DEFAULT_RENEW_CLASSES = 10;
export const DEFAULT_RENEW_COST = 400;
