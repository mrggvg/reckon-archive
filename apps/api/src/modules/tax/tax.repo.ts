import { pool } from '../../db/pool.js';

export interface ContributionRow {
  id: string;
  period_year: number;
  period_month: number;
  base_cents: number;
  piz_cents: number;
  zz_do_cents: number;
  stv_cents: number;
  zap_cents: number;
  total_cents: number;
  source: 'estimated' | 'filed';
  piz_iban: string;
  piz_reference: string;
  zz_do_iban: string;
  zz_do_reference: string;
  stv_iban: string;
  stv_reference: string;
  zap_iban: string;
  zap_reference: string;
}

const CONTRIBUTION_COLUMNS = `id, period_year, period_month, base_cents, piz_cents,
  zz_do_cents, stv_cents, zap_cents, total_cents, source,
  piz_iban, piz_reference, zz_do_iban, zz_do_reference,
  stv_iban, stv_reference, zap_iban, zap_reference`;

export interface TaxPaymentRow {
  id: string;
  paid_on: string;
  amount_cents: number;
  kind: 'contributions' | 'income_tax' | 'other';
  note: string;
  /** What the payment settles, when it settles something in particular. */
  period_year: number | null;
  period_month: number | null;
  group_key: 'piz' | 'zz_do' | 'stv' | 'zap' | null;
}

export interface AssessmentRow {
  id: string;
  tax_year: number;
  assessed_cents: number;
  received_on: string;
  note: string;
}

/** An invoice reduced to what the tax engines care about. */
export interface RevenueRow {
  id: string;
  number: string;
  client_id: string | null;
  client_name: string;
  total_cents: number;
  issue_date: string;
  paid_on: string | null;
  period_start: string;
  period_end: string;
  /** Null when no hours were behind the invoice: a fixed fee, a one-off. */
  total_minutes: number | null;
  /** Set when the invoice was raised for somebody else; what was kept. */
  passthrough_keep_cents: number | null;
}

export const taxRepo = {
  async contributions(userId: string, year: number): Promise<ContributionRow[]> {
    const { rows } = await pool.query<ContributionRow>(
      `SELECT ${CONTRIBUTION_COLUMNS} FROM contribution_periods
       WHERE user_id = $1 AND period_year = $2
       ORDER BY period_month`,
      [userId, year],
    );
    return rows;
  },

  async findContribution(userId: string, id: string): Promise<ContributionRow | null> {
    const { rows } = await pool.query<ContributionRow>(
      `SELECT ${CONTRIBUTION_COLUMNS} FROM contribution_periods
       WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return rows[0] ?? null;
  },

  /** Upsert, because a month is identified by its date, not by an id. */
  async saveContribution(
    userId: string,
    c: Omit<ContributionRow, 'id'>,
  ): Promise<ContributionRow> {
    const { rows } = await pool.query<ContributionRow>(
      `INSERT INTO contribution_periods
         (user_id, period_year, period_month, base_cents, piz_cents, zz_do_cents,
          stv_cents, zap_cents, total_cents, source, piz_iban, piz_reference,
          zz_do_iban, zz_do_reference, stv_iban, stv_reference, zap_iban, zap_reference)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       ON CONFLICT (user_id, period_year, period_month) DO UPDATE SET
         base_cents = excluded.base_cents,
         piz_cents = excluded.piz_cents,
         zz_do_cents = excluded.zz_do_cents,
         stv_cents = excluded.stv_cents,
         zap_cents = excluded.zap_cents,
         total_cents = excluded.total_cents,
         source = excluded.source,
         piz_iban = excluded.piz_iban,
         piz_reference = excluded.piz_reference,
         zz_do_iban = excluded.zz_do_iban,
         zz_do_reference = excluded.zz_do_reference,
         stv_iban = excluded.stv_iban,
         stv_reference = excluded.stv_reference,
         zap_iban = excluded.zap_iban,
         zap_reference = excluded.zap_reference
       RETURNING ${CONTRIBUTION_COLUMNS}`,
      [
        userId, c.period_year, c.period_month, c.base_cents, c.piz_cents, c.zz_do_cents,
        c.stv_cents, c.zap_cents, c.total_cents, c.source, c.piz_iban, c.piz_reference,
        c.zz_do_iban, c.zz_do_reference, c.stv_iban, c.stv_reference, c.zap_iban,
        c.zap_reference,
      ],
    );
    return rows[0] as ContributionRow;
  },

  async deleteContribution(userId: string, id: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      `DELETE FROM contribution_periods WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return rowCount === 1;
  },

  /** The most recent month's accounts and references, to pre-fill the next. */
  async latestContribution(userId: string): Promise<ContributionRow | null> {
    const { rows } = await pool.query<ContributionRow>(
      `SELECT ${CONTRIBUTION_COLUMNS} FROM contribution_periods
       WHERE user_id = $1
       ORDER BY period_year DESC, period_month DESC
       LIMIT 1`,
      [userId],
    );
    return rows[0] ?? null;
  },

  async payments(userId: string, year: number): Promise<TaxPaymentRow[]> {
    const { rows } = await pool.query<TaxPaymentRow>(
      `SELECT id, paid_on, amount_cents, kind, note,
              period_year, period_month, group_key
       FROM tax_payments
       WHERE user_id = $1
         AND (extract(year from paid_on) = $2 OR period_year = $2)
       ORDER BY paid_on DESC, created_at DESC`,
      [userId, year],
    );
    return rows;
  },

  async addPayment(
    userId: string,
    p: {
      paidOn: string;
      amountCents: number;
      kind: string;
      note: string;
      periodYear: number | null;
      periodMonth: number | null;
      groupKey: string | null;
    },
  ): Promise<TaxPaymentRow> {
    const { rows } = await pool.query<TaxPaymentRow>(
      `INSERT INTO tax_payments
         (user_id, paid_on, amount_cents, kind, note, period_year, period_month, group_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, paid_on, amount_cents, kind, note,
                 period_year, period_month, group_key`,
      [
        userId, p.paidOn, p.amountCents, p.kind, p.note,
        p.periodYear, p.periodMonth, p.groupKey,
      ],
    );
    return rows[0] as TaxPaymentRow;
  },

  async deletePayment(userId: string, id: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      `DELETE FROM tax_payments WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return rowCount === 1;
  },

  async assessment(userId: string, year: number): Promise<AssessmentRow | null> {
    const { rows } = await pool.query<AssessmentRow>(
      `SELECT id, tax_year, assessed_cents, received_on, note FROM tax_assessments
       WHERE user_id = $1 AND tax_year = $2`,
      [userId, year],
    );
    return rows[0] ?? null;
  },

  async saveAssessment(
    userId: string,
    year: number,
    a: { assessedCents: number; receivedOn: string; note: string },
  ): Promise<AssessmentRow> {
    const { rows } = await pool.query<AssessmentRow>(
      `INSERT INTO tax_assessments (user_id, tax_year, assessed_cents, received_on, note)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id, tax_year) DO UPDATE SET
         assessed_cents = excluded.assessed_cents,
         received_on = excluded.received_on,
         note = excluded.note
       RETURNING id, tax_year, assessed_cents, received_on, note`,
      [userId, year, a.assessedCents, a.receivedOn, a.note],
    );
    return rows[0] as AssessmentRow;
  },

  /**
   * Invoices as revenue.
   *
   * Both dates come back: tax follows the date money arrived, while the
   * "if everyone pays" line follows the date the invoice was issued.
   */
  async revenue(userId: string): Promise<RevenueRow[]> {
    const { rows } = await pool.query<RevenueRow>(
      `SELECT id, number, client_id, client_name, total_cents, issue_date,
              paid_on, period_start, period_end, total_minutes,
              passthrough_keep_cents
       FROM invoices WHERE user_id = $1
       ORDER BY issue_date`,
      [userId],
    );
    return rows;
  },
};
