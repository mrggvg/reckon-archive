-- 0005 — pay the contributions before the filing arrives.
--
-- FURS states what is owed around the 20th of the following month. Someone
-- who has been paid earlier wants to settle earlier, and the amount is
-- knowable — the engine computes it — but the *accounts and references* were
-- only stored on a filing, so an estimated month had no payment code.
--
-- These are the same four pairs, kept on the profile: confirmed once, reused
-- every month. They are still never invented behind the user's back; the form
-- suggests, the user confirms, and a recorded filing teaches them if empty.

alter table profiles
  add column if not exists piz_iban        text not null default '',
  add column if not exists piz_reference   text not null default '',
  add column if not exists zz_do_iban      text not null default '',
  add column if not exists zz_do_reference text not null default '',
  add column if not exists stv_iban        text not null default '',
  add column if not exists stv_reference   text not null default '',
  add column if not exists zap_iban        text not null default '',
  add column if not exists zap_reference   text not null default '';
