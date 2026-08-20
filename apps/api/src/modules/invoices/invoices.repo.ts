import type { PoolClient } from 'pg';
import { pool } from '../../db/pool.js';
import type { InvoiceRow } from '../../lib/mappers.js';

const COLUMNS = `id, client_id, number, issue_date, due_date, description,
                 period_start, period_end, total_cents, total_minutes,
                 rate_cents, status, paid_on, imported,
                 client_name, client_address, client_tax_number,
                 passthrough_for, passthrough_keep_cents`;

export interface InvoiceWrite {
  clientId: string;
  number: string;
  issueDate: string;
  dueDate: string;
  description: string;
  periodStart: string;
  periodEnd: string;
  totalCents: number;
  totalMinutes: number | null;
  rateCents: number | null;
  status: 'unpaid' | 'paid';
  paidOn: string | null;
  imported: boolean;
  clientName: string;
  clientAddress: string;
  clientTaxNumber: string;
  /** Whose work it was, when the invoice was raised for somebody else. */
  passthroughFor: string;
  passthroughKeepCents: number | null;
}

export const invoicesRepo = {
  async listByUser(userId: string): Promise<InvoiceRow[]> {
    const { rows } = await pool.query<InvoiceRow>(
      `SELECT ${COLUMNS} FROM invoices WHERE user_id = $1
       ORDER BY issue_date DESC, number DESC`,
      [userId],
    );
    return rows;
  },

  async findById(userId: string, id: string): Promise<InvoiceRow | null> {
    const { rows } = await pool.query<InvoiceRow>(
      `SELECT ${COLUMNS} FROM invoices WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return rows[0] ?? null;
  },

  /** Every number already issued in a year, read inside the numbering lock. */
  async numbersInYear(
    client: PoolClient,
    userId: string,
    year: number,
  ): Promise<string[]> {
    const { rows } = await client.query<{ number: string }>(
      `SELECT number FROM invoices WHERE user_id = $1 AND number LIKE $2`,
      [userId, `%/${year}`],
    );
    return rows.map((r) => r.number);
  },

  async insert(
    client: PoolClient,
    userId: string,
    i: InvoiceWrite,
  ): Promise<InvoiceRow> {
    const { rows } = await client.query<InvoiceRow>(
      `INSERT INTO invoices
         (user_id, client_id, number, issue_date, due_date, description,
          period_start, period_end, total_cents, total_minutes, rate_cents,
          status, paid_on, imported, client_name, client_address,
          client_tax_number, passthrough_for, passthrough_keep_cents)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING ${COLUMNS}`,
      [
        userId, i.clientId, i.number, i.issueDate, i.dueDate, i.description,
        i.periodStart, i.periodEnd, i.totalCents, i.totalMinutes, i.rateCents,
        i.status, i.paidOn, i.imported, i.clientName, i.clientAddress,
        i.clientTaxNumber, i.passthroughFor, i.passthroughKeepCents,
      ],
    );
    return rows[0] as InvoiceRow;
  },

  async updateFields(
    userId: string,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<InvoiceRow | null> {
    const keys = Object.keys(patch);
    if (keys.length === 0) return this.findById(userId, id);

    const assignments = keys.map((k, i) => `${k} = $${i + 3}`).join(', ');
    const { rows } = await pool.query<InvoiceRow>(
      `UPDATE invoices SET ${assignments}
       WHERE id = $1 AND user_id = $2
       RETURNING ${COLUMNS}`,
      [id, userId, ...keys.map((k) => patch[k])],
    );
    return rows[0] ?? null;
  },

  async setPayment(
    userId: string,
    id: string,
    status: 'unpaid' | 'paid',
    paidOn: string | null,
  ): Promise<InvoiceRow | null> {
    const { rows } = await pool.query<InvoiceRow>(
      `UPDATE invoices SET status = $3, paid_on = $4
       WHERE id = $1 AND user_id = $2
       RETURNING ${COLUMNS}`,
      [id, userId, status, paidOn],
    );
    return rows[0] ?? null;
  },

  /** The linked hours are freed by the schema's ON DELETE SET NULL. */
  async delete(userId: string, id: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      `DELETE FROM invoices WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return rowCount === 1;
  },
};

/** Postgres' unique_violation, i.e. this number is already taken. */
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}
