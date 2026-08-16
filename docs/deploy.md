# Deploying Reckon

Two Vercel projects from one repository, a hosted Postgres, and one rewrite that
keeps them on the same origin. Free at this scale, with the caveats in §6.

---

## 1. Why one origin matters

The session cookie is the whole of authentication. If the SPA is served from
`reckon.vercel.app` and calls an API on `reckon-api.vercel.app`, that cookie is
**third-party**: Safari blocks it outright and Chrome is going the same way, so
sign-in appears to work and every subsequent request is a 401.

So the web project rewrites `/api/*` to the API deployment. The browser only
ever sees one host, the cookie stays first-party, and `sameSite: 'lax'` keeps
doing what it does locally — including blocking cross-site POSTs, which is why
there is no CSRF token to configure.

```
browser ──▶ reckon.vercel.app ──┬──▶ static SPA
                                └──▶ /api/* ──▶ reckon-api.vercel.app ──▶ Postgres
```

## 2. The database

Any plain Postgres 17 works; nothing here uses a provider-specific feature.

**Neon** is the better free fit: it suspends when idle and **wakes on the next
connection** in a few hundred milliseconds. **Supabase** free pauses a project
after about a week of inactivity and needs a visit to the dashboard to bring it
back — for a ledger that goes quiet between invoices, that is a dead app on a
Tuesday evening.

Whichever you use, connect through the **pooler** endpoint (Neon's `-pooler`
host, Supabase's Supavisor on 6543). Each warm function instance holds its own
pool, and direct connections run out long before requests do.

Then, from your laptop, against the production URL:

```sh
DATABASE_URL='postgres://…' node scripts/migrate.mjs
```

Migrations are the only thing that touches the schema. There is no build step
that alters the database, and nothing runs automatically on deploy.

## 3. The API project

| Setting | Value |
| --- | --- |
| Root directory | `apps/api` |
| Include files outside root directory | **on** (it imports `packages/shared`) |
| Build command | *(none — the function is compiled by the runtime)* |
| Environment | see below |

```
NODE_ENV=production
DATABASE_URL=postgres://…pooler…/reckon
SESSION_SECRET=<64 random hex chars>
WEB_ORIGIN=https://reckon.vercel.app
PG_POOL_MAX=1
AUTH_RATE_LIMIT_MAX=20
```

`SESSION_SECRET` must be a real secret and must not change: rotating it signs
everyone out. Generate one with `openssl rand -hex 32`.

`PG_POOL_MAX=1` is the important one. Every warm instance opens its own pool;
one connection each is what a free-tier database can survive.

`apps/api/vercel.json` sends every path to `api/index.ts`, which exports the
same Express app that runs locally — no second code path to keep in step.

## 4. The web project

| Setting | Value |
| --- | --- |
| Root directory | `apps/web` |
| Include files outside root directory | **on** |
| Framework | Vite (detected) |
| Environment | `VITE_API_URL=` (deliberately empty) |

An empty `VITE_API_URL` makes `lib/api.ts` build relative URLs, so requests go
to `/api/...` on the page's own origin and land in the rewrite.

Edit `apps/web/vercel.json` and replace `REPLACE-WITH-API-DEPLOYMENT` with the
API project's production hostname before the first deploy.

## 5. First run

1. Create the database, copy the pooled connection string.
2. `DATABASE_URL='…' node scripts/migrate.mjs` — expect three files applied.
3. Deploy the API project, note its hostname.
4. Put that hostname in `apps/web/vercel.json`, deploy the web project.
5. Open it, register, and fill in the profile. **Do not seed production** —
   `db/seed.sql` is dev fixtures with a known password.
6. Check `https://<web>/api/health` returns `{"ok":true}` through the rewrite.
7. Log an hour on your phone, on mobile data, away from your desk. That is the
   test this app exists to pass.

## 6. What free costs you

- **Vercel Hobby is licensed for non-commercial use.** This app invoices your
  clients. That is at best a grey area; Pro is the clean answer at $20/month.
- **No point-in-time recovery** on either free database tier. `scripts/backup.sh`
  is what stands between you and a bad afternoon — put it on a cron job on any
  machine that is on regularly, and keep the dumps somewhere that isn't the same
  provider.
- **Cold starts.** First request after a quiet period pays for the function
  waking and, on Neon, the database waking with it. Roughly a second, once.
- **The login rate limiter is per instance.** It holds its counts in memory, so
  20 attempts becomes 20 × however many instances are warm. It still stops a
  script; it is not a lockout.

## 7. The alternative worth considering

One small VPS (Hetzner CX22, about €4/month) running `docker compose`: Postgres,
the API, and nginx serving the built SPA. No cold starts, nothing suspends, no
licence question, `scripts/backup.sh` on the host's own cron, and one origin by
construction. `db/compose.yaml` and `scripts/dev.sh` are most of the way there.

For a system whose job is to be exact about money, €48 a year to remove four
moving parts is not an extravagance.
