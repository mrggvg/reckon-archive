import type { PoolClient } from 'pg';
import { pool } from '../../db/pool.js';
import type { SessionRow } from '../../lib/mappers.js';

const COLUMNS = `id, client_id, invoice_id, work_date, start_time, end_time, note`;

export interface SessionWrite {
  clientId: string;
  date: string;
  start: string;
  end: string;
  note: string;
}

export const sessionsRepo = {
  async listByUser(userId: string): Promise<SessionRow[]> {
    const { rows } = await pool.query<SessionRow>(
      `SELECT ${COLUMNS} FROM work_sessions WHERE user_id = $1
       ORDER BY work_date DESC, start_time DESC`,
      [userId],
    );
    return rows;
  },

  async findById(userId: string, id: string): Promise<SessionRow | null> {
    const { rows } = await pool.query<SessionRow>(
      `SELECT ${COLUMNS} FROM work_sessions WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return rows[0] ?? null;
  },

  async create(userId: string, s: SessionWrite): Promise<SessionRow> {
    const { rows } = await pool.query<SessionRow>(
      `INSERT INTO work_sessions
         (user_id, client_id, work_date, start_time, end_time, note)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING ${COLUMNS}`,
      [userId, s.clientId, s.date, s.start, s.end, s.note],
    );
    return rows[0] as SessionRow;
  },

  /** Only touches rows that are still unbilled — the guard is in the WHERE. */
  async updateIfUnbilled(
    userId: string,
    id: string,
    s: SessionWrite,
  ): Promise<SessionRow | null> {
    const { rows } = await pool.query<SessionRow>(
      `UPDATE work_sessions SET
         client_id = $3, work_date = $4, start_time = $5, end_time = $6, note = $7
       WHERE id = $1 AND user_id = $2 AND invoice_id IS NULL
       RETURNING ${COLUMNS}`,
      [id, userId, s.clientId, s.date, s.start, s.end, s.note],
    );
    return rows[0] ?? null;
  },

  async deleteIfUnbilled(userId: string, id: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      `DELETE FROM work_sessions
       WHERE id = $1 AND user_id = $2 AND invoice_id IS NULL`,
      [id, userId],
    );
    return rowCount === 1;
  },

  /**
   * Locks the given unbilled sessions for one client and returns them with
   * their computed minutes. FOR UPDATE is what stops two invoices being
   * generated from the same hours at the same time.
   */
  async lockUnbilledForInvoice(
    client: PoolClient,
    userId: string,
    clientId: string,
    ids: string[],
  ): Promise<{ id: string; work_date: string; minutes: number }[]> {
    const { rows } = await client.query<{
      id: string;
      work_date: string;
      minutes: number;
    }>(
      `SELECT id, work_date, minutes FROM work_sessions
       WHERE user_id = $1 AND client_id = $2 AND invoice_id IS NULL
         AND id = ANY($3::uuid[])
       ORDER BY work_date, start_time
       FOR UPDATE`,
      [userId, clientId, ids],
    );
    return rows;
  },

  async attachToInvoice(
    client: PoolClient,
    userId: string,
    invoiceId: string,
    ids: string[],
  ): Promise<void> {
    await client.query(
      `UPDATE work_sessions SET invoice_id = $3
       WHERE user_id = $1 AND id = ANY($2::uuid[])`,
      [userId, ids, invoiceId],
    );
  },

  /** Which hours sit on which invoice, for the whole ledger in one query. */
  async idsByInvoice(userId: string): Promise<Map<string, string[]>> {
    const { rows } = await pool.query<{ invoice_id: string; id: string }>(
      `SELECT invoice_id, id FROM work_sessions
       WHERE user_id = $1 AND invoice_id IS NOT NULL
       ORDER BY work_date, start_time`,
      [userId],
    );
    const map = new Map<string, string[]>();
    for (const row of rows) {
      const list = map.get(row.invoice_id) ?? [];
      list.push(row.id);
      map.set(row.invoice_id, list);
    }
    return map;
  },
};
