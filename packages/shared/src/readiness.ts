import { taxNumberSchema } from './client.js';
import { ibanSchema } from './profile.js';

export interface MissingField {
  /** Matches the profile form's field id, so the message can point at it. */
  key: string;
  label: string;
}

interface IssuerLike {
  name: string;
  street: string;
  postalCode: string;
  city: string;
  taxNumber: string;
  iban: string;
  vatPayer: 'DA' | 'NE';
  vatClause: string;
}

/**
 * Everything an invoice needs from the issuer before it can legally be one.
 *
 * Name and address come from ZDDV-1 article 82; the davčna številka is the
 * practice every bookkeeper expects; the IBAN is what the client actually pays
 * into and what the UPN QR encodes; and a non-VAT-payer has to say why no VAT
 * is charged. Anything missing here would produce a document that looks like an
 * invoice but isn't one, so the app refuses to make it.
 */
export function invoiceReadiness(p: IssuerLike): {
  ready: boolean;
  missing: MissingField[];
} {
  const missing: MissingField[] = [];
  const need = (ok: boolean, key: string, label: string) => {
    if (!ok) missing.push({ key, label });
  };

  need(p.name.trim() !== '', 'name', 'Ime oziroma naziv izdajatelja');
  need(p.street.trim() !== '', 'street', 'Ulica in hišna številka');
  need(p.postalCode.trim() !== '', 'postalCode', 'Poštna številka');
  need(p.city.trim() !== '', 'city', 'Kraj');
  // Format matters as much as presence: a mistyped IBAN can't be paid.
  need(taxNumberSchema.safeParse(p.taxNumber).success, 'taxNumber', 'Davčna številka');
  need(ibanSchema.safeParse(p.iban).success, 'iban', 'TRR (IBAN)');
  need(
    p.vatPayer === 'DA' || p.vatClause.trim() !== '',
    'vatClause',
    'Klavzula DDV',
  );

  return { ready: missing.length === 0, missing };
}
