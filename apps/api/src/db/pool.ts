import pg from 'pg';
import { env } from '../config/env.js';

export const pool = new pg.Pool({ connectionString: env.DATABASE_URL });

pool.on('error', (err) => {
  console.error('Unexpected error on idle pg client', err);
});
