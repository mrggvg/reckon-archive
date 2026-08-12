# db

Postgres 17 in Docker, plus the schema and dev fixtures.

All commands run from `apps/api`:

```sh
npm run db:up      # start Postgres, wait until it accepts connections
npm run db:reset   # drop everything, reapply schema.sql + seed.sql (~0.5s)
npm run db:psql    # open a psql shell
npm run db:down    # stop the container (the volume survives)
```

Connection string for `apps/api/.env`:

```
DATABASE_URL=postgres://reckon:reckon@localhost:5432/reckon
```

## Files

| File          | What it is                                                       |
| ------------- | ---------------------------------------------------------------- |
| `compose.yaml`| The database service. Mounts this directory at `/db` so `psql` inside the container can read the SQL files. |
| `schema.sql`  | Every table, constraint, and index. The single source of truth.  |
| `seed.sql`    | One dev user with clients, hours, invoices, and tax payments.    |

## No migrations yet

`schema.sql` starts with `drop schema public cascade`, so a reset is total.
That is deliberate while the shape is still moving — migrations protect data you
can't lose, and right now there isn't any.

Adopt a migration tool the moment a real invoice exists in a database you care
about. At that point `schema.sql` becomes the baseline and every later change is
an additive file.

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
