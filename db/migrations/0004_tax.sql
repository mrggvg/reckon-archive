-- 0004 — what the ledger owes FURS.
--
-- Two obligations that behave nothing alike, so two shapes of record:
-- contributions arrive monthly on a filing and are known in advance, while tax
-- follows revenue and is only known once money lands. Both are paid by
-- transfer, so both carry the account and reference the payment must quote.
--
-- Money stays integer cents, like everywhere else in this schema.

-- ── the issuer's own tax position ────────────────────────────────────────────
alter table profiles
  -- Drives the contribution relief tier and the partial first year.
  add column if not exists business_start_date date,
  -- Full monthly insurance base (polna zavarovalna osnova); FURS revises it
  -- yearly, so it is the user's to correct rather than the app's to assume.
  add column if not exists contribution_base_cents integer not null default 152162
    check (contribution_base_cents >= 0),
  -- Escape hatch when the computed relief tier disagrees with the filing.
  add column if not exists contribution_relief_override numeric(4,3)
    check (contribution_relief_override is null
           or (contribution_relief_override >= 0 and contribution_relief_override <= 1)),
  add column if not exists weekly_hours integer not null default 40
    check (weekly_hours between 1 and 80),
  -- 'full' = polni normiranec, 'part' = popoldanski: different bands entirely.
  add column if not exists normiranec_kind text not null default 'full'
    check (normiranec_kind in ('full', 'part')),
  -- The DD-IPDO projection and the installment it produced. Reference only:
  -- neither has any bearing on what is finally owed.
  add column if not exists declared_monthly_estimate_cents integer
    check (declared_monthly_estimate_cents is null or declared_monthly_estimate_cents >= 0),
  add column if not exists official_installment_cents integer
    check (official_installment_cents is null or official_installment_cents >= 0),
  add column if not exists official_installment_frequency text
    check (official_installment_frequency is null
           or official_installment_frequency in ('monthly', 'quarterly')),
  -- Where an income-tax payment goes. Defaulted, editable, never guessed at
  -- silently: FURS matches a payment to an obligation by its reference.
  add column if not exists dohodnina_iban text not null default 'SI56011008881000030',
  add column if not exists dohodnina_reference text not null default '';

-- ── one row per month of contributions ───────────────────────────────────────
create table if not exists contribution_periods (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users (id) on delete cascade,
  period_year  integer not null check (period_year between 2000 and 2100),
  period_month integer not null check (period_month between 1 and 12),

  base_cents   integer not null check (base_cents >= 0),
  piz_cents    integer not null check (piz_cents >= 0),
  zz_do_cents  integer not null check (zz_do_cents >= 0),
  stv_cents    integer not null check (stv_cents >= 0),
  zap_cents    integer not null check (zap_cents >= 0),
  total_cents  integer not null check (total_cents >= 0),

  -- 'estimated' until the real PODO-OPSVZ figures replace it.
  source     text not null default 'filed' check (source in ('estimated', 'filed')),

  -- Each group is a separate payment to a separate account, distinguished by
  -- its reference. Copied from the filing, never derived: an invented suffix
  -- means the money lands against the wrong obligation.
  piz_iban        text not null default '',
  piz_reference   text not null default '',
  zz_do_iban      text not null default '',
  zz_do_reference text not null default '',
  stv_iban        text not null default '',
  stv_reference   text not null default '',
  zap_iban        text not null default '',
  zap_reference   text not null default '',

  created_at timestamptz not null default now(),

  constraint contribution_periods_unique unique (user_id, period_year, period_month)
);

create index if not exists contribution_periods_user_period_idx
  on contribution_periods (user_id, period_year, period_month);

-- ── what was actually remitted ───────────────────────────────────────────────
create table if not exists tax_payments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users (id) on delete cascade,
  paid_on      date not null,
  amount_cents integer not null check (amount_cents > 0),
  kind         text not null check (kind in ('contributions', 'income_tax', 'other')),
  note         text not null default '',
  created_at   timestamptz not null default now()
);

create index if not exists tax_payments_user_date_idx
  on tax_payments (user_id, paid_on desc);

-- ── and what FURS finally assessed ───────────────────────────────────────────
create table if not exists tax_assessments (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users (id) on delete cascade,
  tax_year       integer not null check (tax_year between 2000 and 2100),
  assessed_cents integer not null check (assessed_cents >= 0),
  received_on    date not null,
  note           text not null default '',

  constraint tax_assessments_unique unique (user_id, tax_year)
);
