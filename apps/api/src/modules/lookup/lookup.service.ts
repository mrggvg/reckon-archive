import {
  parseRegistryAddress,
  taxNumberSchema,
  tidyPlaceName,
  tidyRegistryName,
  type RegistryCompany,
} from '@reckon/shared';
import { env } from '../../config/env.js';
import { AppError, NotFoundError, ValidationError } from '../../lib/AppError.js';

/**
 * Filling a client in from its tax number.
 *
 * Two registers, tried in order. AJPES holds every entity in the business
 * register but needs an account, a subscribed scheme and purchased query
 * units, so it is used only when those credentials are configured. VIES needs
 * nothing at all and covers every VAT-registered company, which is most of the
 * customers an invoice is addressed to. Whatever comes back is a suggestion:
 * the user sees it in the form and can change it before saving.
 */

const TIMEOUT_MS = 6000;

/** Registers are slow and repeat lookups are common; this is a short memory. */
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; company: RegistryCompany | null }>();

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

/** VIES: free, no account, VAT-registered entities only. */
async function fromVies(taxNumber: string): Promise<RegistryCompany | null> {
  const body = (await fetchJson(
    `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/SI/vat/${taxNumber}`,
  )) as { isValid?: boolean; name?: string; address?: string };

  if (!body.isValid || !body.name || body.name === '---') return null;

  return {
    name: tidyRegistryName(body.name),
    ...parseRegistryAddress(body.address ?? ''),
    taxNumber,
    source: 'vies',
  };
}

/** AJPES restPrsInfo: the whole business register, for accounts that have it. */
async function fromAjpes(taxNumber: string): Promise<RegistryCompany | null> {
  if (!env.AJPES_USER || !env.AJPES_PASSWORD || !env.AJPES_SCHEME) return null;

  const body = (await fetchJson('https://www.ajpes.si/restPrsInfo/find', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      uporabnik: env.AJPES_USER,
      geslo: env.AJPES_PASSWORD,
      shema: env.AJPES_SCHEME,
      davcna: taxNumber,
      maxRecords: 1,
    }),
  })) as {
    status?: number;
    payload?: {
      firma?: string;
      naziv?: string;
      ulica?: string;
      hisnaStevilka?: string;
      posta?: string;
      naselje?: string;
    }[];
  };

  // 2000 with an empty payload is the register's way of saying "no such thing".
  const hit = body.status === 2000 ? body.payload?.[0] : undefined;
  if (!hit) return null;

  const street = [hit.ulica, hit.hisnaStevilka].filter(Boolean).join(' ').trim();
  return {
    name: tidyRegistryName(hit.firma ?? hit.naziv ?? ''),
    street: tidyPlaceName(street),
    postalCode: (hit.posta ?? '').trim(),
    city: tidyPlaceName(hit.naselje ?? ''),
    taxNumber,
    source: 'ajpes',
  };
}

export const lookupService = {
  async company(rawTaxNumber: string): Promise<RegistryCompany> {
    // Checked here first: a mistyped number is the user's own typo, and asking
    // a register about it would be a slow way to find that out.
    const parsed = taxNumberSchema.safeParse(rawTaxNumber);
    if (!parsed.success) {
      throw new ValidationError({
        taxNumber: parsed.error.issues[0]?.message ?? 'Neveljavna davčna številka',
      });
    }
    const taxNumber = parsed.data;

    const cached = cache.get(taxNumber);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      if (!cached.company) throw new NotFoundError('Podjetja s to davčno številko ni v registru');
      return cached.company;
    }

    let company: RegistryCompany | null = null;
    try {
      company = (await fromAjpes(taxNumber)) ?? (await fromVies(taxNumber));
    } catch (err) {
      // A register being slow or down is not this app failing, and it must not
      // read like it: the form still works, it just wasn't filled in.
      console.error('registry lookup failed', err);
      throw new AppError(
        503,
        'Register trenutno ni dosegljiv — podatke lahko vnesete ročno',
      );
    }

    if (cache.size > 500) cache.clear();
    cache.set(taxNumber, { at: Date.now(), company });

    if (!company) {
      throw new NotFoundError('Podjetja s to davčno številko ni v registru');
    }
    return company;
  },
};
