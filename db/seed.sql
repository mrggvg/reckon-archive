-- Development fixtures. Applied by `npm run db:reset` right after schema.sql.
-- Fixed UUIDs so you can hardcode them while poking at endpoints.
--
-- The dev user signs in with:  dev@reckon.local / reckon-dev-password
-- (scrypt hash, same format auth.service.ts writes).

insert into users (id, email, password_hash) values
  ('11111111-1111-1111-1111-111111111111', 'dev@reckon.local', 'scrypt$2pMpN92S27oJyVxR4bK8tQ==$72KQCa4dDZxRO7c5usSzQVp6P3EKVKWaNNeNkgEFg9VkdQqRPOIes6ySW+T7V/ezrpjuv8Qk6EhV8gFd5qDPfw==');

insert into profiles (
  user_id, full_name, address, tax_number, iban,
  tax_rate_percent, vat_payer, monthly_contribution_cents,
  default_description, place_of_issue, vat_clause
) values (
  '11111111-1111-1111-1111-111111111111',
  'Dev Uporabnik s.p.',
  'Izletniška pot 1, 6000 Koper',
  '12345678',
  'SI56 1010 0005 8079 036',
  4,
  false,
  65100,
  'Reševanje iz vode',
  'Koper',
  'Nisem zavezanec za DDV po 1. odstavku 94. člena ZDDV-1.'
);

insert into clients (id, user_id, company_name, address, tax_number, rate_cents, email) values
  ('22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111111',
   'Vikram d.o.o.', 'Vojkovo nabrežje 31a, 6000 Koper', '29825962', 1500, 'racuni@vikram.si'),
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111',
   'Nordis d.o.o.', 'Dunajska cesta 10, 1000 Ljubljana', '87654321', 3000, '');

-- One invoice already issued and paid, one still outstanding and overdue.
insert into invoices (
  id, user_id, client_id, number, issue_date, due_date, description,
  period_start, period_end, total_cents, total_minutes, rate_cents,
  status, paid_on, client_name, client_address, client_tax_number
) values
  ('33333333-3333-3333-3333-333333333331', '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222221', '001/2026', '2026-07-06', '2026-07-20',
   'Reševanje iz vode', '2026-07-01', '2026-07-03', 45000, 1800, 1500,
   'paid', '2026-07-15',
   'Vikram d.o.o.', 'Vojkovo nabrežje 31a, 6000 Koper', '29825962'),
  ('33333333-3333-3333-3333-333333333332', '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', '002/2026', '2026-07-31', '2026-08-07',
   'Svetovanje', '2026-07-20', '2026-07-21', 36000, 720, 3000,
   'unpaid', null,
   'Nordis d.o.o.', 'Dunajska cesta 10, 1000 Ljubljana', '87654321');

-- Billed hours (linked to the invoices above).
insert into work_sessions (user_id, client_id, invoice_id, work_date, start_time, end_time, note) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221',
   '33333333-3333-3333-3333-333333333331', '2026-07-01', '09:00', '19:00', 'Reševanje iz vode'),
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221',
   '33333333-3333-3333-3333-333333333331', '2026-07-02', '09:00', '19:00', 'Reševanje iz vode'),
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221',
   '33333333-3333-3333-3333-333333333331', '2026-07-03', '09:00', '19:00', 'Reševanje iz vode'),
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
   '33333333-3333-3333-3333-333333333332', '2026-07-20', '10:00', '16:00', 'Integracija'),
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
   '33333333-3333-3333-3333-333333333332', '2026-07-21', '10:00', '16:00', 'Integracija');

-- Unbilled hours, including one shift running past midnight.
insert into work_sessions (user_id, client_id, work_date, start_time, end_time, note) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221',
   '2026-08-03', '09:00', '19:00', 'Reševanje iz vode'),
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221',
   '2026-08-04', '09:00', '11:30', 'Reševanje iz vode'),
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
   '2026-08-04', '13:00', '17:00', 'Svetovanje'),
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
   '2026-08-11', '22:00', '02:00', 'Nočna izmena');

insert into tax_payments (user_id, kind, paid_on, amount_cents, note) values
  ('11111111-1111-1111-1111-111111111111', 'prispevki', '2026-06-15', 65100, 'Maj'),
  ('11111111-1111-1111-1111-111111111111', 'prispevki', '2026-07-15', 65100, 'Junij'),
  ('11111111-1111-1111-1111-111111111111', 'dohodnina', '2026-07-15', 1800, 'Akontacija Q2');

insert into tax_assessments (user_id, year, amount_cents) values
  ('11111111-1111-1111-1111-111111111111', 2025, 42000);
