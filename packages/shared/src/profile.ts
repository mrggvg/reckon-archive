import { z } from 'zod';
import { taxNumberSchema } from './client';

/**
 * The issuer's own details — the "Izvajalec" half of every invoice.
 *
 * ZDDV-1 article 82 requires the taxable person's name and address; article 141
 * of the implementing regulation covers what a small taxpayer (mali davčni
 * zavezanec) must show. Everything beyond that — matična številka, place of
 * issue — is convention, and marked optional here.
 *
 * Formats verified: a Slovenian IBAN is 19 characters and passes ISO 13616
 * mod-97; a davčna številka is 8 digits whose last is a check digit.
 */

/** Slovenian IBAN: SI56 plus 15 digits. */
const SI_IBAN = /^SI56\d{15}$/;

/** ISO 13616: move the first four characters to the end, then mod 97 must be 1. */
function mod97(iban: string): number {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const expanded = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let remainder = 0;
  for (const digit of expanded) remainder = (remainder * 10 + Number(digit)) % 97;
  return remainder;
}

export const ibanSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s+/g, '').toUpperCase())
  .refine((v) => SI_IBAN.test(v), {
    message: 'Slovenski IBAN je SI56 in 15 številk',
  })
  .refine((v) => mod97(v) === 1, {
    message: 'Kontrolni števki IBAN se ne ujemata — preverite vnos',
  });

/** Matična številka: 7 digits, or 10 with the 3-digit unit suffix. */
export const regNumberSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s+/g, ''))
  .refine((v) => v === '' || /^\d{7}(\d{3})?$/.test(v), {
    message: 'Matična številka ima 7 mest ali 10 s končnico enote',
  });

/** Invoice numbering the app continues from, e.g. 003/2026. */
export const invoiceNumberSchema = z
  .string()
  .trim()
  .refine((v) => v === '' || /^\d+\s*\/\s*\d{4}$/.test(v), {
    message: 'Uporabite obliko NNN/LLLL, npr. 003/2026',
  });

export const profileSchema = z
  .object({
    name: z.string().trim().min(1, 'Ime, kot je na računih, je obvezno'),

    street: z.string().trim().min(1, 'Ulica in hišna številka sta obvezni'),
    postalCode: z
      .string()
      .trim()
      .refine((v) => /^[1-9]\d{3}$/.test(v), {
        message: 'Poštna številka ima 4 mesta, npr. 6000',
      }),
    city: z.string().trim().min(1, 'Kraj je obvezen'),

    taxNumber: taxNumberSchema,
    regNumber: regNumberSchema,

    // Needed for the payment line and the UPN QR code.
    iban: ibanSchema,

    /**
     * Name on the bank account. An s.p. may legitimately be paid into a
     * personal account, and the bank matches the UPN against the account
     * holder — not the firma. Blank means "same as the name above".
     * 33 characters is the UPN field width.
     */
    accountHolder: z
      .string()
      .trim()
      .max(33, 'Ime imetnika lahko obsega največ 33 znakov')
      // Defaulted, so a profile saved before this field existed still parses.
      .default(''),


    vatPayer: z.enum(['DA', 'NE']),


    defaultDesc: z.string().trim(),
    nextInvoiceNumber: invoiceNumberSchema,
    placeOfIssue: z.string().trim(),
    vatClause: z.string().trim(),
  })
  .superRefine((v, ctx) => {
    // A non-VAT-payer's invoice is expected to say why no VAT is charged.
    if (v.vatPayer === 'NE' && v.vatClause === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['vatClause'],
        message: 'Obvezna, dokler niste zavezanec za DDV — natisne se na vsak račun',
      });
    }
  });

export type ProfileInput = z.infer<typeof profileSchema>;
