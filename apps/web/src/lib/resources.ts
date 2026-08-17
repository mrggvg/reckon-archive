import type {
  ClientInput,
  InvoiceEditInput,
  InvoiceGenerateInput,
  InvoiceImportInput,
  InvoiceManualInput,
  ProfileInput,
  SessionInput,
} from '@reckon/shared';
import { api } from './api';
import type { RegistryCompany } from '@reckon/shared';
import type { TaxProfileInput } from '@reckon/shared';
import type {
  AppData,
  Client,
  ContributionMonth,
  Earnings,
  Invoice,
  Profile,
  Session,
  TaxPayment,
  TaxSummary,
  Trajectory,
} from './types';

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
    tax: () => api<TaxProfileInput>('/api/profile/tax'),
    saveTax: (input: TaxProfileInput) =>
      api<TaxProfileInput>('/api/profile/tax', { method: 'PUT', ...json(input) }),
  },

  /** What is owed to FURS, and what an hour is worth once it is paid. */
  tax: {
    summary: (year: number) => api<TaxSummary>(`/api/tax/summary?year=${year}`),
    trajectory: (year: number) => api<Trajectory>(`/api/tax/trajectory?year=${year}`),
    contributions: (year: number) =>
      api<ContributionMonth[]>(`/api/tax/contributions?year=${year}`),
    lastPaymentDetails: () =>
      api<ContributionMonth['payment']>('/api/tax/contributions/last-payment-details'),
    fileContribution: (input: unknown) =>
      api<{ id: string }>('/api/tax/contributions', { method: 'POST', ...json(input) }),
    deleteContribution: (id: string) =>
      api<void>(`/api/tax/contributions/${id}`, { method: 'DELETE' }),
    payments: (year: number) => api<TaxPayment[]>(`/api/tax/payments?year=${year}`),
    addPayment: (input: Omit<TaxPayment, 'id'>) =>
      api<TaxPayment>('/api/tax/payments', { method: 'POST', ...json(input) }),
    deletePayment: (id: string) =>
      api<void>(`/api/tax/payments/${id}`, { method: 'DELETE' }),
    saveAssessment: (year: number, input: { assessed: number; receivedOn: string; note: string }) =>
      api<unknown>(`/api/tax/assessments/${year}`, { method: 'PUT', ...json(input) }),
  },

  earnings: {
    effectiveRate: (basis: 'payment' | 'service') =>
      api<Earnings>(`/api/earnings/effective-rate?basis=${basis}`),
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
    /** No hours behind it: the caller states the period and the amount. */
    manual: (input: InvoiceManualInput) =>
      api<Invoice>('/api/invoices/manual', { method: 'POST', ...json(input) }),
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
