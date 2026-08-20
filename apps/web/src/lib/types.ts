export interface Profile {
  name: string;
  /** Address kept in parts; joined with formatAddress() for printing. */
  street: string;
  postalCode: string;
  city: string;
  taxNumber: string;
  regNumber: string;
  iban: string;
  /** Name on the account, when it isn't the same as the issuer's. */
  accountHolder: string;
  vatPayer: 'DA' | 'NE';
  defaultDesc: string;
  /** The number the next invoice will carry, e.g. 003/2026. */
  nextInvoiceNumber: string;
  placeOfIssue: string;
  vatClause: string;
  /** Read-only: set through the tax profile, carried here for convenience. */
  businessStartDate?: string | null;
}

export interface Client {
  id: string;
  name: string;
  /** Address kept in parts; joined with formatAddress() for printing. */
  street: string;
  postalCode: string;
  city: string;
  taxNumber: string;
  rate: number;
  email: string;
  phone: string;
  /** Deactivated clients stay in the history but leave the pickers. */
  isActive: boolean;
}

export interface Session {
  id: string;
  clientId: string;
  date: string; // yyyy-mm-dd
  start: string; // HH:mm
  end: string; // HH:mm
  note: string;
  invoiced: boolean;
  invoiceId: string | null;
}

export type InvoiceStatus = 'paid' | 'unpaid' | 'overdue';

export interface Invoice {
  id: string;
  number: string; // NNN/YYYY
  clientId: string;
  issueDate: string;
  dueDate: string;
  description: string;
  periodStart: string;
  periodEnd: string;
  sessionIds: string[];
  totalHours: number | null;
  rate: number | null;
  total: number;
  status: 'paid' | 'unpaid';
  paidDate: string | null;
  imported?: boolean;
  /**
   * The customer as printed when the invoice was issued. An invoice is a
   * document about a past transaction: editing the client record afterwards
   * must not rewrite what was sent.
   */
  clientName?: string;
  clientAddress?: string;
  clientTaxNumber?: string;
  /**
   * Raised on somebody else's behalf: the whole amount is revenue here, but
   * only `keep` was earned here — the rest was handed over in cash.
   */
  passthrough?: { forWhom: string; keep: number; handOver: number } | null;
}

export interface AppData {
  profile: Profile;
  clients: Client[];
  sessions: Session[];
  invoices: Invoice[];
}

export type TabName = 'track' | 'clients' | 'invoices' | 'tax';

/*
 * What the tax module answers, as the API sends it. Money is euros here, as
 * everywhere in the interface; the engines work in cents behind the API.
 */

export interface ContributionMonth {
  id: string | null;
  year: number;
  month: number;
  base: number;
  total: number;
  source: 'estimated' | 'filed';
  estimated: boolean;
  breakdown: { piz: number; zzDo: number; stv: number; zap: number };
  payment: Record<'piz' | 'zzDo' | 'stv' | 'zap', { iban: string; reference: string }> | null;
  /** What has been paid against this month, per group. */
  settled: { paid: number; groups: Record<'piz' | 'zzDo' | 'stv' | 'zap', boolean> };
  /**
   * Set when a settled month was paid at something other than the figure the
   * app expected — the app's cue that its inputs need correcting.
   */
  mismatch: { expected: number; paid: number; difference: number } | null;
}

export interface TaxSummary {
  year: number;
  figuresFromYear: number;
  /** What the profile still owes the calculation; empty when it can proceed. */
  needs: string[];
  thisMonth: {
    month: number;
    /** What is still owed for that month, not what the month cost. */
    contributions: number | null;
    contributionsSettled: boolean;
    recommendedDohodnina: number;
    total: number;
  };
  contributions: {
    /** False until the business start date is known. */
    configured: boolean;
    /** The month whose contributions are owed — the last one to have ended. */
    dueMonth: number | null;
    /** True when the whole year predates the business, so nothing was owed. */
    beforeBusiness: boolean;
    businessStartDate: string | null;
    /** A popoldanski s.p. pays a flat pavšal the engine does not model. */
    estimateUnavailable: boolean;
    /** True when the month being asked about has already been settled. */
    dueSettled: boolean;
    monthlyAmount: number | null;
    breakdown: { piz: number; zzDo: number; stv: number; zap: number } | null;
    relief: number;
    nextReliefChange: { onIso: string; relief: number } | null;
    paidThisYear: number;
    dueThisYear: number;
    estimated: boolean;
  };
  dohodnina: {
    ytdRevenue: number;
    /** Issued but unpaid, and the tax they will add once they land. */
    outstanding: { count: number; amount: number; taxIfPaid: number };
    base: number;
    marginalRate: number;
    effectiveRate: number;
    owedToDate: number;
    paidToDate: number;
    recommendedNow: number;
    iban: string;
    reference: string;
  };
  /** Where the year lands if the average month repeats, with its working. */
  projection: {
    received: number;
    outstanding: number;
    committed: number;
    monthlyAverage: number;
    monthsTraded: number;
    monthsRemaining: number;
    projected: number;
    projectedTax: number;
  };
  officialInstallment: { amount: number; frequency: 'monthly' | 'quarterly' | null } | null;
  partialYear: { businessStartDate: string; monthsCovered: number } | null;
  assessment: { assessed: number; receivedOn: string; note: string; paid: number; balance: number } | null;
}

export interface TrajectoryPoint {
  date: string;
  cumulativeRevenue: number;
  taxOwed: number;
  number: string;
}

export interface Trajectory {
  year: number;
  yearStart: string;
  yearEnd: string;
  paidSeries: TrajectoryPoint[];
  invoicedSeries: TrajectoryPoint[];
  outstanding: number;
  thresholds: { amount: number; label: string; crossedOn: string | null }[];
}

export interface TaxPayment {
  id: string;
  paidOn: string;
  amount: number;
  kind: 'contributions' | 'income_tax' | 'other';
  note: string;
  /** Which period and group it settles, when it settles one in particular. */
  periodYear: number | null;
  periodMonth: number | null;
  groupKey: 'piz' | 'zz_do' | 'stv' | 'zap' | null;
}

export interface EarningsWindow {
  key: string;
  label: string;
  fromIso: string;
  toIso: string;
  /** What was earned here — a pass-through counts only for its kept share. */
  gross: number;
  /** Invoiced for others and handed on: taxed here, not earned here. */
  carried: number;
  /** Earned here without hours behind it — a fixed fee, a one-off. */
  flat: number;
  contributions: number;
  dohodnina: number;
  net: number;
  hours: number;
  effectiveRate: number | null;
  thin: boolean;
}

export interface Earnings {
  basis: 'payment' | 'service';
  today: string;
  windows: EarningsWindow[];
  clients: {
    clientId: string;
    name: string;
    gross: number;
    /** The part of `gross` that was not charged by the hour. */
    flat: number;
    hours: number;
    effectiveRate: number | null;
  }[];
}
