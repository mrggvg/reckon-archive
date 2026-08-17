import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  ClientInput,
  InvoiceEditInput,
  InvoiceGenerateInput,
  InvoiceImportInput,
  InvoiceManualInput,
  ProfileInput,
  SessionInput,
} from '@reckon/shared';
import { ApiError } from '../lib/api';
import { resources } from '../lib/resources';
import { emptyData } from '../lib/storage';
import type { AppData, Client, Invoice } from '../lib/types';
import { StoreContext } from './context';

/**
 * The ledger, held on the server.
 *
 * Everything is loaded once on sign-in and kept in memory; each mutation goes
 * to the API and the reply is folded back into that copy, so what the screen
 * shows is always something the database agreed to. Nothing is written
 * optimistically: an invoice that appears and then vanishes is worse than one
 * that takes a moment to appear.
 */
export function StoreProvider({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const [data, setData] = useState<AppData>(emptyData);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [toastShown, setToastShown] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);

  const toast = useCallback((message: string) => {
    setToastMsg(message);
    setToastShown(true);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastShown(false), 2200);
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  // Deliberately does not flip back to 'loading': a reload after an invoice is
  // issued should leave the ledger on screen, not blank it for a moment.
  const reload = useCallback(async () => {
    try {
      setData(await resources.bootstrap());
      setLoadError('');
      setStatus('ready');
    } catch (err) {
      setLoadError(
        err instanceof ApiError ? err.message : 'Podatkov ni bilo mogoče naložiti',
      );
      setStatus('error');
    }
  }, []);

  // Re-runs on sign-in as a different account, which is what clears the last
  // account's records out of memory.
  //
  // The lint rule below guards against effects that set state synchronously and
  // cascade a second render. Nothing here does: every setState in `reload`
  // happens after the request has come back, which is the fetch-on-mount the
  // rule can't distinguish from the pattern it's aimed at.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload, userId]);

  const patch = useCallback((mutate: (draft: AppData) => void) => {
    setData((current) => {
      const draft = structuredClone(current);
      mutate(draft);
      return draft;
    });
  }, []);

  const upsertClient = useCallback(
    (client: Client) =>
      patch((d) => {
        const at = d.clients.findIndex((c) => c.id === client.id);
        if (at === -1) d.clients.push(client);
        else d.clients[at] = client;
        d.clients.sort(
          (a, b) =>
            Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name, 'sl'),
        );
      }),
    [patch],
  );

  const upsertInvoice = useCallback(
    (invoice: Invoice) =>
      patch((d) => {
        const at = d.invoices.findIndex((i) => i.id === invoice.id);
        if (at === -1) d.invoices.unshift(invoice);
        else d.invoices[at] = invoice;
      }),
    [patch],
  );

  const actions = useMemo(
    () => ({
      reload,

      saveProfile: async (input: ProfileInput) => {
        const profile = await resources.profile.save(input);
        patch((d) => {
          d.profile = profile;
        });
      },

      createClient: async (input: ClientInput) => {
        const client = await resources.clients.create(input);
        upsertClient(client);
        return client;
      },

      updateClient: async (id: string, input: ClientInput) => {
        upsertClient(await resources.clients.update(id, input));
      },

      setClientActive: async (id: string, isActive: boolean) => {
        upsertClient(await resources.clients.setActive(id, isActive));
      },

      /** Resolves to true when the client was kept but deactivated. */
      removeClient: async (id: string) => {
        const result = await resources.clients.remove(id);
        if (result.client) upsertClient(result.client);
        else patch((d) => (d.clients = d.clients.filter((c) => c.id !== id)));
        return result.deactivated;
      },

      createSession: async (input: SessionInput) => {
        const session = await resources.sessions.create(input);
        patch((d) => {
          d.sessions.unshift(session);
          d.sessions.sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));
        });
      },

      updateSession: async (id: string, input: SessionInput) => {
        const session = await resources.sessions.update(id, input);
        patch((d) => {
          const at = d.sessions.findIndex((s) => s.id === id);
          if (at !== -1) d.sessions[at] = session;
          d.sessions.sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));
        });
      },

      removeSession: async (id: string) => {
        await resources.sessions.remove(id);
        patch((d) => (d.sessions = d.sessions.filter((s) => s.id !== id)));
      },

      // Generating and deleting invoices moves hours in and out of the billed
      // pool, so both re-read the ledger rather than guessing at the effect.
      generateInvoice: async (input: InvoiceGenerateInput) => {
        const invoice = await resources.invoices.generate(input);
        await reload();
        return invoice;
      },

      // Nothing is billed by it, so the ledger's hours are untouched.
      manualInvoice: async (input: InvoiceManualInput) => {
        const invoice = await resources.invoices.manual(input);
        upsertInvoice(invoice);
        return invoice;
      },

      importInvoice: async (input: InvoiceImportInput) => {
        const invoice = await resources.invoices.import(input);
        upsertInvoice(invoice);
        return invoice;
      },

      updateInvoice: async (id: string, input: InvoiceEditInput) => {
        upsertInvoice(await resources.invoices.update(id, input));
      },

      setInvoicePaid: async (id: string, paid: boolean, paidDate: string | null) => {
        upsertInvoice(await resources.invoices.setPayment(id, paid, paidDate));
      },

      removeInvoice: async (id: string) => {
        await resources.invoices.remove(id);
        await reload();
      },

      restore: async (backup: unknown) => {
        setData(await resources.restore(backup));
      },
    }),
    [patch, reload, upsertClient, upsertInvoice],
  );

  const value = useMemo(
    () => ({
      data,
      status,
      loadError,
      ...actions,
      toast,
      toastMessage: toastMsg,
      toastVisible: toastShown,
    }),
    [data, status, loadError, actions, toast, toastMsg, toastShown],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
