import pg from 'pg';
import { env } from '../config/env.js';

// `date` columns are calendar days, not instants. Left to the driver they come
// back as JS Dates in the server's zone, which is how a session logged on the
// 1st starts reporting itself as the 31st. Keep them as the 'YYYY-MM-DD'
// strings Postgres sent.
pg.types.setTypeParser(1082, (value: string) => value);

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: env.PG_POOL_MAX,
  // A pooled connection that has been idle this long is probably talking to a
  // database that has since suspended itself; drop it rather than find out
  // mid-query.
  idleTimeoutMillis: 10_000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle pg client', err);
});
