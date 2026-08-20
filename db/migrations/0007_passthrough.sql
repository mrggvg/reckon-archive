-- 0007 — an invoice raised on somebody else's behalf.
--
-- A friend does one-off work for a company, has no way to invoice it, so the
-- invoice goes out through this s.p., the friend is handed cash, and a cut is
-- kept. The whole amount is still this taxpayer's revenue — a normiranec
-- deducts nothing — so the money must stay in every tax figure while stopping
-- short of the ones that claim it was earned here.
--
-- The kept amount is stored rather than the percentage: the amount is the
-- fact, the percentage is only a way of typing it.

alter table invoices
  add column if not exists passthrough_for text not null default '',
  add column if not exists passthrough_keep_cents integer
    check (passthrough_keep_cents is null or passthrough_keep_cents >= 0);

-- Whose work it was and what was kept are one fact; neither is meaningful
-- alone, and a cut larger than the invoice is a typo, not a favour.
alter table invoices
  drop constraint if exists invoices_passthrough_consistent,
  add constraint invoices_passthrough_consistent
    check ((passthrough_for = '') = (passthrough_keep_cents is null));

alter table invoices
  drop constraint if exists invoices_passthrough_within_total,
  add constraint invoices_passthrough_within_total
    check (passthrough_keep_cents is null or passthrough_keep_cents <= total_cents);
