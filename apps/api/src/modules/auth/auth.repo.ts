import type { PoolClient } from 'pg';
import { pool } from '../../db/pool.js';

export interface UserRow {
  id: string;
  email: string;
  created_at: string;
}

interface CredentialsRow extends UserRow {
  password_hash: string;
}

export const authRepo = {
  async findCredentialsByEmail(email: string): Promise<CredentialsRow | null> {
    const { rows } = await pool.query<CredentialsRow>(
      `SELECT id, email, created_at, password_hash FROM users WHERE lower(email) = lower($1)`,
      [email],
    );
    return rows[0] ?? null;
  },

  async findById(id: string): Promise<UserRow | null> {
    const { rows } = await pool.query<UserRow>(
      `SELECT id, email, created_at FROM users WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  },

  async emailTaken(email: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      `SELECT 1 FROM users WHERE lower(email) = lower($1)`,
      [email],
    );
    return rowCount !== null && rowCount > 0;
  },

  /** Creates the user and their (empty) profile row as one unit. */
  async createUser(
    client: PoolClient,
    email: string,
    passwordHash: string,
  ): Promise<UserRow> {
    const { rows } = await client.query<UserRow>(
      `INSERT INTO users (email, password_hash) VALUES ($1, $2)
       RETURNING id, email, created_at`,
      [email, passwordHash],
    );
    const user = rows[0] as UserRow;
    await client.query(`INSERT INTO profiles (user_id) VALUES ($1)`, [user.id]);
    return user;
  },
};
