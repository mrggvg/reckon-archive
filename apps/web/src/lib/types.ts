export interface Profile {
  name: string;
  /** Address kept in parts; joined with formatAddress() for printing. */
  street: string;
  postalCode: string;
  city: string;
  taxNumber: string;
  regNumber: string;
  iban: string;
  /** Name on the account, when it isn't the same as the issuer's. */
  accountHolder: string;
  vatPayer: 'DA' | 'NE';
  defaultDesc: string;
  /** The number the next invoice will carry, e.g. 003/2026. */
  nextInvoiceNumber: string;
  placeOfIssue: string;
  vatClause: string;
}

export interface Client {
  id: string;
  name: string;
  /** Address kept in parts; joined with formatAddress() for printing. */
  street: string;
  postalCode: string;
  city: string;
  taxNumber: string;
  rate: number;
  email: string;
  phone: string;
}

export interface Session {
  id: string;
  clientId: string;
  date: string; // yyyy-mm-dd
  start: string; // HH:mm
  end: string; // HH:mm
  note: string;
  invoiced: boolean;
  invoiceId: string | null;
}

export type InvoiceStatus = 'paid' | 'unpaid' | 'overdue';

export interface Invoice {
  id: string;
  number: string; // NNN/YYYY
  clientId: string;
  issueDate: string;
  dueDate: string;
  description: string;
  periodStart: string;
  periodEnd: string;
  sessionIds: string[];
  totalHours: number | null;
  rate: number | null;
  total: number;
  status: 'paid' | 'unpaid';
  paidDate: string | null;
  imported?: boolean;
}

export interface AppData {
  profile: Profile;
  clients: Client[];
  sessions: Session[];
  invoices: Invoice[];
}

export type TabName = 'track' | 'clients' | 'invoices';
