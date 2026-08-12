import type { AppData, Profile } from './types';

/** Pre-auth key, from when the app was single-user and browser-local. */
const LEGACY_KEY = 'delovnik-data-v1';

/** Data is namespaced per account so a shared browser can't cross accounts. */
export function storeKey(userId: string): string {
  return `reckon:${userId}:data-v1`;
}

export const DEFAULT_VAT_CLAUSE =
  'Nisem zavezanec za DDV po 1. odstavku 94. člena ZDDV-1.';

export const emptyProfile: Profile = {
  name: '',
  address: '',
  taxNumber: '',
  regNumber: '',
  iban: '',
  taxRate: 4,
  vatPayer: 'NE',
  taxSystem: 'normiranec',
  monthlyContribution: 0,
  defaultDesc: '',
  lastInvoiceNumber: '',
  placeOfIssue: '',
  vatClause: DEFAULT_VAT_CLAUSE,
};

export function emptyData(): AppData {
  return {
    profile: { ...emptyProfile },
    clients: [],
    sessions: [],
    invoices: [],
    taxPayments: [],
    taxAssessments: [],
  };
}

/** Fill in anything a stored/restored payload is missing. */
export function normalize(raw: unknown): AppData {
  const base = emptyData();
  if (!raw || typeof raw !== 'object') return base;
  const d = raw as Partial<AppData>;
  return {
    profile: { ...base.profile, ...(d.profile ?? {}) },
    clients: d.clients ?? [],
    sessions: d.sessions ?? [],
    invoices: d.invoices ?? [],
    taxPayments: d.taxPayments ?? [],
    taxAssessments: d.taxAssessments ?? [],
  };
}

export function loadData(userId: string): AppData {
  try {
    const raw = localStorage.getItem(storeKey(userId));
    if (raw) return normalize(JSON.parse(raw));

    // One-time adoption: a ledger created before accounts existed belongs to
    // whoever signs in on this browser first. It is moved, not copied.
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const adopted = normalize(JSON.parse(legacy));
      localStorage.setItem(storeKey(userId), JSON.stringify(adopted));
      localStorage.removeItem(LEGACY_KEY);
      return adopted;
    }
    return emptyData();
  } catch {
    return emptyData();
  }
}

export function saveData(userId: string, data: AppData): boolean {
  try {
    localStorage.setItem(storeKey(userId), JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function uid(prefix: string): string {
  return (
    prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
  );
}
