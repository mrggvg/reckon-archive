import type { PoolClient } from 'pg';
import { formatInvoiceNumber, parseInvoiceNumber } from '@reckon/shared';
import { pool } from '../../db/pool.js';
import type { ProfileRow } from '../../lib/mappers.js';

const COLUMNS = `full_name, street, postal_code, city, tax_number, reg_number,
                 iban, account_holder, vat_payer, default_description,
                 next_invoice_number, place_of_issue, vat_clause`;

export interface ProfileWrite {
  name: string;
  street: string;
  postalCode: string;
  city: string;
  taxNumber: string;
  regNumber: string;
  iban: string;
  accountHolder: string;
  vatPayer: 'DA' | 'NE';
  defaultDesc: string;
  nextInvoiceNumber: string;
  placeOfIssue: string;
  vatClause: string;
}

export const profileRepo = {
  async find(userId: string): Promise<ProfileRow | null> {
    const { rows } = await pool.query<ProfileRow>(
      `SELECT ${COLUMNS} FROM profiles WHERE user_id = $1`,
      [userId],
    );
    return rows[0] ?? null;
  },

  /** Upsert, so a profile row missing for any reason repairs itself on save. */
  async save(userId: string, p: ProfileWrite): Promise<ProfileRow> {
    const { rows } = await pool.query<ProfileRow>(
      `INSERT INTO profiles (
         user_id, full_name, street, postal_code, city, tax_number, reg_number,
         iban, account_holder, vat_payer, default_description,
         next_invoice_number, place_of_issue, vat_clause, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, now())
       ON CONFLICT (user_id) DO UPDATE SET
         full_name = excluded.full_name,
         street = excluded.street,
         postal_code = excluded.postal_code,
         city = excluded.city,
         tax_number = excluded.tax_number,
         reg_number = excluded.reg_number,
         iban = excluded.iban,
         account_holder = excluded.account_holder,
         vat_payer = excluded.vat_payer,
         default_description = excluded.default_description,
         next_invoice_number = excluded.next_invoice_number,
         place_of_issue = excluded.place_of_issue,
         vat_clause = excluded.vat_clause,
         updated_at = now()
       RETURNING ${COLUMNS}`,
      [
        userId, p.name, p.street, p.postalCode, p.city, p.taxNumber, p.regNumber,
        p.iban, p.accountHolder, p.vatPayer === 'DA', p.defaultDesc,
        p.nextInvoiceNumber, p.placeOfIssue, p.vatClause,
      ],
    );
    return rows[0] as ProfileRow;
  },

  /**
   * Moves the numbering floor past a number that has just been issued.
   *
   * Without this the series is derived from the invoices that still exist, so
   * deleting the newest one hands its number to the next invoice — and if the
   * deleted one had already been sent, two different documents are in the world
   * under the same number. A high-water mark can only ever move forward.
   */
  async advanceNextNumber(
    client: PoolClient,
    userId: string,
    issued: { seq: number; year: number },
  ): Promise<void> {
    const declared = await this.declaredNextNumber(client, userId);
    const parsed = parseInvoiceNumber(declared);
    const floor = parsed && parsed.year === issued.year ? parsed.seq : 0;
    if (issued.seq + 1 <= floor) return;

    await client.query(
      `UPDATE profiles SET next_invoice_number = $2, updated_at = now()
       WHERE user_id = $1`,
      [userId, formatInvoiceNumber(issued.seq + 1, issued.year)],
    );
  },

  /** Reads the numbering floor inside an open transaction. */
  async declaredNextNumber(client: PoolClient, userId: string): Promise<string> {
    const { rows } = await client.query<{ next_invoice_number: string }>(
      `SELECT next_invoice_number FROM profiles WHERE user_id = $1`,
      [userId],
    );
    return rows[0]?.next_invoice_number ?? '';
  },
};
