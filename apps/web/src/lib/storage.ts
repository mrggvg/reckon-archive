import { parseAddressLine } from '@reckon/shared';
import type { AppData, Client, Profile } from './types';

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
  street: '',
  postalCode: '',
  city: '',
  taxNumber: '',
  regNumber: '',
  iban: '',
  accountHolder: '',
  vatPayer: 'NE',
  defaultDesc: '',
  nextInvoiceNumber: '',
  placeOfIssue: '',
  vatClause: DEFAULT_VAT_CLAUSE,
};

export function emptyData(): AppData {
  return {
    profile: { ...emptyProfile },
    clients: [],
    sessions: [],
    invoices: [],
  };
}

/** Fill in anything a stored/restored payload is missing. */
export function normalize(raw: unknown): AppData {
  const base = emptyData();
  if (!raw || typeof raw !== 'object') return base;
  const d = raw as Partial<AppData>;
  return {
    profile: migrateProfile({ ...base.profile, ...(d.profile ?? {}) }),
    clients: (d.clients ?? []).map(migrateClient),
    sessions: d.sessions ?? [],
    invoices: d.invoices ?? [],
  };
}

/** Profiles saved before the address was split still carry a single line. */
function migrateProfile(
  p: Profile & { address?: string; lastInvoiceNumber?: string },
): Profile {
  let out = p;

  // The field used to hold the last number issued; it now holds the next one.
  if (out.lastInvoiceNumber !== undefined) {
    const { lastInvoiceNumber, ...rest } = out;
    const parsed = /^(\d+)\s*\/\s*(\d{4})$/.exec(lastInvoiceNumber.trim());
    out = {
      ...rest,
      nextInvoiceNumber:
        out.nextInvoiceNumber ||
        (parsed
          ? `${String(Number(parsed[1]) + 1).padStart(3, '0')}/${parsed[2]}`
          : ''),
    } as Profile & { address?: string };
  }

  if (!out.address) return out;
  const { address, ...rest } = out;
  return { ...rest, ...parseAddressLine(address) };
}

/** Clients saved before the address was split still carry a single line. */
function migrateClient(c: Client & { address?: string }): Client {
  if (c.street !== undefined) return c;
  const { address, ...rest } = c;
  return { ...rest, ...parseAddressLine(address ?? '') };
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
