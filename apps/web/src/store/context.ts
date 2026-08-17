import { createContext, useContext } from 'react';
import type {
  ClientInput,
  InvoiceEditInput,
  InvoiceGenerateInput,
  InvoiceImportInput,
  InvoiceManualInput,
  ProfileInput,
  SessionInput,
} from '@reckon/shared';
import type { AppData, Client, Invoice } from '../lib/types';

/**
 * What a view may do to the ledger.
 *
 * Each action is one request to the API; every one of them can fail, so they
 * all return promises and callers are expected to say so when they do. There is
 * deliberately no general "mutate the data" escape hatch: a change the server
 * hasn't accepted isn't a change.
 */
export interface StoreValue {
  data: AppData;
  status: 'loading' | 'ready' | 'error';
  loadError: string;
  reload: () => Promise<void>;

  saveProfile: (input: ProfileInput) => Promise<void>;

  createClient: (input: ClientInput) => Promise<Client>;
  updateClient: (id: string, input: ClientInput) => Promise<void>;
  setClientActive: (id: string, isActive: boolean) => Promise<void>;
  /** Resolves to true when the client was kept but deactivated. */
  removeClient: (id: string) => Promise<boolean>;

  createSession: (input: SessionInput) => Promise<void>;
  updateSession: (id: string, input: SessionInput) => Promise<void>;
  removeSession: (id: string) => Promise<void>;

  generateInvoice: (input: InvoiceGenerateInput) => Promise<Invoice>;
  manualInvoice: (input: InvoiceManualInput) => Promise<Invoice>;
  importInvoice: (input: InvoiceImportInput) => Promise<Invoice>;
  updateInvoice: (id: string, input: InvoiceEditInput) => Promise<void>;
  setInvoicePaid: (id: string, paid: boolean, paidDate: string | null) => Promise<void>;
  removeInvoice: (id: string) => Promise<void>;

  restore: (backup: unknown) => Promise<void>;

  toast: (message: string) => void;
  /** Rendered by App, which knows whether a panel is covering the right edge. */
  toastMessage: string;
  toastVisible: boolean;
}

export const StoreContext = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
