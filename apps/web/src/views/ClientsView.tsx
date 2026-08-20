import {
  ClientsIcon,
  EditIcon,
  ListIcon,
  PlusIcon,
  RepeatIcon,
  TableIcon,
  TrashIcon,
} from '../components/icons';
import { formatAddress } from '@reckon/shared';
import { DataTable, type Column } from '../components/DataTable';
import { EmptyState, SectionHead } from '../components/ui';
import { failureMessage, } from '../lib/failure';
import { plural } from '../lib/format';
import { btn, btnSm, iconBtn, rowActions, tabSeg } from '../styles/cx';
import { fmtMoney } from '../lib/format';
import type { OpenSheet } from '../lib/sheets';
import { useStore } from '../store/context';
import { useViewMode } from '../lib/viewMode';
import type { Client } from '../lib/types';

export function ClientsView({ openSheet }: { openSheet: OpenSheet }) {
  const { data, removeClient, setClientActive, toast } = useStore();
  const [view, setView] = useViewMode<'list' | 'table'>('reckon.view.clients', 'list');

  /**
   * A client that has been worked for or invoiced is deactivated rather than
   * deleted — the hours behind an issued invoice have to keep pointing at
   * someone. Only a client nothing refers to is actually removed.
   */
  const remove = async (id: string) => {
    if (
      !confirm(
        'Odstranim to stranko? Če ima zabeležene ure ali račune, bo le označena kot neaktivna.',
      )
    ) {
      return;
    }
    try {
      const deactivated = await removeClient(id);
      toast(deactivated ? 'Stranka označena kot neaktivna' : 'Stranka izbrisana');
    } catch (err) {
      toast(failureMessage(err));
    }
  };

  const reactivate = async (id: string) => {
    try {
      await setClientActive(id, true);
      toast('Stranka je spet aktivna');
    } catch (err) {
      toast(failureMessage(err));
    }
  };

  /*
   * The card says everything about one client; the table lets a rate be
   * compared with the rate next to it, which is the question a rate raises.
   * Address and contact details step aside on a phone — a name and what they
   * pay is what a narrow screen has room for.
   */
  const columns: Column<Client>[] = [
    {
      key: 'name',
      header: 'Naziv',
      sortBy: (c) => c.name,
      cell: (c) => (
        <span className="flex items-center gap-2">
          <span className="max-w-48 truncate font-medium">{c.name}</span>
          {!c.isActive && (
            <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-2xs uppercase tracking-wider text-muted-fg">
              neaktivna
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'address',
      header: 'Naslov',
      deskOnly: true,
      sortBy: (c) => c.city,
      cell: (c) => (
        <span className="block max-w-56 truncate text-xs text-muted-fg">
          {formatAddress(c) || '—'}
        </span>
      ),
    },
    {
      key: 'taxNumber',
      header: 'Davčna',
      deskOnly: true,
      sortBy: (c) => c.taxNumber,
      cell: (c) => (
        <span className="font-mono text-xs text-muted-fg">{c.taxNumber || '—'}</span>
      ),
    },
    {
      key: 'contact',
      header: 'Kontakt',
      deskOnly: true,
      sortBy: (c) => c.email,
      cell: (c) => (
        <span className="block max-w-48 truncate text-xs text-muted-fg">
          {c.email || c.phone || '—'}
        </span>
      ),
    },
    {
      key: 'rate',
      header: 'Postavka',
      align: 'right',
      sortBy: (c) => c.rate,
      cell: (c) => (
        <span className="font-mono font-semibold tabular-nums text-primary">
          {fmtMoney(c.rate)}/h
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (c) => (
        <span className="flex justify-end gap-1.5">
          <span
            className={`${iconBtn} size-7`}
            role="button"
            tabIndex={0}
            aria-label={`Uredi stranko ${c.name}`}
            onClick={(e) => {
              e.stopPropagation();
              openSheet({ kind: 'client', editing: c });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                openSheet({ kind: 'client', editing: c });
              }
            }}
          >
            <EditIcon className="size-3.5" />
          </span>
          <span
            className={`${iconBtn} size-7`}
            role="button"
            tabIndex={0}
            aria-label={
              c.isActive ? `Odstrani stranko ${c.name}` : `Ponovno aktiviraj ${c.name}`
            }
            onClick={(e) => {
              e.stopPropagation();
              void (c.isActive ? remove(c.id) : reactivate(c.id));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                void (c.isActive ? remove(c.id) : reactivate(c.id));
              }
            }}
          >
            {c.isActive ? (
              <TrashIcon className="size-3.5" />
            ) : (
              <RepeatIcon className="size-3.5" />
            )}
          </span>
        </span>
      ),
    },
  ];

  return (
    <>
      <SectionHead
        title="Stranke"
        meta={
          data.clients.length > 0
            ? plural(data.clients.length, [
                'stranka',
                'stranki',
                'stranke',
                'strank',
              ])
            : undefined
        }
      >
        <button
          className={`${btn.primary} ${btnSm} max-desk:hidden`}
          onClick={() => openSheet({ kind: 'client' })}
        >
          <PlusIcon className="size-3.5" />
          Nova stranka
        </button>
      </SectionHead>

      {data.clients.length > 0 && (
        <div className="mb-3 flex gap-0.5 rounded-lg bg-muted p-1">
          <button className={tabSeg(view === 'list')} onClick={() => setView('list')}>
            <ListIcon className="size-3.5" />
            Seznam
          </button>
          <button className={tabSeg(view === 'table')} onClick={() => setView('table')}>
            <TableIcon className="size-3.5" />
            Tabela
          </button>
        </div>
      )}

      {data.clients.length === 0 ? (
        <EmptyState
          icon={<ClientsIcon className="size-8" />}
          lines={[
            'Ni vnesenih strank.',
            'Dodajte podjetje, za katerega opravljate storitve.',
          ]}
        />
      ) : view === 'table' ? (
        <DataTable
          columns={columns}
          rows={data.clients}
          rowKey={(c) => c.id}
          onRowClick={(c) => openSheet({ kind: 'client', editing: c })}
          rowLabel={(c) => `Uredi stranko ${c.name}`}
          dimmed={(c) => !c.isActive}
        />
      ) : (
        data.clients.map((c) => (
          <div
            className={
              'mb-3 flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs ' +
              (c.isActive ? '' : 'opacity-60')
            }
            key={c.id}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold">{c.name}</span>
                {!c.isActive && (
                  <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-2xs uppercase tracking-wider text-muted-fg">
                    neaktivna
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-sm text-muted-fg">
                {formatAddress(c) || 'Naslov ni vnesen'}
              </div>
              <div className="mt-1 font-mono text-xs text-muted-fg">
                {c.taxNumber || 'brez davčne št.'}
                {c.email ? ' · ' + c.email : ''}
                {c.phone ? ' · ' + c.phone : ''}
              </div>
              <div className="mt-2 font-mono text-sm font-semibold text-primary">
                {fmtMoney(c.rate)}/h
              </div>
            </div>
            <div className={rowActions}>
              <button
                className={iconBtn}
                onClick={() => openSheet({ kind: 'client', editing: c })}
                aria-label="Uredi stranko"
              >
                <EditIcon className="size-4" />
              </button>
              {c.isActive ? (
                <button
                  className={iconBtn}
                  onClick={() => void remove(c.id)}
                  aria-label="Odstrani stranko"
                >
                  <TrashIcon className="size-4" />
                </button>
              ) : (
                <button
                  className={iconBtn}
                  onClick={() => void reactivate(c.id)}
                  aria-label="Ponovno aktiviraj stranko"
                >
                  <RepeatIcon className="size-4" />
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </>
  );
}
