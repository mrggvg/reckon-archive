import { parseAddressLine } from '@reckon/shared';
import type { AppData, Client, Profile } from './types';

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

/**
 * Clients saved before the address was split still carry a single line, and
 * those saved before clients could be deactivated carry no flag — a backup
 * that predates a column restores as though the column had always said yes.
 */
function migrateClient(c: Client & { address?: string }): Client {
  const withFlag: Client & { address?: string } = { ...c, isActive: c.isActive ?? true };
  if (withFlag.street !== undefined) return withFlag;
  const { address, ...rest } = withFlag;
  return { ...rest, ...parseAddressLine(address ?? '') };
}

