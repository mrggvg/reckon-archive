import { z } from 'zod';
import { clientSchema, formatAddress, toCents } from '@reckon/shared';
import { withTransaction } from '../../db/tx.js';
import { profileRepo } from '../profile/profile.repo.js';

/**
 * What a backup file may contain.
 *
 * Deliberately more forgiving than the write schemas the forms use: a file
 * written months ago must still restore, so anything the current rules would
 * reject is repaired rather than refused — a client whose tax number no longer
 * validates comes back with the rest of its details intact, to be corrected in
 * the app. Only the structure is mandatory.
 */
const backupClient = clientSchema.partial().extend({
  id: z.string().min(1),
  name: z.string().trim().min(1),
});

const backupSession = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1).nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  note: z.string().optional(),
  invoiceId: z.string().min(1).nullable().optional(),
});

const backupInvoice = z.object({
  id: z.string().min(1),
  number: z.string().min(1),
  clientId: z.string().min(1).nullable().optional(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().optional(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalHours: z.number().nullable().optional(),
  rate: z.number().nullable().optional(),
  total: z.number().nonnegative(),
  status: z.enum(['unpaid', 'paid']),
  paidDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  imported: z.boolean().optional(),
  clientName: z.string().optional(),
  clientAddress: z.string().optional(),
  clientTaxNumber: z.string().optional(),
});

/**
 * The profile as a backup carries it: every field optional and unvalidated.
 * A file written before a rule existed still has to restore; the form is where
 * the rules are enforced, and the readiness banner is what asks for the gaps.
 */
const backupProfile = z.object({
  name: z.string().optional(),
  street: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  taxNumber: z.string().optional(),
  regNumber: z.string().optional(),
  iban: z.string().optional(),
  accountHolder: z.string().optional(),
  vatPayer: z.enum(['DA', 'NE']).optional(),
  defaultDesc: z.string().optional(),
  nextInvoiceNumber: z.string().optional(),
  placeOfIssue: z.string().optional(),
  vatClause: z.string().optional(),
});

export const restoreSchema = z.object({
  profile: backupProfile.optional(),
  clients: z.array(backupClient).default([]),
  sessions: z.array(backupSession).default([]),
  invoices: z.array(backupInvoice).default([]),
});

export type RestoreInput = z.infer<typeof restoreSchema>;

export const dataService = {
  async restore(userId: string, backup: RestoreInput) {
    await withTransaction(async (tx) => {
      // Order matters: hours reference invoices and clients.
      await tx.query('DELETE FROM work_sessions WHERE user_id = $1', [userId]);
      await tx.query('DELETE FROM invoices WHERE user_id = $1', [userId]);
      await tx.query('DELETE FROM clients WHERE user_id = $1', [userId]);

      const p = backup.profile;
      if (p) {
        await profileRepo.save(userId, {
          name: p.name ?? '',
          street: p.street ?? '',
          postalCode: p.postalCode ?? '',
          city: p.city ?? '',
          taxNumber: p.taxNumber ?? '',
          regNumber: p.regNumber ?? '',
          iban: p.iban ?? '',
          accountHolder: p.accountHolder ?? '',
          vatPayer: p.vatPayer ?? 'NE',
          defaultDesc: p.defaultDesc ?? '',
          nextInvoiceNumber: p.nextInvoiceNumber ?? '',
          placeOfIssue: p.placeOfIssue ?? '',
          vatClause: p.vatClause ?? '',
        });
      }

      // Old id → new id, so the links inside the file survive the remapping.
      const clientIds = new Map<string, string>();
      for (const c of backup.clients) {
        const { rows } = await tx.query<{ id: string }>(
          `INSERT INTO clients
             (user_id, company_name, street, postal_code, city, tax_number,
              rate_cents, email, phone)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
          [
            userId, c.name, c.street ?? '', c.postalCode ?? '', c.city ?? '',
            c.taxNumber ?? '', toCents(c.rate ?? 0), c.email ?? '', c.phone ?? '',
          ],
        );
        clientIds.set(c.id, (rows[0] as { id: string }).id);
      }

      const invoiceIds = new Map<string, string>();
      for (const inv of backup.invoices) {
        const clientId = inv.clientId ? (clientIds.get(inv.clientId) ?? null) : null;
        const source = backup.clients.find((c) => c.id === inv.clientId);
        const { rows } = await tx.query<{ id: string }>(
          `INSERT INTO invoices
             (user_id, client_id, number, issue_date, due_date, description,
              period_start, period_end, total_cents, total_minutes, rate_cents,
              status, paid_on, imported, client_name, client_address,
              client_tax_number)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
           RETURNING id`,
          [
            userId, clientId, inv.number, inv.issueDate, inv.dueDate,
            inv.description || 'Storitve', inv.periodStart, inv.periodEnd,
            toCents(inv.total),
            inv.totalHours == null ? null : Math.round(inv.totalHours * 60),
            inv.rate == null ? null : toCents(inv.rate),
            inv.status, inv.paidDate ?? null, inv.imported ?? false,
            inv.clientName ?? source?.name ?? '',
            inv.clientAddress ??
              (source
                ? formatAddress({
                    street: source.street,
                    postalCode: source.postalCode,
                    city: source.city,
                  })
                : ''),
            inv.clientTaxNumber ?? source?.taxNumber ?? '',
          ],
        );
        invoiceIds.set(inv.id, (rows[0] as { id: string }).id);
      }

      for (const s of backup.sessions) {
        await tx.query(
          `INSERT INTO work_sessions
             (user_id, client_id, invoice_id, work_date, start_time, end_time, note)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            userId,
            s.clientId ? (clientIds.get(s.clientId) ?? null) : null,
            s.invoiceId ? (invoiceIds.get(s.invoiceId) ?? null) : null,
            s.date, s.start, s.end, s.note ?? '',
          ],
        );
      }
    });
  },
};
