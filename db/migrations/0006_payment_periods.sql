-- 0006 — a payment that says what it settled.
--
-- "465,79 paid on 18 August" is a fact without a subject. What matters a year
-- later is which month's contributions it cleared, and which of the four
-- groups — because they are four separate transfers to three accounts, and a
-- month is only really settled when all four are.

alter table tax_payments
  -- Which period the payment settles. Null for a payment that isn't tied to
  -- one, such as a year-end balance.
  add column if not exists period_year integer
    check (period_year is null or period_year between 2000 and 2100),
  add column if not exists period_month integer
    check (period_month is null or period_month between 1 and 12),
  -- Which contribution group, when it is one of them.
  add column if not exists group_key text
    check (group_key is null or group_key in ('piz', 'zz_do', 'stv', 'zap'));

create index if not exists tax_payments_period_idx
  on tax_payments (user_id, period_year, period_month);
