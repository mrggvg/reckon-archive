import { fromCents, minutesToHours, toCents } from '@reckon/shared';

/*
 * The database speaks snake_case and integer cents; the browser speaks
 * camelCase and euros. Every translation between the two happens here, so a
 * column rename is one edit and a unit mistake has one place to hide.
 */

export interface ProfileRow {
  full_name: string;
  street: string;
  postal_code: string;
  city: string;
  tax_number: string;
  reg_number: string;
  iban: string;
  account_holder: string;
  vat_payer: boolean;
  default_description: string;
  next_invoice_number: string;
  place_of_issue: string;
  vat_clause: string;
}

export function toProfileDto(row: ProfileRow) {
  return {
    name: row.full_name,
    street: row.street,
    postalCode: row.postal_code,
    city: row.city,
    taxNumber: row.tax_number,
    regNumber: row.reg_number,
    iban: row.iban,
    accountHolder: row.account_holder,
    vatPayer: row.vat_payer ? ('DA' as const) : ('NE' as const),
    defaultDesc: row.default_description,
    nextInvoiceNumber: row.next_invoice_number,
    placeOfIssue: row.place_of_issue,
    vatClause: row.vat_clause,
  };
}

export interface ClientRow {
  id: string;
  company_name: string;
  street: string;
  postal_code: string;
  city: string;
  tax_number: string;
  rate_cents: number;
  email: string;
  phone: string;
  is_active: boolean;
}

export function toClientDto(row: ClientRow) {
  return {
    id: row.id,
    name: row.company_name,
    street: row.street,
    postalCode: row.postal_code,
    city: row.city,
    taxNumber: row.tax_number,
    rate: fromCents(row.rate_cents),
    email: row.email,
    phone: row.phone,
    isActive: row.is_active,
  };
}

export interface SessionRow {
  id: string;
  client_id: string | null;
  invoice_id: string | null;
  work_date: string;
  start_time: string;
  end_time: string;
  note: string;
}

/** `date` and `time` come back as strings; trim seconds off the clock times. */
export function toSessionDto(row: SessionRow) {
  return {
    id: row.id,
    clientId: row.client_id ?? '',
    date: row.work_date,
    start: row.start_time.slice(0, 5),
    end: row.end_time.slice(0, 5),
    note: row.note,
    invoiced: row.invoice_id !== null,
    invoiceId: row.invoice_id,
  };
}

export interface InvoiceRow {
  id: string;
  client_id: string | null;
  number: string;
  issue_date: string;
  due_date: string;
  description: string;
  period_start: string;
  period_end: string;
  total_cents: number;
  total_minutes: number | null;
  rate_cents: number | null;
  status: 'unpaid' | 'paid';
  paid_on: string | null;
  imported: boolean;
  client_name: string;
  client_address: string;
  client_tax_number: string;
}

export function toInvoiceDto(row: InvoiceRow, sessionIds: string[] = []) {
  return {
    id: row.id,
    number: row.number,
    clientId: row.client_id ?? '',
    issueDate: row.issue_date,
    dueDate: row.due_date,
    description: row.description,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    sessionIds,
    totalHours: row.total_minutes === null ? null : minutesToHours(row.total_minutes),
    rate: row.rate_cents === null ? null : fromCents(row.rate_cents),
    total: fromCents(row.total_cents),
    status: row.status,
    paidDate: row.paid_on,
    imported: row.imported,
    // The customer as printed, kept even if the client record later changes.
    clientName: row.client_name,
    clientAddress: row.client_address,
    clientTaxNumber: row.client_tax_number,
  };
}

export { toCents };
