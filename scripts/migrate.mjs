#!/usr/bin/env node
/*
 * Applies pending migrations, in filename order, each in its own transaction.
 *
 *   node scripts/migrate.mjs           apply everything not yet applied
 *   node scripts/migrate.mjs --status  list what would run, change nothing
 *   node scripts/migrate.mjs --reset   drop the schema first, then apply all
 *
 * A migration is recorded only if its transaction commits, so a failure halfway
 * through leaves the database on the last good version rather than somewhere in
 * between. Applied files are checksummed: editing one after it has run is the
 * mistake this catches.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'db', 'migrations');

// The driver belongs to the API package; this script is deliberately outside it
// so it can run before anything else is installed or built.
const pg = createRequire(join(ROOT, 'apps', 'api', 'package.json'))('pg');
const url = process.env.DATABASE_URL ?? 'postgres://reckon:reckon@localhost:5432/reckon';

const args = new Set(process.argv.slice(2));
const statusOnly = args.has('--status');
const reset = args.has('--reset');

const files = readdirSync(DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const checksum = (sql) => createHash('sha256').update(sql).digest('hex').slice(0, 16);

const pool = new pg.Pool({ connectionString: url });

try {
  if (reset) {
    await pool.query('drop schema if exists public cascade; create schema public;');
    console.log('· schema dropped');
  }

  await pool.query(`
    create table if not exists schema_migrations (
      filename   text primary key,
      checksum   text not null,
      applied_at timestamptz not null default now()
    )
  `);

  const { rows } = await pool.query('select filename, checksum from schema_migrations');
  const applied = new Map(rows.map((r) => [r.filename, r.checksum]));

  let ran = 0;
  for (const file of files) {
    const sql = readFileSync(join(DIR, file), 'utf8');
    const sum = checksum(sql);
    const seen = applied.get(file);

    if (seen) {
      if (seen !== sum) {
        console.error(
          `✗ ${file} was changed after it was applied.\n` +
            '  Migrations are immutable — add a new file instead.',
        );
        process.exit(1);
      }
      continue;
    }

    if (statusOnly) {
      console.log(`· pending  ${file}`);
      ran++;
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query(
        'insert into schema_migrations (filename, checksum) values ($1, $2)',
        [file, sum],
      );
      await client.query('commit');
      console.log(`✓ ${file}`);
      ran++;
    } catch (err) {
      await client.query('rollback');
      console.error(`✗ ${file}\n  ${err.message}`);
      process.exit(1);
    } finally {
      client.release();
    }
  }

  if (ran === 0) console.log('· database is up to date');
} finally {
  await pool.end();
}
