import type { Client, Session } from './types';

export interface EntryPrefill {
  clientId?: string;
  date?: string;
  start?: string;
  end?: string;
  note?: string;
}

export type SheetState =
  | { kind: 'entry'; editing?: Session; prefill?: EntryPrefill }
  | { kind: 'dayDetail'; date: string }
  | { kind: 'client'; editing?: Client }
  | { kind: 'newInvoice'; clientId?: string }
  | { kind: 'importInvoice' }
  | { kind: 'viewInvoice'; id: string }
  | { kind: 'editInvoice'; id: string }
  | { kind: 'timesheet'; id: string }
  | { kind: 'taxPayment' }
  | { kind: 'profile' };

export type OpenSheet = (sheet: SheetState) => void;
