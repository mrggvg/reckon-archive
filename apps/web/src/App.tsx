import { useCallback, useState } from 'react';
import {
  ChartIcon,
  ClientsIcon,
  ClockIcon,
  InvoiceIcon,
  PlusIcon,
  SignOutIcon,
  TaxIcon,
  UserIcon,
} from './components/icons';
import { useAuth } from './auth/context';
import { ClientSheet } from './sheets/ClientSheet';
import { DayDetailSheet } from './sheets/DayDetailSheet';
import { EditInvoiceSheet } from './sheets/EditInvoiceSheet';
import { EntrySheet } from './sheets/EntrySheet';
import { ImportInvoiceSheet } from './sheets/ImportInvoiceSheet';
import { NewInvoiceSheet } from './sheets/NewInvoiceSheet';
import { ProfileSheet } from './sheets/ProfileSheet';
import { TaxPaymentSheet } from './sheets/TaxPaymentSheet';
import { TimesheetSheet } from './sheets/TimesheetSheet';
import { ViewInvoiceSheet } from './sheets/ViewInvoiceSheet';
import { iconBtn } from './styles/cx';
import { useStore } from './store/context';

const navItem = (active: boolean) =>
  'flex cursor-pointer items-center gap-2.5 rounded-lg border-none px-2.5 py-2 text-left text-sm font-medium transition-all duration-150 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:opacity-80 ' +
  (active ? 'bg-primary text-primary-fg' : 'bg-transparent text-muted-fg hover:bg-muted hover:text-fg');

const tabItem = (active: boolean) =>
  'flex flex-1 cursor-pointer flex-col items-center gap-1 rounded-lg border-none py-2 text-2xs font-semibold uppercase tracking-wide transition-all duration-150 [&>svg]:size-5 ' +
  (active ? 'bg-primary text-primary-fg' : 'bg-transparent text-muted-fg');
import type { SheetState } from './lib/sheets';
import type { TabName } from './lib/types';
import { ClientsView } from './views/ClientsView';
import { InvoicesView } from './views/InvoicesView';
import { OverviewView } from './views/OverviewView';
import { TaxView } from './views/TaxView';
import { TrackView } from './views/TrackView';

const TABS: {
  name: TabName;
  label: string;
  icon: (p: { className?: string }) => React.ReactElement;
}[] = [
  { name: 'track', label: 'Track', icon: ClockIcon },
  { name: 'clients', label: 'Clients', icon: ClientsIcon },
  { name: 'invoices', label: 'Invoices', icon: InvoiceIcon },
  { name: 'overview', label: 'Overview', icon: ChartIcon },
];

export default function App() {
  const { data } = useStore();
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<TabName>('track');
  const [stack, setStack] = useState<SheetState[]>([]);

  const openSheet = useCallback((sheet: SheetState) => {
    setStack((s) => [...s, sheet]);
  }, []);
  const closeSheet = useCallback(() => {
    setStack((s) => s.slice(0, -1));
  }, []);
  const closeAllSheets = useCallback(() => setStack([]), []);

  const replaceSheet = useCallback((sheet: SheetState) => {
    setStack((s) => [...s.slice(0, -1), sheet]);
  }, []);

  const goTab = useCallback(
    (name: TabName) => {
      setTab(name);
      closeAllSheets();
    },
    [closeAllSheets],
  );

  const handleFab = () => {
    if (tab === 'track') openSheet({ kind: 'entry' });
    else if (tab === 'clients') openSheet({ kind: 'client' });
    else if (tab === 'invoices') openSheet({ kind: 'newInvoice' });
    else if (tab === 'tax') openSheet({ kind: 'taxPayment' });
  };

  const profileTag = data.profile.name || 'set up profile →';
  const top = stack[stack.length - 1];

  return (
    <div className="flex h-svh overflow-hidden">
      <aside className="hidden h-full w-60 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-card px-3 py-4 desk:flex">
        <div className="flex flex-col px-2.5 pt-1 pb-4 leading-tight">
          <span className="text-xl font-bold tracking-tight">Reckon</span>
          <span className="mt-1 font-mono text-2xs uppercase tracking-wider text-muted-fg">
            freelance ledger
          </span>
        </div>
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.name}
              className={navItem(tab === t.name)}
              onClick={() => goTab(t.name)}
            >
              <Icon />
              {t.label}
            </button>
          );
        })}
        <button
          className={navItem(tab === 'tax')}
          onClick={() => goTab('tax')}
        >
          <TaxIcon />
          Tax
        </button>

        <div className="mt-auto">
          <button className={navItem(false)} onClick={() => openSheet({ kind: 'profile' })}>
            <UserIcon />
            <span className="truncate">{profileTag}</span>
          </button>
          <button
            className={`${navItem(false)} hover:bg-error-bg hover:text-error-fg`}
            onClick={() => void signOut()}
          >
            <SignOutIcon />
            Sign out
          </button>
          <div className="truncate px-2.5 pt-2 pb-0.5 font-mono text-2xs text-muted-fg" title={user?.email}>
            {user?.email}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between border-b border-border bg-card px-4 py-3 desk:hidden">
          <div className="flex flex-col leading-tight">
            <span className="text-lg font-bold tracking-tight">Reckon</span>
            <span className="mt-0.5 font-mono text-2xs uppercase tracking-wider text-muted-fg">
              {profileTag}
            </span>
          </div>
          <button
            className={`${iconBtn} h-9 w-9 rounded-full`}
            onClick={() => openSheet({ kind: 'profile' })}
            aria-label="Profile settings"
          >
            <UserIcon />
          </button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-4 pb-24 desk:p-6 desk:pb-12">
          <div className="mx-auto w-full max-w-[720px] desk:max-w-[920px]">
            {tab === 'track' && <TrackView openSheet={openSheet} />}
            {tab === 'clients' && <ClientsView openSheet={openSheet} />}
            {tab === 'invoices' && <InvoicesView openSheet={openSheet} />}
            {tab === 'overview' && <OverviewView openSheet={openSheet} goTab={goTab} />}
            {tab === 'tax' && <TaxView openSheet={openSheet} goTab={goTab} />}
          </div>
        </main>

        <nav className="flex shrink-0 gap-1 border-t border-border bg-card px-2.5 pt-2 pb-[calc(--spacing(2)+env(safe-area-inset-bottom))] desk:hidden">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.name || (t.name === 'overview' && tab === 'tax');
            return (
              <button
                key={t.name}
                className={tabItem(active)}
                onClick={() => goTab(t.name)}
              >
                <Icon />
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      {tab !== 'overview' && (
        <button
          className="fixed right-4 bottom-[calc(--spacing(21)+env(safe-area-inset-bottom))] z-15 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border border-border bg-primary text-primary-fg shadow-lg active:scale-95 desk:hidden"
          onClick={handleFab}
          aria-label="Add"
        >
          <PlusIcon className="size-6" />
        </button>
      )}

      {top?.kind === 'entry' && (
        <EntrySheet editing={top.editing} prefill={top.prefill} onClose={closeSheet} />
      )}
      {top?.kind === 'dayDetail' && (
        <DayDetailSheet
          date={top.date}
          onClose={closeSheet}
          openSheet={openSheet}
          replaceSheet={replaceSheet}
        />
      )}
      {top?.kind === 'client' && <ClientSheet editing={top.editing} onClose={closeSheet} />}
      {top?.kind === 'newInvoice' && (
        <NewInvoiceSheet clientId={top.clientId} onClose={closeSheet} />
      )}
      {top?.kind === 'importInvoice' && <ImportInvoiceSheet onClose={closeSheet} />}
      {top?.kind === 'viewInvoice' && (
        <ViewInvoiceSheet
          id={top.id}
          onClose={closeSheet}
          openSheet={openSheet}
          replaceSheet={replaceSheet}
        />
      )}
      {top?.kind === 'editInvoice' && <EditInvoiceSheet id={top.id} onClose={closeSheet} />}
      {top?.kind === 'timesheet' && <TimesheetSheet id={top.id} onClose={closeSheet} />}
      {top?.kind === 'taxPayment' && <TaxPaymentSheet onClose={closeSheet} />}
      {top?.kind === 'profile' && <ProfileSheet onClose={closeSheet} />}
    </div>
  );
}
