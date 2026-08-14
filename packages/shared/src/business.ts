import { z } from 'zod';
import { regNumberSchema } from './profile';

/**
 * A registration period — one s.p. from vpis to izbris.
 *
 * The fields mirror what SPOT hands you when you register: the firma as
 * entered in PRS, the start date, the elected taxation scheme with its
 * normirani-odhodki percentages, and the akontacija that FURS assessed from
 * your projected revenue. Keeping them means the tax view can compute rather
 * than ask.
 *
 * Closing one and opening another is a normal thing to do, so this is a list:
 * hours and invoices keep pointing at the period they were issued in.
 */

/** Normiranec: deemed expenses as a share of revenue. 80 % as of 2026. */
export const DEFAULT_EXPENSE_RATE = 80;

/** Dohodnina charged on the resulting base. 20 % flat for normiranci. */
export const DEFAULT_TAX_RATE = 20;

/**
 * Defaults only — the real figures move with the law and depend on whether you
 * are insured full-time, so they live on the registration and are editable.
 * Check your own against FURS before trusting a forecast.
 */
export const DEFAULT_REVENUE_CAP = 50_000;
/** Cap on recognised normirani odhodki. 0 means "no cap". */
export const DEFAULT_EXPENSE_CAP = 40_000;

/** Above this yearly akontacija, FURS bills monthly instead of quarterly. */
export const MONTHLY_ADVANCE_THRESHOLD = 400;

export const businessSchema = z.object({
  id: z.string(),

  /** Full firma exactly as registered, e.g. "Reševalec iz vode, Ana Novak, s.p." */
  firma: z.string().trim().min(1, 'Firma je obvezna'),
  /** Skrajšana firma, e.g. "Ana Novak, s.p." */
  shortName: z.string().trim(),

  /** Datum vpisa v PRS — the day obligations start running. */
  startedOn: z.string().refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), {
    message: 'Vnesite datum začetka',
  }),
  /** Datum izbrisa, once the activity is closed. */
  closedOn: z
    .string()
    .nullable()
    .refine((v) => v === null || v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), {
      message: 'Vnesite datum zaprtja',
    }),

  regNumber: regNumberSchema,

  /** Glavna dejavnost, e.g. 84.250 — Zaščita in reševanje pri požarih in nesrečah. */
  skdCode: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d{2}\.\d{3}$/.test(v), {
      message: 'Šifra SKD je v obliki 84.250',
    }),
  skdName: z.string().trim(),

  /** Zavarovalna podlaga: full-time s.p. (05) or alongside employment. */
  insuranceBasis: z.enum(['polni', 'popoldanski']),

  scheme: z.enum(['normiranec', 'dejanski']),
  expenseRatePercent: z.number().min(0).max(100),
  taxRatePercent: z.number().min(0).max(100),

  /** Prihodki you projected on registration — what the akontacija was set from. */
  expectedRevenue: z.number().min(0),
  /** Predvidena letna akontacija dohodnine. */
  advanceAnnual: z.number().min(0),

  /** Prispevki per month, from the eDavki e-kartica. */
  monthlyContribution: z.number().min(0),

  /** Revenue above which the flat-rate scheme is lost. */
  revenueCap: z.number().min(0).default(DEFAULT_REVENUE_CAP),
  /** Most that can be recognised as normirani odhodki; 0 for uncapped. */
  expenseCap: z.number().min(0).default(DEFAULT_EXPENSE_CAP),
});

export type Business = z.infer<typeof businessSchema>;

/** The share of revenue that actually leaves as dohodnina: 20 % of 20 % = 4 %. */
export function effectiveTaxRate(b: Pick<Business, 'scheme' | 'expenseRatePercent' | 'taxRatePercent'>): number {
  if (b.scheme !== 'normiranec') return b.taxRatePercent;
  return ((100 - b.expenseRatePercent) / 100) * b.taxRatePercent;
}

/** FURS bills quarterly up to 400 € a year, monthly above it. */
export function advanceCadence(annual: number): 'monthly' | 'quarterly' {
  return annual > MONTHLY_ADVANCE_THRESHOLD ? 'monthly' : 'quarterly';
}

/** One instalment of the yearly akontacija. */
export function advanceInstalment(annual: number): number {
  return annual / (advanceCadence(annual) === 'monthly' ? 12 : 4);
}

const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

/**
 * Dates are handled in UTC throughout. Local-time arithmetic loses an hour at
 * the spring DST change, which is enough to drop a day from March and make a
 * full year come out as 11.97 months.
 */
const utc = (iso: string) => Date.parse(iso + 'T00:00:00Z');
const DAY = 86_400_000;

/**
 * How much of a calendar year the business was actually insured, in months —
 * fractional, because prispevki for a part-month are charged by the day.
 *
 * Only counts up to `upTo` (today, normally): future months aren't owed yet.
 */
export function monthsActiveInYear(
  b: Pick<Business, 'startedOn' | 'closedOn'>,
  year: number,
  upTo: string,
): number {
  const start = utc(b.startedOn);
  const end = b.closedOn ? utc(b.closedOn) : null;
  const cutoff = utc(upTo);

  let total = 0;
  for (let month = 0; month < 12; month++) {
    const length = daysInMonth(year, month);
    const monthStart = Date.UTC(year, month, 1);
    const monthEnd = Date.UTC(year, month, length);
    if (monthEnd < start) continue;
    if (end !== null && monthStart > end) break;
    if (monthStart > cutoff) break;

    const from = Math.max(monthStart, start);
    let to = Math.min(monthEnd, cutoff);
    if (end !== null) to = Math.min(to, end);

    const days = (to - from) / DAY + 1;
    total += Math.max(0, days) / length;
  }
  return total;
}

/**
 * Newly registered s.p. pay reduced PIZ contributions: half for the first 12
 * months, 70 % for the next 12. The amount on the e-kartica already reflects
 * this, so rather than recompute it we flag when it is about to change.
 */
export function contributionReliefEndsOn(
  b: Pick<Business, 'startedOn'>,
): { firstTierEndsOn: string; secondTierEndsOn: string } {
  const start = new Date(utc(b.startedOn));
  const plus = (months: number) => {
    const d = new Date(start);
    d.setUTCMonth(d.getUTCMonth() + months);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  };
  return { firstTierEndsOn: plus(12), secondTierEndsOn: plus(24) };
}

/** How close paid revenue is to the flat-rate ceiling. */
export function normiranecCapUsage(
  revenue: number,
  cap = DEFAULT_REVENUE_CAP,
): { share: number; nearing: boolean; exceeded: boolean; cap: number } {
  const share = cap > 0 ? revenue / cap : 0;
  return { share, nearing: share >= 0.8 && share < 1, exceeded: share >= 1, cap };
}

/**
 * Dohodnina on a year's revenue.
 *
 * Recognised expenses are a percentage of revenue but capped in euros, so past
 * the cap each additional euro is taxed at the full rate rather than at the
 * headline 4 %. Applying the rate to revenue alone would under-forecast a good
 * year — which is the year you least want a surprise.
 */
export function dohodninaOnRevenue(
  b: Pick<Business, 'scheme' | 'expenseRatePercent' | 'taxRatePercent' | 'expenseCap'>,
  revenue: number,
): number {
  if (b.scheme !== 'normiranec') return revenue * (b.taxRatePercent / 100);
  const uncapped = revenue * (b.expenseRatePercent / 100);
  const recognised = b.expenseCap > 0 ? Math.min(uncapped, b.expenseCap) : uncapped;
  return Math.max(0, revenue - recognised) * (b.taxRatePercent / 100);
}

export function isActiveOn(b: Pick<Business, 'startedOn' | 'closedOn'>, iso: string): boolean {
  if (iso < b.startedOn) return false;
  return !b.closedOn || iso <= b.closedOn;
}
