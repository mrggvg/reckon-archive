import { pool } from '../../db/pool.js';

export const clientsRepo = {
  async listByUser(userId: string) {
    const { rows } = await pool.query(
      `SELECT * FROM clients WHERE user_id = $1 ORDER BY company_name`,
      [userId],
    );
    return rows;
  },

  async findById(userId: string, id: string) {
    const { rows } = await pool.query(
      `SELECT * FROM clients WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return rows[0] ?? null;
  },
};
