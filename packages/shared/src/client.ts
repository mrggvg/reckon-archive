import { z } from 'zod';

/**
 * What an invoice has to say about the customer.
 *
 * ZDDV-1 article 82 requires only the client's *name and address* ("ime in
 * naslov davčnega zavezanca in njegovega kupca ali naročnika"). The client's
 * VAT ID is required only when the buyer owes the VAT under reverse charge —
 * a cross-border case that can't arise for a domestic, non-VAT-registered
 * freelancer, so there is no VAT ID field here at all.
 *
 * The davčna številka isn't in that legal minimum either, but every Slovenian
 * invoicing tool prints it and every bookkeeper expects it for matching an
 * invoice to their supplier records. It's required here as practice, not law.
 *
 * The address is captured in parts and joined for printing, so each piece can
 * be checked on its own — a postal code that isn't four digits is a typo worth
 * catching before it reaches an invoice.
 */

/** Davčna številka: exactly 8 digits, first non-zero, last a check digit. */
export const TAX_NUMBER_LENGTH = 8;
const TAX_NUMBER = /^[1-9]\d{7}$/;

/**
 * Weighted mod-11 over the first seven digits. Verified against two real
 * numbers; a remainder giving 10 or 11 means the check digit is 0.
 */
function hasValidTaxCheckDigit(v: string): boolean {
  const digits = v.split('').map(Number);
  const sum = [8, 7, 6, 5, 4, 3, 2].reduce(
    (total, weight, i) => total + weight * (digits[i] as number),
    0,
  );
  let check = 11 - (sum % 11);
  if (check >= 10) check = 0;
  return check === digits[7];
}

/** Slovenian poštna številka: exactly 4 digits, first one non-zero. */
export const POSTAL_CODE_LENGTH = 4;
const POSTAL_CODE = /^[1-9]\d{3}$/;

/** Digits, spaces and the usual separators, with at least 6 digits in there. */
const PHONE = /^\+?[\d\s/().-]{6,}$/;

export const taxNumberSchema = z
  .string()
  .trim()
  // "SI29825962" and "298 259 62" are the same number written differently.
  .transform((v) => v.replace(/\s+/g, '').toUpperCase().replace(/^SI/, ''))
  .refine((v) => TAX_NUMBER.test(v), {
    message: `Davčna številka ima ${TAX_NUMBER_LENGTH} mest, npr. 29825962`,
  })
  .refine((v) => hasValidTaxCheckDigit(v), {
    message: 'Kontrolna števka davčne številke se ne ujema — preverite vnos',
  });

export const postalCodeSchema = z
  .string()
  .trim()
  .refine((v) => POSTAL_CODE.test(v), {
    message: `Poštna številka ima ${POSTAL_CODE_LENGTH} mesta, npr. 6000`,
  });

export const clientSchema = z.object({
  name: z.string().trim().min(1, 'Naziv podjetja je obvezen'),

  // Address parts — required together, since the whole line is printed.
  street: z.string().trim().min(1, 'Ulica in hišna številka sta obvezni'),
  postalCode: postalCodeSchema,
  city: z.string().trim().min(1, 'Kraj je obvezen'),

  taxNumber: taxNumberSchema,

  // Not a legal field: hours can't be turned into money without it.
  rate: z
    .number({ message: 'Vnesite urno postavko' })
    .positive('Urna postavka mora biti večja od 0'),

  email: z.union([z.literal(''), z.email('Vnesite veljaven e-poštni naslov')]),

  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || PHONE.test(v), {
      message: 'Vnesite veljavno telefonsko številko, npr. +386 41 234 567',
    }),
});

export type ClientInput = z.infer<typeof clientSchema>;

/** The single line that goes on an invoice: "Vojkovo nabrežje 31a, 6000 Koper". */
export function formatAddress(a: {
  street?: string;
  postalCode?: string;
  city?: string;
}): string {
  const locality = [a.postalCode, a.city].filter(Boolean).join(' ');
  return [a.street, locality].filter(Boolean).join(', ');
}

/**
 * Splits an address typed as one line back into parts, for records created
 * before the form had separate fields. Anything it can't read stays in the
 * street, where it's visible and fixable rather than silently dropped.
 */
export function parseAddressLine(line: string): {
  street: string;
  postalCode: string;
  city: string;
} {
  const trimmed = (line ?? '').trim();
  if (!trimmed) return { street: '', postalCode: '', city: '' };

  const cut = trimmed.lastIndexOf(',');
  if (cut === -1) return { street: trimmed, postalCode: '', city: '' };

  const street = trimmed.slice(0, cut).trim();
  const locality = trimmed.slice(cut + 1).trim();
  const match = /^(\d{4})\s+(.+)$/.exec(locality);
  if (!match) return { street: trimmed, postalCode: '', city: '' };

  return { street, postalCode: match[1] as string, city: (match[2] as string).trim() };
}

/** Field-keyed messages, ready to hang under the inputs that produced them. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    out[key] ??= issue.message;
  }
  return out;
}
