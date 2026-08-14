/**
 * Slovenian money: 1.820,00 € — dot for thousands, comma for decimals.
 *
 * `useGrouping: 'always'` is deliberate. Slovenian CLDR only groups from five
 * digits up in running text, but financial documents group from four, and this
 * app is nothing but financial documents.
 */
export function fmtMoney(n: number): string {
  return (Math.round(n * 100) / 100).toLocaleString('sl-SI', {
    style: 'currency',
    currency: 'EUR',
    useGrouping: 'always',
  });
}

/** Duration in hours between two HH:mm times, wrapping past midnight. */
export function hoursBetween(start: string, end: string): number {
  const [sh = 0, sm = 0] = start.split(':').map(Number);
  const [eh = 0, em = 0] = end.split(':').map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return mins / 60;
}

export function fmtHours(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm ? `${hh} h ${mm} min` : `${hh} h`;
}

/** Tight form for dense spots like calendar cells: "8 h", "7,5 h". */
export function fmtHoursCompact(h: number): string {
  return `${(Math.round(h * 10) / 10).toLocaleString('sl-SI')} h`;
}

/** "sre, 3. avg." */
export function fmtDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('sl-SI', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** ISO yyyy-mm-dd -> dd.mm.yyyy, or '' when there's no date yet. */
export function isoToDmy(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

/**
 * dd.mm.yyyy -> ISO, or null if it isn't a real date. Round-tripping through
 * Date catches 31.02.2026, which a regex alone would wave through.
 */
export function dmyToIso(text: string): string | null {
  const m = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return isoOf(date);
}

/** Digits typed by a person -> HH:mm as they go. */
export function maskTime(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}:${d.slice(2)}`;
}

/** True for a real 24-hour time. */
export function isValidTime(text: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text.trim());
}

/**
 * What a person half-typed -> HH:mm. "9" is 09:00, "930" is 09:30 — the
 * shapes people actually type into a time box.
 */
export function normaliseTime(text: string): string | null {
  const digits = text.replace(/\D/g, '');
  if (digits.length === 0) return null;
  let hh: string;
  let mm: string;
  if (digits.length <= 2) {
    hh = digits.padStart(2, '0');
    mm = '00';
  } else if (digits.length === 3) {
    hh = ('0' + digits[0]).slice(-2);
    mm = digits.slice(1);
  } else {
    hh = digits.slice(0, 2);
    mm = digits.slice(2, 4);
  }
  const value = `${hh}:${mm}`;
  return isValidTime(value) ? value : null;
}

/** Digits typed by a person -> dd.mm.yyyy as they go. */
export function maskDmy(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}.${d.slice(2)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4)}`;
}

/** ISO yyyy-mm-dd -> dd.mm.yyyy */
export function fmtDMY(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function todayIso(): string {
  return isoOf(new Date());
}

/** Local-time ISO date, so late-evening entries don't land on tomorrow. */
export function isoOf(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return isoOf(d);
}

export const MONTH_NAMES = [
  'Januar',
  'Februar',
  'Marec',
  'April',
  'Maj',
  'Junij',
  'Julij',
  'Avgust',
  'September',
  'Oktober',
  'November',
  'December',
];

/** Monday-first, as the Slovenian week runs. */
export const WEEKDAY_NAMES = ['Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned'];

const CLIENT_COLORS = [
  'oklch(0.5106 0.2301 276.97)',
  'oklch(0.7038 0.123 182.5)',
  'oklch(0.7686 0.1647 70.08)',
  'oklch(0.6368 0.2078 25.33)',
  'oklch(0.55 0.15 250)',
  'oklch(0.55 0.16 330)',
  'oklch(0.55 0.14 145)',
  'oklch(0.5 0.12 40)',
];

export function clientColor(clientId: string | null | undefined): string {
  if (!clientId) return 'oklch(0.6 0 0)';
  let hash = 0;
  for (let i = 0; i < clientId.length; i++) {
    hash = (hash * 31 + clientId.charCodeAt(i)) >>> 0;
  }
  return CLIENT_COLORS[hash % CLIENT_COLORS.length] as string;
}

/**
 * Slovenian counted nouns: 1 vnos, 2 vnosa, 3 vnosi, 5 vnosov.
 *
 * The form follows n mod 100 — dual for 2, "few" for 3 and 4, genitive plural
 * for everything else — which is why "3 vnosov" reads as broken Slovenian even
 * though a naive singular/plural switch would produce it.
 */
export function plural(
  n: number,
  [one, two, few, other]: [string, string, string, string],
): string {
  const r = Math.abs(n) % 100;
  if (r === 1) return `${n} ${one}`;
  if (r === 2) return `${n} ${two}`;
  if (r === 3 || r === 4) return `${n} ${few}`;
  return `${n} ${other}`;
}
