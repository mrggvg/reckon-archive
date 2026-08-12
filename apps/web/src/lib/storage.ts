import type { AppData, Profile } from './types';

export const STORE_KEY = 'delovnik-data-v1';

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

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return emptyData();
    return normalize(JSON.parse(raw));
  } catch {
    return emptyData();
  }
}

export function saveData(data: AppData): boolean {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
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
