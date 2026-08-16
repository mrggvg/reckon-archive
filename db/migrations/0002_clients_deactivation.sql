-- 0002 — clients are deactivated, not deleted.
--
-- A client named on an issued invoice can't be removed: the invoice snapshots
-- the name it was addressed to, but the tracked hours behind it still point at
-- the client record, and a freelancer who stops working for someone still needs
-- last year's hours to add up. Deactivation takes the client out of the pickers
-- and leaves the history intact.

alter table clients
  add column if not exists is_active boolean not null default true;

-- The pickers only ever ask for active clients, so index that case alone.
drop index if exists clients_user_name_idx;
create index clients_user_active_name_idx
  on clients (user_id, company_name)
  where is_active;
