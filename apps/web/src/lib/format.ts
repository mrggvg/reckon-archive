export function fmtMoney(n: number): string {
  return (
    '€' +
    (Math.round(n * 100) / 100).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
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
  return mm ? `${hh}h ${mm}m` : `${hh}h`;
}

/** Tight form for dense spots like calendar cells: "8h", "7.5h". */
export function fmtHoursCompact(h: number): string {
  return `${Math.round(h * 10) / 10}h`;
}

/** "Mon, 3 Aug" */
export function fmtDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
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
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

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
