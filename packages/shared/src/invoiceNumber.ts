/**
 * Invoice numbering, defined once for both sides.
 *
 * The browser shows the number a new invoice *would* get; the server decides
 * the number it actually gets, under a unique constraint. Both have to agree on
 * the rule, so the rule lives here rather than in either of them.
 */

export interface ParsedInvoiceNumber {
  seq: number;
  year: number;
}

/** NNN/YYYY, tolerating spaces around the slash. */
export function parseInvoiceNumber(
  str: string | null | undefined,
): ParsedInvoiceNumber | null {
  const m = /^(\d+)\s*\/\s*(\d{4})$/.exec((str ?? '').trim());
  if (!m) return null;
  return { seq: parseInt(m[1] as string, 10), year: parseInt(m[2] as string, 10) };
}

/** The canonical written form: three digits, a slash, the year. */
export function formatInvoiceNumber(seq: number, year: number): string {
  return `${String(seq).padStart(3, '0')}/${year}`;
}

/**
 * The next number in the series for the year an invoice is issued in.
 *
 * The ledger is the authority: one past the highest number recorded for that
 * year. Nothing else is remembered, so deleting the newest invoice hands its
 * number straight back to the next one — which is the point. The cost is real
 * and is the user's to carry: if the deleted invoice had already gone out, two
 * different documents end up under one number, so the app says so before it
 * deletes anything.
 *
 * `declaredNext` is the profile's "next invoice number" and only opens the
 * year: an s.p. who issued 001 and 002 by hand before adopting the app starts
 * at 003. Once the year has an invoice in it, the ledger takes over.
 */
export function nextInvoiceNumber(
  existingNumbers: string[],
  declaredNext: string,
  issueDateIso: string,
): string {
  const year = Number(issueDateIso.slice(0, 4));
  let maxSeq = 0;
  for (const number of existingNumbers) {
    const parsed = parseInvoiceNumber(number);
    if (parsed && parsed.year === year) maxSeq = Math.max(maxSeq, parsed.seq);
  }
  if (maxSeq > 0) return formatInvoiceNumber(maxSeq + 1, year);

  const declared = parseInvoiceNumber(declaredNext);
  return formatInvoiceNumber(
    declared && declared.year === year ? declared.seq : 1,
    year,
  );
}

/** NNN/YYYY as a sortable integer, newest last. */
export function invoiceSortKey(number: string): number {
  const parsed = parseInvoiceNumber(number);
  return parsed ? parsed.year * 1000 + parsed.seq : 0;
}
