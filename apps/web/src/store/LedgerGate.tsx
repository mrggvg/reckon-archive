import type { ReactNode } from 'react';
import { AlertIcon } from '../components/icons';
import { btn } from '../styles/cx';
import { useStore } from './context';

/**
 * Holds the app back until the ledger has actually arrived.
 *
 * Rendering the screens against an empty dataset would be worse than a pause:
 * every view would report zero hours, no clients and no invoices, which is
 * indistinguishable from a new account and alarming on an established one.
 */
export function LedgerGate({ children }: { children: ReactNode }) {
  const { status, loadError, reload } = useStore();

  if (status === 'loading') {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-2 p-6">
        <span className="text-2xl font-bold tracking-tight">Reckon</span>
        <span className="font-mono text-2xs uppercase tracking-wider text-muted-fg">
          nalagam podatke
        </span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-xs">
          <AlertIcon className="mx-auto mb-3 size-6 text-warning-fg" />
          <h1 className="mb-1 text-lg font-bold tracking-tight">
            Podatkov ni bilo mogoče naložiti
          </h1>
          <p className="mt-0 mb-4 text-sm text-muted-fg">{loadError}</p>
          <button className={`${btn.primary} w-full`} onClick={() => void reload()}>
            Poskusi znova
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
