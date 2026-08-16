-- 0003 — an invoice keeps the hours it was generated from reachable.
--
-- Nothing structural changes here; this file records the index that the
-- "which hours are on this invoice" lookup needs once invoices are served from
-- the API rather than reconstructed in the browser from a stored id list.

create index if not exists work_sessions_invoice_lookup_idx
  on work_sessions (user_id, invoice_id)
  where invoice_id is not null;
