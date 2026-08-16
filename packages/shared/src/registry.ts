import { parseAddressLine } from './client.js';

/**
 * Turning what a public register says into what an invoice needs.
 *
 * The registers answer in their own house style — VIES shouts everything in
 * capitals and writes the bilingual form of a municipality's name — and an
 * invoice is a document a person reads. These are the adjustments, kept pure
 * and in one place so the same result can be asserted in a test without a
 * network.
 */

export interface RegistryCompany {
  name: string;
  street: string;
  postalCode: string;
  city: string;
  taxNumber: string;
  /** Which register answered, so the interface can say. */
  source: 'ajpes' | 'vies';
}

/** Legal forms stay lower case however the register writes them. */
const LEGAL_FORMS = new Set([
  'd.o.o.',
  'd.d.',
  'd.n.o.',
  'k.d.',
  'k.d.d.',
  's.p.',
  'z.o.o.',
  'zavod',
]);

const SMALL_WORDS = new Set(['in', 'na', 'za', 'pri', 'ob', 'pod', 'nad']);

/**
 * `VIKRAM D.O.O.` → `Vikram d.o.o.`
 *
 * Only when the register shouted: a name that already has mixed case is
 * somebody's considered spelling and is left exactly as it is.
 */
export function tidyRegistryName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name !== name.toUpperCase()) return name;

  return name
    .split(' ')
    .map((word, i) => {
      const lower = word.toLowerCase();
      // The register writes `PETROL D.D., LJUBLJANA` — the legal form arrives
      // with the comma attached, so match on the word without its punctuation.
      const bare = lower.replace(/[,;]+$/, '');
      const tail = lower.slice(bare.length);
      if (LEGAL_FORMS.has(bare)) return bare + tail;
      if (i > 0 && SMALL_WORDS.has(bare)) return lower;
      // A hyphenated name capitalises on both sides: MARIBOR-TEZNO.
      return lower
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('-');
    })
    .join(' ');
}

/**
 * Streets and places, which capitalise differently from company names.
 *
 * Slovenian writes `Vojkovo nabrežje`, `Novo mesto`, `Trg republike` — the
 * first word capitalised and the rest lower, not every word. So this is
 * sentence case per segment, where a segment is a half of a bilingual name:
 * `KOPER - CAPODISTRIA` keeps both capitals.
 *
 * It is wrong for the minority that carry a second proper noun — `Slovenj
 * Gradec` comes back as `Slovenj gradec` — which is why the result lands in an
 * editable field rather than straight on an invoice.
 */
export function tidyPlaceName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name !== name.toUpperCase()) return name;

  // Each part of `DUNAJSKA CESTA 050, LJUBLJANA` and each half of a bilingual
  // `KOPER - CAPODISTRIA` is its own name and gets its own capital.
  return name
    .split(/(,\s*|\s+-\s+)/)
    .map((segment, i) => {
      if (i % 2 === 1) return segment; // the separator itself
      const words = segment.toLowerCase().split(' ');
      return words
        .map((word, w) => {
          // A house number's letter is written large: 31 A, not 31 a.
          if (/^[\p{L}]$/u.test(word)) return word.toUpperCase();
          if (w > 0) return word;
          return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ');
    })
    .join('');
}

/**
 * `VOJKOVO NABREŽJE 31 A, 6000 KOPER - CAPODISTRIA` → its three parts.
 *
 * Bilingual municipality names keep both halves: that is the official name of
 * the place, and an invoice may as well use it.
 */
export function parseRegistryAddress(raw: string): {
  street: string;
  postalCode: string;
  city: string;
} {
  const line = raw.replace(/\s*\n\s*/g, ', ').replace(/\s+/g, ' ').trim();
  const parts = parseAddressLine(line);
  return {
    street: tidyPlaceName(parts.street),
    postalCode: parts.postalCode,
    city: tidyPlaceName(parts.city),
  };
}
