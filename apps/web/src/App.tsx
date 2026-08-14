import { useCallback, useState } from 'react';
import {
  AlertIcon,
  ClientsIcon,
  ClockIcon,
  InvoiceIcon,
  PlusIcon,
  SignOutIcon,
  UserIcon,
} from './components/icons';
import { invoiceReadiness } from '@reckon/shared';
import { useAuth } from './auth/context';
import { ClientSheet } from './sheets/ClientSheet';
import { DayDetailSheet } from './sheets/DayDetailSheet';
import { EditInvoiceSheet } from './sheets/EditInvoiceSheet';
import { EntrySheet } from './sheets/EntrySheet';
import { ImportInvoiceSheet } from './sheets/ImportInvoiceSheet';
import { NewInvoiceSheet } from './sheets/NewInvoiceSheet';
import { TimesheetSheet } from './sheets/TimesheetSheet';
import { ViewInvoiceSheet } from './sheets/ViewInvoiceSheet';
import { iconBtn } from './styles/cx';
import { SheetActiveContext } from './components/sheetActive';
import { Toast } from './components/Toast';
import { useStore } from './store/context';

const navItem = (active: boolean) =>
  'flex cursor-pointer items-center gap-2.5 rounded-lg border-none px-2.5 py-2 text-left text-sm font-medium transition-all duration-150 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:opacity-80 ' +
  (active
    ? 'bg-primary text-primary-fg'
    : 'bg-transparent text-muted-fg hover:bg-muted hover:text-fg');

const tabItem = (active: boolean) =>
  'flex flex-1 cursor-pointer flex-col items-center gap-1 rounded-lg border-none py-2 text-2xs font-semibold uppercase tracking-wide transition-all duration-150 [&>svg]:size-5 ' +
  (active ? 'bg-primary text-primary-fg' : 'bg-transparent text-muted-fg');
import type { SheetState } from './lib/sheets';
import type { TabName } from './lib/types';

/** The profile is a destination like the tabs, just not one of them. */
type Screen = TabName | 'profile';
import { ClientsView } from './views/ClientsView';
import { InvoicesView } from './views/InvoicesView';
import { ProfileView } from './views/ProfileView';
import { TrackView } from './views/TrackView';

const TAB_DEFS: {
  name: TabName;
  label: string;
  icon: (p: { className?: string }) => React.ReactElement;
}[] = [
  { name: 'track', label: 'Ure', icon: ClockIcon },
  { name: 'clients', label: 'Stranke', icon: ClientsIcon },
  { name: 'invoices', label: 'Računi', icon: InvoiceIcon },
];

export default function App() {
  const { data } = useStore();
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<Screen>('track');
  const [stack, setStack] = useState<SheetState[]>([]);

  // Asking for the profile is navigation, not a panel — whatever asks for it
  // (a readiness gate, the sidebar) lands on the screen with the app's chrome
  // still around it.
  const openSheet = useCallback((sheet: SheetState) => {
    if (sheet.kind === 'profile') {
      setStack([]);
      setTab('profile');
      return;
    }
    setStack((s) => [...s, sheet]);
  }, []);
  const closeSheet = useCallback(() => {
    setStack((s) => s.slice(0, -1));
  }, []);
  const closeAllSheets = useCallback(() => setStack([]), []);

  const replaceSheet = useCallback((sheet: SheetState) => {
    if (sheet.kind === 'profile') {
      setStack([]);
      setTab('profile');
      return;
    }
    setStack((s) => [...s.slice(0, -1), sheet]);
  }, []);

  const goTab = useCallback(
    (name: Screen) => {
      setTab(name);
      closeAllSheets();
    },
    [closeAllSheets],
  );

  const handleFab = () => {
    if (tab === 'track') openSheet({ kind: 'entry' });
    else if (tab === 'clients') openSheet({ kind: 'client' });
    else if (tab === 'invoices') openSheet({ kind: 'newInvoice' });
  };

  const profileReady = invoiceReadiness(data.profile).ready;

  // Two letters off the business name; before there is one, off the address
  // it was registered with — the domain says nothing about who you are.
  const initials = (() => {
    const words = data.profile.name.trim().split(/\s+/).filter(Boolean);
    if (words.length > 0) {
      return words
        .slice(0, 2)
        .map((w) => w[0])
        .join('');
    }
    return (user?.email?.split('@')[0] ?? '?').slice(0, 2) || '?';
  })();

  const counts: Record<TabName, number> = {
    track: data.sessions.length,
    clients: data.clients.length,
    invoices: data.invoices.length,
  };
  const TABS = TAB_DEFS.map((t) => ({ ...t, count: counts[t.name] || '' }));

  return (
    <div className="flex h-svh overflow-hidden pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <aside className="hidden h-full w-64 shrink-0 flex-col overflow-y-auto border-r border-border bg-card px-3 py-4 desk:flex">
        <div className="mb-6 flex items-center gap-2.5 px-2.5 pt-1">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-primary font-bold text-primary-fg">
            R
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="text-base font-bold tracking-tight">Reckon</span>
            <span className="font-mono text-2xs uppercase tracking-wider text-muted-fg">
              evidenca dela
            </span>
          </span>
        </div>

        <nav className="flex flex-col gap-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.name;
            return (
              <button
                key={t.name}
                className={navItem(active)}
                aria-current={active ? 'page' : undefined}
                onClick={() => goTab(t.name)}
              >
                <Icon />
                {t.label}
                <span className="ml-auto font-mono text-2xs opacity-70">
                  {t.count}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-1 border-t border-border pt-3">
          {/* The account block: who you are, and the one thing that needs doing. */}
          <button
            className={
              'flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-2.5 py-2 text-left transition-colors ' +
              (tab === 'profile'
                ? 'bg-primary text-primary-fg'
                : 'bg-card hover:bg-muted')
            }
            aria-current={tab === 'profile' ? 'page' : undefined}
            onClick={() => goTab('profile')}
          >
            <span
              className={
                'flex size-8 shrink-0 items-center justify-center rounded-lg border border-border font-mono text-xs font-bold uppercase ' +
                (tab === 'profile' ? 'bg-card text-fg' : 'bg-muted')
              }
            >
              {initials}
            </span>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-sm font-semibold">Profil</span>
              <span
                className={
                  'truncate font-mono text-2xs ' +
                  (tab === 'profile' ? 'opacity-80' : 'text-muted-fg')
                }
                title={user?.email}
              >
                {user?.email}
              </span>
            </span>
            {!profileReady && (
              <AlertIcon
                className="size-4 shrink-0 text-warning-fg"
                aria-hidden="true"
              />
            )}
          </button>

          {!profileReady && (
            <button
              className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-warning-bg px-2.5 py-2 text-left text-2xs leading-normal text-warning-fg hover:opacity-90"
              onClick={() => goTab('profile')}
            >
              <AlertIcon className="mt-px size-3.5 shrink-0" />
              <span>
                <strong className="block">Dopolnite podatke</strong>
                Brez njih računa ni mogoče izstaviti.
              </span>
            </button>
          )}

          <button
            className={`${navItem(false)} hover:bg-error-bg hover:text-error-fg`}
            onClick={() => void signOut()}
          >
            <SignOutIcon />
            Odjava
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between border-b border-border bg-card px-4 pt-[calc(--spacing(3)+env(safe-area-inset-top))] pb-3 desk:hidden">
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="text-lg font-bold tracking-tight">Reckon</span>
            <span className="mt-0.5 truncate font-mono text-2xs uppercase tracking-wider text-muted-fg">
              {data.profile.name || 'evidenca dela'}
            </span>
          </div>
          <button
            className={
              `${iconBtn} relative rounded-full ` +
              (tab === 'profile' ? 'bg-primary text-primary-fg' : '')
            }
            onClick={() => goTab('profile')}
            aria-label={
              profileReady ? 'Profil' : 'Profil — podatki niso popolni'
            }
          >
            <UserIcon />
            {!profileReady && (
              <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full border border-border bg-warning-bg text-warning-fg">
                <AlertIcon className="size-2.5" />
              </span>
            )}
          </button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-36 desk:p-6 desk:pb-12">
          <div className="mx-auto w-full max-w-[720px] desk:max-w-[920px]">
            {tab === 'track' && <TrackView openSheet={openSheet} />}
            {tab === 'clients' && <ClientsView openSheet={openSheet} />}
            {tab === 'invoices' && <InvoicesView openSheet={openSheet} />}
            {tab === 'profile' && <ProfileView />}
          </div>
        </main>

        <nav className="flex shrink-0 gap-1 border-t border-border bg-card px-2.5 pt-2 pb-[calc(--spacing(2)+env(safe-area-inset-bottom))] desk:hidden">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.name;
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

      {
        <button
          className="fixed right-4 bottom-[calc(--spacing(21)+env(safe-area-inset-bottom))] z-15 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border border-border bg-primary text-primary-fg shadow-lg active:scale-95 desk:hidden"
          onClick={handleFab}
          aria-label="Dodaj"
        >
          <PlusIcon className="size-6" />
        </button>
      }

      {stack.map((sheet, i) => {
        const isTop = i === stack.length - 1;
        // Covered sheets stay mounted so their half-filled forms survive.
        return (
          <SheetActiveContext.Provider key={i} value={isTop}>
            <div className={isTop ? undefined : 'hidden'} inert={!isTop}>
              {sheet.kind === 'entry' && (
                <EntrySheet
                  editing={sheet.editing}
                  prefill={sheet.prefill}
                  onClose={closeSheet}
                  openSheet={openSheet}
                />
              )}
              {sheet.kind === 'dayDetail' && (
                <DayDetailSheet
                  date={sheet.date}
                  onClose={closeSheet}
                  openSheet={openSheet}
                  replaceSheet={replaceSheet}
                />
              )}
              {sheet.kind === 'client' && (
                <ClientSheet
                  editing={sheet.editing}
                  onCreated={sheet.onCreated}
                  onClose={closeSheet}
                />
              )}
              {sheet.kind === 'newInvoice' && (
                <NewInvoiceSheet
                  clientId={sheet.clientId}
                  onClose={closeSheet}
                  openSheet={openSheet}
                  replaceSheet={replaceSheet}
                />
              )}
              {sheet.kind === 'importInvoice' && (
                <ImportInvoiceSheet
                  onClose={closeSheet}
                  openSheet={openSheet}
                  replaceSheet={replaceSheet}
                />
              )}
              {sheet.kind === 'viewInvoice' && (
                <ViewInvoiceSheet
                  id={sheet.id}
                  onClose={closeSheet}
                  openSheet={openSheet}
                  replaceSheet={replaceSheet}
                />
              )}
              {sheet.kind === 'editInvoice' && (
                <EditInvoiceSheet
                  id={sheet.id}
                  onClose={closeSheet}
                  openSheet={openSheet}
                />
              )}
              {sheet.kind === 'timesheet' && (
                <TimesheetSheet id={sheet.id} onClose={closeSheet} />
              )}
            </div>
          </SheetActiveContext.Provider>
        );
      })}

      <Toast panelOpen={stack.length > 0} />
    </div>
  );
}
