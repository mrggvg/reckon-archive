import { z } from 'zod';

/**
 * The shapes that travel between the browser and the API.
 *
 * These are the write schemas: what a caller may send. The server validates
 * every request against them and the browser validates the same forms before
 * sending, so a rule can't hold on one side and not the other.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum mora biti v obliki LLLL-MM-DD');

const clockTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Ura mora biti v obliki HH:MM');

/**
 * A uuid as Postgres stores one: 32 hex digits in the usual grouping.
 *
 * Deliberately not `z.uuid()`, which enforces the RFC's version and variant
 * bits. Postgres accepts any well-formed uuid, so a row whose id it accepted
 * must be addressable through the API — anything stricter here would make
 * records that exist impossible to reach.
 */
const uuid = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'Neveljaven identifikator',
  );

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const sessionInputSchema = z
  .object({
    clientId: uuid,
    date: isoDate,
    start: clockTime,
    end: clockTime,
    note: z.string().trim().max(500, 'Zaznamek lahko obsega največ 500 znakov'),
  })
  // A shift may cross midnight, so end < start is legal; end == start is not,
  // because a session of zero minutes records nothing.
  .refine((v) => v.start !== v.end, {
    path: ['end'],
    message: 'Konec ne more biti enak začetku',
  });

export type SessionInput = z.infer<typeof sessionInputSchema>;

/** Generating an invoice from tracked hours: the server prices it, not the caller. */
export const invoiceGenerateSchema = z
  .object({
    clientId: uuid,
    sessionIds: z.array(uuid).min(1, 'Izberite vsaj en vnos ur'),
    issueDate: isoDate,
    dueDate: isoDate,
    description: z.string().trim().max(300),
  })
  .refine((v) => v.dueDate >= v.issueDate, {
    path: ['dueDate'],
    message: 'Rok plačila ne more biti pred datumom izdaje',
  });

export type InvoiceGenerateInput = z.infer<typeof invoiceGenerateSchema>;

/** Recording an invoice issued outside the app: the caller states the total. */
export const invoiceImportSchema = z
  .object({
    number: z
      .string()
      .trim()
      .regex(/^\d+\s*\/\s*\d{4}$/, 'Uporabite obliko NNN/LLLL, npr. 003/2026'),
    clientId: uuid,
    issueDate: isoDate,
    dueDate: isoDate,
    description: z.string().trim().max(300),
    periodStart: isoDate,
    periodEnd: isoDate,
    total: z.number().nonnegative('Znesek ne more biti negativen'),
    status: z.enum(['unpaid', 'paid']),
    paidDate: isoDate.nullable(),
  })
  .refine((v) => v.dueDate >= v.issueDate, {
    path: ['dueDate'],
    message: 'Rok plačila ne more biti pred datumom izdaje',
  })
  .refine((v) => v.periodEnd >= v.periodStart, {
    path: ['periodEnd'],
    message: 'Konec obdobja ne more biti pred začetkom',
  })
  .refine((v) => (v.status === 'paid') === (v.paidDate !== null), {
    path: ['paidDate'],
    message: 'Plačan račun potrebuje datum plačila',
  });

export type InvoiceImportInput = z.infer<typeof invoiceImportSchema>;

/**
 * Editing an issued invoice.
 *
 * Every field is optional because the form sends only what it lets you change:
 * a generated invoice's client, period and total come from its linked hours and
 * are refused here, while an imported one has no hours to contradict.
 */
export const invoiceEditSchema = z.object({
  number: z
    .string()
    .trim()
    .regex(/^\d+\s*\/\s*\d{4}$/, 'Uporabite obliko NNN/LLLL, npr. 003/2026')
    .optional(),
  clientId: uuid.optional(),
  issueDate: isoDate.optional(),
  dueDate: isoDate.optional(),
  description: z.string().trim().max(300).optional(),
  periodStart: isoDate.optional(),
  periodEnd: isoDate.optional(),
  total: z.number().nonnegative().optional(),
});

export type InvoiceEditInput = z.infer<typeof invoiceEditSchema>;

export const invoicePaymentSchema = z.object({
  paid: z.boolean(),
  paidDate: isoDate.nullable(),
});

export type InvoicePaymentInput = z.infer<typeof invoicePaymentSchema>;
