import {
  parseRegistryAddress,
  splitPostalPlace,
  taxNumberSchema,
  tidyPlaceName,
  tidyRegistryName,
  unpadHouseNumber,
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

/** Collapses runs of whitespace that HTML treats as one. */
const squash = (v: string) => v.replace(/\s+/g, ' ').trim();

const stripTags = (v: string) =>
  squash(v.replace(/<[^>]+>/g, ' '))
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');

/**
 * Reads one search result out of a bizi.si results page.
 *
 * Anchored on what the cells *contain* rather than what order they come in:
 * the company name is the only `b-company-title`, the street is the only cell
 * with a map link, the post code is the cell beginning with four digits, and
 * the registration number is the ten-digit one. Columns can be reordered or
 * added without this noticing — and if the markup changes past recognition it
 * returns null, which the caller treats as "not found" rather than an error.
 */
export function parseBiziRow(page: string, taxNumber: string): RegistryCompany | null {
  // The row that carries this exact tax number, out of however many matched.
  const rows = page.split(/<div [^>]*Class="row b-table-row"/i).slice(1);
  const row = rows.find((r) => new RegExp(`>\\s*${taxNumber}\\s*<`).test(r));
  if (!row) return null;

  const name = /<span [^>]*b-company-title[^>]*>([\s\S]*?)<\/span>/i.exec(row);
  if (!name) return null;

  const cells = [...row.matchAll(/<div [^>]*b-table-cell[^>]*>([\s\S]*?)<\/div>/gi)].map(
    (m) => ({ html: m[1] as string, text: stripTags(m[1] as string) }),
  );

  const street = cells.find((c) => /openMapTis\(/i.test(c.html));
  const posta = cells.find((c) => /^\d{4}\s+\S/.test(c.text));
  const maticna = cells.find((c) => /^\d{10}$/.test(c.text));

  const place = splitPostalPlace(posta?.text ?? '');
  return {
    name: tidyRegistryName(stripTags(name[1] as string)),
    street: tidyPlaceName(unpadHouseNumber(squash(street?.text ?? ''))),
    postalCode: place.postalCode,
    city: place.city,
    taxNumber,
    regNumber: maticna?.text,
    source: 'bizi',
  };
}

async function fromBizi(taxNumber: string): Promise<RegistryCompany | null> {
  if (env.BIZI_FALLBACK === 'off') return null;

  const res = await fetch(`https://www.bizi.si/iskanje?q=${taxNumber}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    // Says who is calling, so the operator can see it isn't a harvester.
    headers: { 'User-Agent': 'Reckon/1.0 (+sole-trader ledger; one lookup per client)' },
  });
  if (!res.ok) return null;

  return parseBiziRow(await res.text(), taxNumber);
}

/** One row of `payload.formatted.prsData`, as restPrsInfo returns it. */
export interface AjpesRow {
  popolno_ime?: string;
  kratko_ime?: string;
  maticna?: string;
  ulica?: string;
  posta?: string;
  zbrisano?: string | null;
}

/**
 * An AJPES row as the client form wants it.
 *
 * `popolno_ime` is the registered name and the one that belongs on an invoice —
 * *Mia Erbus, računalniško programiranje, s.p.* rather than the short form.
 * Street and house number arrive as one field, and the post code and place as
 * another, so both need taking apart.
 */
export function mapAjpesRow(row: AjpesRow, taxNumber: string): RegistryCompany {
  const { postalCode, city } = splitPostalPlace(row.posta ?? '');
  return {
    name: tidyRegistryName(row.popolno_ime ?? row.kratko_ime ?? ''),
    street: tidyPlaceName(unpadHouseNumber((row.ulica ?? '').trim())),
    postalCode,
    city,
    taxNumber,
    regNumber: (row.maticna ?? '').trim() || undefined,
    source: 'ajpes',
  };
}

/** AJPES restPrsInfo: the whole business register, for accounts that have it. */
async function fromAjpes(taxNumber: string): Promise<RegistryCompany | null> {
  if (!env.AJPES_USER || !env.AJPES_PASSWORD || !env.AJPES_SCHEME) return null;

  const body = (await fetchJson('https://www.ajpes.si/restPrsInfo/find', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      // Credentials are nested under `ident`; the search terms sit beside it.
      ident: {
        uporabnik: env.AJPES_USER,
        geslo: env.AJPES_PASSWORD,
        shema: env.AJPES_SCHEME,
      },
      davcna: taxNumber,
      maxRecords: 1,
    }),
  })) as {
    status?: number;
    payload?: { formatted?: { prsData?: AjpesRow[] } };
  };

  // 2000 with nothing in the payload is the register saying "no such thing".
  const row = body.status === 2000 ? body.payload?.formatted?.prsData?.[0] : undefined;
  // A struck-off entity is not somebody to address an invoice to.
  if (!row || row.zbrisano) return null;

  return mapAjpesRow(row, taxNumber);
}

/**
 * Why nothing was found, said accurately.
 *
 * With AJPES configured the whole business register was searched, so absence
 * means absence. Without it only VIES was asked, and VIES only knows entities
 * registered for VAT — which most one-person s.p.s are not. Saying "not in the
 * register" there would be wrong and would send the user looking for a problem
 * that isn't theirs.
 */
function notFound(): NotFoundError {
  const wholeRegister =
    Boolean(env.AJPES_USER && env.AJPES_PASSWORD && env.AJPES_SCHEME) ||
    env.BIZI_FALLBACK === 'on';
  return new NotFoundError(
    wholeRegister
      ? 'Tega subjekta ni v poslovnem registru'
      : 'V registru DDV ga ni — če niste zavezanec za DDV, vnesite podatke ročno',
  );
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
      if (!cached.company) throw notFound();
      return cached.company;
    }

    let company: RegistryCompany | null = null;
    try {
      // Official sources first; bizi is the one that knows the rest.
      company =
        (await fromAjpes(taxNumber)) ??
        (await fromVies(taxNumber)) ??
        (await fromBizi(taxNumber));
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

    if (!company) throw notFound();
    return company;
  },
};
