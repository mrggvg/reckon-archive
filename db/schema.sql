-- Reckon — full schema, single source of truth.
--
-- There are no migrations yet on purpose: `npm run db:reset` drops everything
-- and reapplies this file. Switch to migrations the day there is an invoice in
-- here you can't afford to lose.
--
-- Conventions:
--   * Money is integer cents. Never float, never numeric-for-money.
--   * Day-granularity fields are `date`; instants are `timestamptz`.
--   * Every user-owned table carries user_id, so every query scopes with one
--     predicate and a stray join can't leak across accounts.

drop schema if exists public cascade;
create schema public;

-- ─────────────────────────────────────────────────────────────────────────────
-- Accounts
-- ─────────────────────────────────────────────────────────────────────────────

create table users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

-- Case-insensitive uniqueness without the citext extension.
create unique index users_email_lower_key on users (lower(email));

-- Issuer details. One row per user; printed on every invoice.
create table profiles (
  user_id                    uuid primary key references users (id) on delete cascade,
  full_name                  text not null default '',
  address                    text not null default '',
  tax_number                 text not null default '',
  reg_number                 text not null default '',
  iban                       text not null default '',
  -- Share of paid income set aside for akontacija dohodnine.
  tax_rate_percent           numeric(5, 2) not null default 4
                               check (tax_rate_percent >= 0 and tax_rate_percent <= 100),
  vat_payer                  boolean not null default false,
  tax_system                 text not null default 'normiranec'
                               check (tax_system in ('normiranec', 'dejanski')),
  monthly_contribution_cents integer not null default 0
                               check (monthly_contribution_cents >= 0),
  default_description        text not null default '',
  last_invoice_number        text not null default '',
  place_of_issue             text not null default '',
  vat_clause                 text not null default '',
  updated_at                 timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Clients
-- ─────────────────────────────────────────────────────────────────────────────

create table clients (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users (id) on delete cascade,
  company_name text not null check (length(btrim(company_name)) > 0),
  address      text not null default '',
  tax_number   text not null default '',
  rate_cents   integer not null default 0 check (rate_cents >= 0),
  email        text not null default '',
  phone        text not null default '',
  created_at   timestamptz not null default now()
);

create index clients_user_name_idx on clients (user_id, company_name);

-- ─────────────────────────────────────────────────────────────────────────────
-- Invoices
-- ─────────────────────────────────────────────────────────────────────────────

create table invoices (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users (id) on delete cascade,
  -- Soft reference: deleting a client must never destroy invoice history, so
  -- the printed identity lives in the snapshot columns below.
  client_id    uuid references clients (id) on delete set null,
  number       text not null,
  issue_date   date not null,
  due_date     date not null,
  description  text not null default 'Storitve',
  period_start date not null,
  period_end   date not null,

  total_cents   integer not null check (total_cents >= 0),
  -- Null for imported invoices, which carry a hand-entered total instead of
  -- linked hours.
  total_minutes integer check (total_minutes >= 0),
  rate_cents    integer check (rate_cents >= 0),

  status   text not null default 'unpaid' check (status in ('unpaid', 'paid')),
  paid_on  date,
  -- True for invoices typed in from outside the app; they have no linked hours.
  imported boolean not null default false,

  -- The customer as printed. An invoice is a document: editing or deleting the
  -- client record afterwards must not rewrite what was issued.
  -- (The issuer side still renders live from `profiles`. Snapshot those too the
  -- day you start archiving generated PDFs.)
  client_name       text not null,
  client_address    text not null default '',
  client_tax_number text not null default '',

  created_at timestamptz not null default now(),

  constraint invoices_number_unique unique (user_id, number),
  constraint invoices_paid_has_date check ((status = 'paid') = (paid_on is not null)),
  constraint invoices_period_ordered check (period_end >= period_start),
  constraint invoices_due_after_issue check (due_date >= issue_date)
);

create index invoices_user_issued_idx on invoices (user_id, issue_date desc);
-- Outstanding money: the overview and the overdue banner both start here.
create index invoices_outstanding_idx on invoices (user_id, due_date)
  where status <> 'paid';

-- ─────────────────────────────────────────────────────────────────────────────
-- Tracked hours
-- ─────────────────────────────────────────────────────────────────────────────

-- Named work_sessions, not sessions: connect-pg-simple owns a table called
-- "session" for logins, and one letter of difference is a trap.
create table work_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users (id) on delete cascade,
  -- Hours survive the client being deleted; they just become unassigned.
  client_id  uuid references clients (id) on delete set null,
  -- Clearing this is what "unbill" means — deleting an invoice frees its hours.
  invoice_id uuid references invoices (id) on delete set null,

  work_date  date not null,
  start_time time not null,
  end_time   time not null,
  note       text not null default '',

  -- Duration, wrapping past midnight exactly like the app does: an entry from
  -- 22:00 to 02:00 is 240 minutes, not -1200.
  minutes integer generated always as (
    ((extract(epoch from (end_time - start_time))::integer / 60) + 1440) % 1440
  ) stored,

  created_at timestamptz not null default now()
);

create index work_sessions_user_date_idx on work_sessions (user_id, work_date desc);
-- Drives the invoice-candidate list and the "unbilled hours" figures.
create index work_sessions_unbilled_idx on work_sessions (user_id, client_id)
  where invoice_id is null;
create index work_sessions_invoice_idx on work_sessions (invoice_id)
  where invoice_id is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- Tax ledger
-- ─────────────────────────────────────────────────────────────────────────────

create table tax_payments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users (id) on delete cascade,
  kind         text not null check (kind in ('dohodnina', 'prispevki', 'drugo')),
  paid_on      date not null,
  amount_cents integer not null check (amount_cents > 0),
  note         text not null default '',
  created_at   timestamptz not null default now()
);

create index tax_payments_user_date_idx on tax_payments (user_id, paid_on desc);

-- One assessed dohodnina figure per year, from the FURS odločba.
create table tax_assessments (
  user_id      uuid not null references users (id) on delete cascade,
  year         integer not null check (year between 2000 and 2100),
  amount_cents integer not null check (amount_cents >= 0),
  updated_at   timestamptz not null default now(),
  primary key (user_id, year)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Login sessions (connect-pg-simple)
-- ─────────────────────────────────────────────────────────────────────────────

create table "session" (
  sid    varchar not null primary key,
  sess   json not null,
  expire timestamp(6) not null
);

create index session_expire_idx on "session" (expire);
