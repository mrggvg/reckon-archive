# db

Postgres 17 in Docker, plus the schema and dev fixtures.

All commands run from `apps/api`:

```sh
npm run db:up        # start Postgres, wait until it accepts connections
npm run db:migrate   # apply any migrations this database hasn't run
npm run db:status    # list pending migrations, change nothing
npm run db:reset     # drop everything, migrate from scratch, reseed
npm run db:psql      # open a psql shell
npm run db:down      # stop the container (the volume survives)
```

Connection string for `apps/api/.env`:

```
DATABASE_URL=postgres://reckon:reckon@localhost:5432/reckon
```

## Files

| File            | What it is                                                     |
| --------------- | -------------------------------------------------------------- |
| `compose.yaml`  | The database service. Mounts this directory at `/db` so `psql` inside the container can read the SQL files. |
| `migrations/`   | The schema, as an ordered list of files. Applied by `scripts/migrate.mjs`. |
| `schema.sql`    | The pre-migration schema, kept only as the source of the baseline file. Not applied by anything. |
| `seed.sql`      | One dev user with clients, hours, and invoices.                |

## Migrations

`scripts/migrate.mjs` applies every file in `migrations/` that this database
hasn't run yet, each in its own transaction, and records it in
`schema_migrations` only if that transaction commits. A failure halfway through
leaves the database on the last good version rather than somewhere in between.

Applied files are checksummed. **Editing a migration after it has run is an
error** — the runner refuses and tells you to add a new file instead, because a
database that already ran the old text can never be brought to match the new.

To change the schema: add `db/migrations/000N_what_it_does.sql`, run
`npm run db:migrate`, and commit both the migration and whatever code needs it.

## Backups

`scripts/backup.sh` writes a compressed `pg_dump` to `backups/`, reads the
archive back to prove it isn't truncated, and prunes to the last 30. It uses the
container's own `pg_dump` for the dev database and a local client for a hosted
one:

```sh
scripts/backup.sh                          # dev container → ./backups
DATABASE_URL='postgres://…' scripts/backup.sh /mnt/backups
```

Restoring:

```sh
pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" backups/reckon-….dump
```

A free-tier database has no point-in-time recovery, so this is the only copy
that exists. Put it on cron before the first real invoice.

## Recovering an account

There is no self-service password reset — no e-mail transport exists yet. From
`apps/api`:

```sh
npm run user:password -- amar@example.com 'a new password'
```

It rehashes with the same scrypt scheme the API uses and deletes every session
belonging to that account, so a stolen cookie doesn't outlive the change.

## Conventions

- **Money is integer cents** (`total_cents`, `rate_cents`, `amount_cents`).
  Never floats. Percentages are `numeric` because they aren't money.
- **`date` for day-granularity** (`work_date`, `issue_date`, `paid_on`),
  `timestamptz` for instants (`created_at`).
- **Every user-owned table carries `user_id`**, so scoping is one predicate and
  a missed join can't leak across accounts.
- **The login-session table is `session`** (owned by connect-pg-simple); tracked
  hours live in `work_sessions`. One letter apart, so mind the names.

## Dev credentials

The seed user is `dev@reckon.local` with a placeholder password hash — auth
isn't implemented yet and no hashing library is installed. Replace the hash in
`seed.sql` when `auth.service.ts` gets written.
