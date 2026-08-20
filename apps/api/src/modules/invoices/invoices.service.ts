import {
  formatAddress,
  formatInvoiceNumber,
  lineTotalCents,
  nextInvoiceNumber,
  parseInvoiceNumber,
  toCents,
  type InvoiceEditInput,
  type InvoiceGenerateInput,
  type InvoiceImportInput,
  type InvoiceManualInput,
} from '@reckon/shared';
import { withTransaction } from '../../db/tx.js';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/AppError.js';
import { toInvoiceDto } from '../../lib/mappers.js';
import { clientsRepo } from '../clients/clients.repo.js';
import { profileRepo } from '../profile/profile.repo.js';
import { sessionsRepo } from '../sessions/sessions.repo.js';
import { invoicesRepo, isUniqueViolation, type InvoiceWrite } from './invoices.repo.js';

/** How many times to step past a number someone else took first. */
const NUMBER_ATTEMPTS = 25;

export const invoicesService = {
  async list(userId: string) {
    const [rows, sessionIds] = await Promise.all([
      invoicesRepo.listByUser(userId),
      sessionsRepo.idsByInvoice(userId),
    ]);
    return rows.map((row) => toInvoiceDto(row, sessionIds.get(row.id) ?? []));
  },

  async get(userId: string, id: string) {
    const row = await invoicesRepo.findById(userId, id);
    if (!row) throw new NotFoundError('Račun ni najden');
    const sessionIds = await sessionsRepo.idsByInvoice(userId);
    return toInvoiceDto(row, sessionIds.get(row.id) ?? []);
  },

  /**
   * Turns tracked hours into an invoice, in one transaction.
   *
   * The client's rate and identity are read now and written onto the invoice:
   * an invoice is a record of what was charged, and renegotiating the rate next
   * month must not rewrite what was issued this month. The sessions are locked
   * while this runs, so the same hours can't reach two invoices.
   */
  async generate(userId: string, input: InvoiceGenerateInput) {
    return withTransaction(async (tx) => {
      const client = await clientsRepo.findById(userId, input.clientId);
      if (!client) throw new NotFoundError('Stranka ni najdena');

      const sessions = await sessionsRepo.lockUnbilledForInvoice(
        tx,
        userId,
        input.clientId,
        input.sessionIds,
      );
      if (sessions.length === 0) {
        throw new ConflictError('Izbrane ure so že obračunane ali ne obstajajo');
      }
      if (sessions.length !== input.sessionIds.length) {
        throw new ConflictError(
          'Del izbranih ur je medtem že prišel na drug račun — osvežite in poskusite znova',
        );
      }

      const minutes = sessions.reduce((sum, s) => sum + s.minutes, 0);
      const totalCents = lineTotalCents(minutes, client.rate_cents);
      const dates = sessions.map((s) => s.work_date).sort();

      const declared = await profileRepo.declaredNextNumber(tx, userId);
      const row = await insertWithFreeNumber(tx, userId, declared, input.issueDate, {
        clientId: client.id,
        number: '',
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        description: input.description || 'Storitve',
        periodStart: dates[0] ?? input.issueDate,
        periodEnd: dates[dates.length - 1] ?? input.issueDate,
        totalCents,
        totalMinutes: minutes,
        rateCents: client.rate_cents,
        status: 'unpaid',
        paidOn: null,
        imported: false,
        clientName: client.company_name,
        clientAddress: formatAddress({
          street: client.street,
          postalCode: client.postal_code,
          city: client.city,
        }),
        clientTaxNumber: client.tax_number,
        // Hours were logged for this, so the work was this taxpayer's own.
        passthroughFor: '',
        passthroughKeepCents: null,
      });

      await sessionsRepo.attachToInvoice(
        tx,
        userId,
        row.id,
        sessions.map((s) => s.id),
      );

      return toInvoiceDto(row, sessions.map((s) => s.id));
    });
  },

  /**
   * An invoice with no hours behind it: a fixed fee, a call-out, a retainer.
   *
   * Numbered by the app like any other invoice it issues — the only difference
   * from a generated one is that the amount and the period are stated rather
   * than computed, so nothing is locked and nothing is marked billed.
   */
  async manual(userId: string, input: InvoiceManualInput) {
    return withTransaction(async (tx) => {
      const client = await clientsRepo.findById(userId, input.clientId);
      if (!client) throw new NotFoundError('Stranka ni najdena');

      const declared = await profileRepo.declaredNextNumber(tx, userId);
      const row = await insertWithFreeNumber(tx, userId, declared, input.issueDate, {
        clientId: client.id,
        number: '',
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        description: input.description || 'Storitve',
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        totalCents: toCents(input.total),
        totalMinutes: null,
        rateCents: null,
        status: 'unpaid',
        paidOn: null,
        imported: false,
        clientName: client.company_name,
        clientAddress: formatAddress({
          street: client.street,
          postalCode: client.postal_code,
          city: client.city,
        }),
        clientTaxNumber: client.tax_number,
        passthroughFor: input.passthrough?.forWhom ?? '',
        passthroughKeepCents:
          input.passthrough === null || input.passthrough === undefined
            ? null
            : toCents(input.passthrough.keep),
      });

      return toInvoiceDto(row, []);
    });
  },

  /** An invoice issued before the app existed: the caller states its number. */
  async import(userId: string, input: InvoiceImportInput) {
    const client = await clientsRepo.findById(userId, input.clientId);
    if (!client) throw new NotFoundError('Stranka ni najdena');

    const parsed = parseInvoiceNumber(input.number);
    if (!parsed) {
      throw new ValidationError({ number: 'Uporabite obliko NNN/LLLL, npr. 003/2026' });
    }
    const number = formatInvoiceNumber(parsed.seq, parsed.year);

    try {
      const row = await withTransaction(async (tx) => {
        const inserted = await invoicesRepo.insert(tx, userId, {
          clientId: client.id,
          number,
          issueDate: input.issueDate,
          dueDate: input.dueDate,
          description: input.description || 'Storitve',
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          totalCents: toCents(input.total),
          totalMinutes: null,
          rateCents: null,
          status: input.status,
          paidOn: input.paidDate,
          imported: true,
          clientName: client.company_name,
          clientAddress: formatAddress({
            street: client.street,
            postalCode: client.postal_code,
            city: client.city,
          }),
          clientTaxNumber: client.tax_number,
          passthroughFor: input.passthrough?.forWhom ?? '',
          passthroughKeepCents:
            input.passthrough === null || input.passthrough === undefined
              ? null
              : toCents(input.passthrough.keep),
        });
        return inserted;
      });
      return toInvoiceDto(row, []);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ValidationError({ number: `Račun ${number} že obstaja` });
      }
      throw err;
    }
  },

  /**
   * Editing an issued invoice. The client, period and total of a *generated*
   * invoice are refused: they are facts about the hours behind it, and letting
   * the two disagree is how a ledger stops adding up.
   */
  async update(userId: string, id: string, input: InvoiceEditInput) {
    const existing = await invoicesRepo.findById(userId, id);
    if (!existing) throw new NotFoundError('Račun ni najden');

    const patch: Record<string, unknown> = {};
    if (input.number !== undefined) {
      const parsed = parseInvoiceNumber(input.number);
      if (!parsed) {
        throw new ValidationError({ number: 'Uporabite obliko NNN/LLLL, npr. 003/2026' });
      }
      patch.number = formatInvoiceNumber(parsed.seq, parsed.year);
    }
    if (input.issueDate !== undefined) patch.issue_date = input.issueDate;
    if (input.dueDate !== undefined) patch.due_date = input.dueDate;
    if (input.description !== undefined) {
      patch.description = input.description || 'Storitve';
    }

    // What may be edited depends on whether hours stand behind the figures,
    // not on where the invoice came from: an invoice generated from sessions
    // must keep agreeing with them, while one with no hours has nothing to
    // contradict.
    const linkedSessions = (await sessionsRepo.idsByInvoice(userId)).get(id) ?? [];

    if (linkedSessions.length > 0) {
      const refused = [
        'clientId',
        'periodStart',
        'periodEnd',
        'total',
        'passthrough',
      ] as const;
      if (refused.some((k) => input[k] !== undefined)) {
        throw new ConflictError(
          'Stranke, obdobja in zneska računa iz ur ni mogoče spremeniti — izhajajo iz vnesenih ur',
        );
      }
    } else {
      if (input.clientId !== undefined) {
        const client = await clientsRepo.findById(userId, input.clientId);
        if (!client) throw new NotFoundError('Stranka ni najdena');
        patch.client_id = client.id;
        patch.client_name = client.company_name;
        patch.client_address = formatAddress({
          street: client.street,
          postalCode: client.postal_code,
          city: client.city,
        });
        patch.client_tax_number = client.tax_number;
      }
      if (input.periodStart !== undefined) patch.period_start = input.periodStart;
      if (input.periodEnd !== undefined) patch.period_end = input.periodEnd;
      if (input.total !== undefined) patch.total_cents = toCents(input.total);
      if (input.passthrough !== undefined) {
        patch.passthrough_for = input.passthrough?.forWhom ?? '';
        patch.passthrough_keep_cents =
          input.passthrough === null ? null : toCents(input.passthrough.keep);
      }
    }

    const issue = (patch.issue_date as string) ?? existing.issue_date;
    const due = (patch.due_date as string) ?? existing.due_date;
    if (due < issue) {
      throw new ValidationError({
        dueDate: 'Rok plačila ne more biti pred datumom izdaje',
      });
    }

    try {
      const row = await invoicesRepo.updateFields(userId, id, patch);
      if (!row) throw new NotFoundError('Račun ni najden');
      const sessionIds = await sessionsRepo.idsByInvoice(userId);
      return toInvoiceDto(row, sessionIds.get(row.id) ?? []);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ValidationError({ number: 'Račun s to številko že obstaja' });
      }
      throw err;
    }
  },

  async setPayment(userId: string, id: string, paid: boolean, paidDate: string | null) {
    if (paid === (paidDate === null)) {
      throw new ValidationError({ paidDate: 'Plačan račun potrebuje datum plačila' });
    }
    const row = await invoicesRepo.setPayment(
      userId,
      id,
      paid ? 'paid' : 'unpaid',
      paidDate,
    );
    if (!row) throw new NotFoundError('Račun ni najden');
    const sessionIds = await sessionsRepo.idsByInvoice(userId);
    return toInvoiceDto(row, sessionIds.get(row.id) ?? []);
  },

  /** Deleting an invoice returns its hours to the unbilled pool. */
  async remove(userId: string, id: string) {
    if (!(await invoicesRepo.delete(userId, id))) {
      throw new NotFoundError('Račun ni najden');
    }
  },
};

/**
 * Inserts under the next free number, stepping forward if another request took
 * one first.
 *
 * The unique index on (user_id, number) is the authority here, not the SELECT:
 * two requests can read the same maximum, and only one of them can commit. The
 * loser retries rather than failing, so a double-click produces two invoices
 * with consecutive numbers instead of one error.
 */
async function insertWithFreeNumber(
  tx: Parameters<Parameters<typeof withTransaction>[0]>[0],
  userId: string,
  declaredNext: string,
  issueDate: string,
  draft: InvoiceWrite,
) {
  const year = Number(issueDate.slice(0, 4));
  const taken = await invoicesRepo.numbersInYear(tx, userId, year);
  let number = nextInvoiceNumber(taken, declaredNext, issueDate);

  for (let attempt = 0; attempt < NUMBER_ATTEMPTS; attempt++) {
    try {
      // A savepoint: a unique violation would otherwise abort the whole
      // transaction and take the session locks with it.
      await tx.query('SAVEPOINT number_attempt');
      const row = await invoicesRepo.insert(tx, userId, { ...draft, number });
      await tx.query('RELEASE SAVEPOINT number_attempt');
      return row;
    } catch (err) {
      await tx.query('ROLLBACK TO SAVEPOINT number_attempt');
      if (!isUniqueViolation(err)) throw err;
      const parsed = parseInvoiceNumber(number);
      number = formatInvoiceNumber((parsed?.seq ?? 0) + 1, year);
    }
  }
  throw new ConflictError('Ni bilo mogoče dodeliti številke računa — poskusite znova');
}
