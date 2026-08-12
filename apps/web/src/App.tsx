import { useCallback, useState } from 'react';
import {
  ChartIcon,
  ClientsIcon,
  ClockIcon,
  InvoiceIcon,
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
import { useStore } from './store/context';
import type { SheetState } from './lib/sheets';
import type { TabName } from './lib/types';
import { ClientsView } from './views/ClientsView';
import { InvoicesView } from './views/InvoicesView';
import { OverviewView } from './views/OverviewView';
import { TaxView } from './views/TaxView';
import { TrackView } from './views/TrackView';

const TABS: { name: TabName; label: string; icon: () => React.ReactElement }[] = [
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
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="mark">Reckon</span>
          <span className="sub">freelance ledger</span>
        </div>
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.name}
              className={'nav-item' + (tab === t.name ? ' active' : '')}
              onClick={() => goTab(t.name)}
            >
              <Icon />
              {t.label}
            </button>
          );
        })}
        <button
          className={'nav-item' + (tab === 'tax' ? ' active' : '')}
          onClick={() => goTab('tax')}
        >
          <TaxIcon />
          Tax
        </button>

        <div className="sidebar-foot">
          <button className="nav-item" onClick={() => openSheet({ kind: 'profile' })}>
            <UserIcon />
            <span className="nav-item-text">{profileTag}</span>
          </button>
          <button className="nav-item signout" onClick={() => void signOut()}>
            <SignOutIcon />
            Sign out
          </button>
          <div className="sidebar-account" title={user?.email}>
            {user?.email}
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="appbar">
          <div className="brand">
            <span className="mark">Reckon</span>
            <span className="sub">{profileTag}</span>
          </div>
          <button
            className="icon-btn icon-btn-round"
            onClick={() => openSheet({ kind: 'profile' })}
            aria-label="Profile settings"
          >
            <UserIcon />
          </button>
        </header>

        <main className="content">
          {tab === 'track' && <TrackView openSheet={openSheet} />}
          {tab === 'clients' && <ClientsView openSheet={openSheet} />}
          {tab === 'invoices' && <InvoicesView openSheet={openSheet} />}
          {tab === 'overview' && <OverviewView openSheet={openSheet} goTab={goTab} />}
          {tab === 'tax' && <TaxView openSheet={openSheet} goTab={goTab} />}
        </main>
      </div>

      {tab !== 'overview' && (
        <button className="fab" onClick={handleFab} aria-label="Add">
          +
        </button>
      )}

      <nav className="tabbar">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.name || (t.name === 'overview' && tab === 'tax');
          return (
            <button
              key={t.name}
              className={'tab' + (active ? ' active' : '')}
              onClick={() => goTab(t.name)}
            >
              <Icon />
              {t.label}
            </button>
          );
        })}
      </nav>

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
