import { pool } from '../../db/pool.js';
import type { ClientRow } from '../../lib/mappers.js';

const COLUMNS = `id, company_name, street, postal_code, city, tax_number,
                 rate_cents, email, phone, is_active`;

export interface ClientWrite {
  name: string;
  street: string;
  postalCode: string;
  city: string;
  taxNumber: string;
  rateCents: number;
  email: string;
  phone: string;
}

export const clientsRepo = {
  async listByUser(userId: string): Promise<ClientRow[]> {
    const { rows } = await pool.query<ClientRow>(
      `SELECT ${COLUMNS} FROM clients WHERE user_id = $1
       ORDER BY is_active DESC, company_name`,
      [userId],
    );
    return rows;
  },

  async findById(userId: string, id: string): Promise<ClientRow | null> {
    const { rows } = await pool.query<ClientRow>(
      `SELECT ${COLUMNS} FROM clients WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return rows[0] ?? null;
  },

  async create(userId: string, c: ClientWrite): Promise<ClientRow> {
    const { rows } = await pool.query<ClientRow>(
      `INSERT INTO clients
         (user_id, company_name, street, postal_code, city, tax_number,
          rate_cents, email, phone)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING ${COLUMNS}`,
      [userId, c.name, c.street, c.postalCode, c.city, c.taxNumber,
       c.rateCents, c.email, c.phone],
    );
    return rows[0] as ClientRow;
  },

  async update(userId: string, id: string, c: ClientWrite): Promise<ClientRow | null> {
    const { rows } = await pool.query<ClientRow>(
      `UPDATE clients SET
         company_name = $3, street = $4, postal_code = $5, city = $6,
         tax_number = $7, rate_cents = $8, email = $9, phone = $10
       WHERE id = $1 AND user_id = $2
       RETURNING ${COLUMNS}`,
      [id, userId, c.name, c.street, c.postalCode, c.city, c.taxNumber,
       c.rateCents, c.email, c.phone],
    );
    return rows[0] ?? null;
  },

  async setActive(userId: string, id: string, active: boolean): Promise<ClientRow | null> {
    const { rows } = await pool.query<ClientRow>(
      `UPDATE clients SET is_active = $3 WHERE id = $1 AND user_id = $2
       RETURNING ${COLUMNS}`,
      [id, userId, active],
    );
    return rows[0] ?? null;
  },

  async delete(userId: string, id: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      `DELETE FROM clients WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return rowCount === 1;
  },

  /** Whether anything still points at this client. */
  async hasHistory(userId: string, id: string): Promise<boolean> {
    const { rows } = await pool.query<{ used: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM work_sessions WHERE user_id = $1 AND client_id = $2
         UNION ALL
         SELECT 1 FROM invoices WHERE user_id = $1 AND client_id = $2
       ) AS used`,
      [userId, id],
    );
    return rows[0]?.used ?? false;
  },
};
