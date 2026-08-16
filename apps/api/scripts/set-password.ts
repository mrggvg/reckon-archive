/*
 * Sets an account's password from the command line.
 *
 *   npm run user:password -- amar@example.com 'new password'
 *
 * There is no e-mail transport yet, so there is no self-service reset either.
 * Until there is, this is the recovery path — deliberately something only
 * whoever holds the database credentials can do. Every session belonging to the
 * account is destroyed, so a stolen cookie doesn't outlive the password.
 */
import 'dotenv/config';
import { pool } from '../src/db/pool.js';
import { hashPassword } from '../src/lib/password.js';

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error("usage: npm run user:password -- <email> '<new password>'");
  process.exit(1);
}

if (password.length < 8) {
  console.error('A password of at least 8 characters, please.');
  process.exit(1);
}

try {
  const hash = await hashPassword(password);
  const { rows } = await pool.query<{ id: string; email: string }>(
    `UPDATE users SET password_hash = $2 WHERE lower(email) = lower($1)
     RETURNING id, email`,
    [email, hash],
  );

  const user = rows[0];
  if (!user) {
    console.error(`No account for ${email}.`);
    process.exit(1);
  }

  // express-session rows are JSON; the userId inside is what ties them to this
  // account. Dropping them logs the account out everywhere.
  const { rowCount } = await pool.query(
    `DELETE FROM "session" WHERE sess->>'userId' = $1`,
    [user.id],
  );

  console.log(`✓ password set for ${user.email}`);
  console.log(`· ${rowCount ?? 0} session(s) signed out`);
} finally {
  await pool.end();
}
