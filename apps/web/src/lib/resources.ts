import type {
  ClientInput,
  InvoiceEditInput,
  InvoiceGenerateInput,
  InvoiceImportInput,
  ProfileInput,
  SessionInput,
} from '@reckon/shared';
import { api } from './api';
import type { RegistryCompany } from '@reckon/shared';
import type { AppData, Client, Invoice, Profile, Session } from './types';

/*
 * Every endpoint the app talks to, in one place.
 *
 * The views never build a URL or a method; they call one of these. That keeps
 * the wire format in a single file when it changes, and makes the set of things
 * the browser can ask the server to do readable at a glance.
 */

const json = (body: unknown) => ({ body: JSON.stringify(body) });

export const resources = {
  /** The whole ledger, in one request, on sign-in. */
  bootstrap: () => api<AppData>('/api/bootstrap'),

  restore: (backup: unknown) =>
    api<AppData>('/api/bootstrap/restore', { method: 'POST', ...json(backup) }),

  profile: {
    save: (input: ProfileInput) =>
      api<Profile>('/api/profile', { method: 'PUT', ...json(input) }),
  },

  /** Public registers, asked through our own server rather than the browser. */
  lookup: {
    company: (taxNumber: string) =>
      api<RegistryCompany>(`/api/lookup/company?taxNumber=${encodeURIComponent(taxNumber)}`),
  },

  clients: {
    create: (input: ClientInput) =>
      api<Client>('/api/clients', { method: 'POST', ...json(input) }),
    update: (id: string, input: ClientInput) =>
      api<Client>(`/api/clients/${id}`, { method: 'PUT', ...json(input) }),
    setActive: (id: string, isActive: boolean) =>
      api<Client>(`/api/clients/${id}/active`, {
        method: 'PATCH',
        ...json({ isActive }),
      }),
    /** Deactivates a client with history; deletes one without. */
    remove: (id: string) =>
      api<{ deactivated: boolean; client: Client | null }>(`/api/clients/${id}`, {
        method: 'DELETE',
      }),
  },

  sessions: {
    create: (input: SessionInput) =>
      api<Session>('/api/sessions', { method: 'POST', ...json(input) }),
    update: (id: string, input: SessionInput) =>
      api<Session>(`/api/sessions/${id}`, { method: 'PUT', ...json(input) }),
    remove: (id: string) => api<void>(`/api/sessions/${id}`, { method: 'DELETE' }),
  },

  invoices: {
    /** The server prices it from the hours and assigns the number. */
    generate: (input: InvoiceGenerateInput) =>
      api<Invoice>('/api/invoices', { method: 'POST', ...json(input) }),
    import: (input: InvoiceImportInput) =>
      api<Invoice>('/api/invoices/import', { method: 'POST', ...json(input) }),
    update: (id: string, input: InvoiceEditInput) =>
      api<Invoice>(`/api/invoices/${id}`, { method: 'PATCH', ...json(input) }),
    setPayment: (id: string, paid: boolean, paidDate: string | null) =>
      api<Invoice>(`/api/invoices/${id}/payment`, {
        method: 'PATCH',
        ...json({ paid, paidDate }),
      }),
    remove: (id: string) => api<void>(`/api/invoices/${id}`, { method: 'DELETE' }),
  },
};
