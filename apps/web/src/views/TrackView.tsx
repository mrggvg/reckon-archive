import { useMemo, useState } from 'react';
import {
  CalendarIcon,
  ClockIcon,
  EditIcon,
  InvoiceIcon,
  ListIcon,
  LockIcon,
  TableIcon,
  PlusIcon,
  RepeatIcon,
  TrashIcon,
} from '../components/icons';
import { DataTable, type Column } from '../components/DataTable';
import { EmptyState, SectionHead } from '../components/ui';
import {
  clientColor,
  fmtDMY,
  fmtDateLabel,
  fmtHours,
  fmtMoney,
  hoursBetween,
  plural,
  todayIso,
} from '../lib/format';
import {
  alreadyLogged,
  shiftSuggestions,
  unbilledByClient,
  type ShiftSuggestion,
} from '../lib/suggestions';
import { failureMessage } from '../lib/failure';
import type { OpenSheet } from '../lib/sheets';
import { BILLING_LABEL, sessionBillingLabel } from '../lib/invoice';
import { btn, btnSm, cardLabel, chip, iconBtn, rowActions, tabSeg } from '../styles/cx';
import type { Session } from '../lib/types';
import { useStore } from '../store/context';
import { useViewMode } from '../lib/viewMode';
import { CalendarView } from './CalendarView';

export function TrackView({ openSheet }: { openSheet: OpenSheet }) {
  const { data, createSession, removeSession, toast } = useStore();
  const [view, setView] = useViewMode<'list' | 'calendar' | 'table'>(
    'reckon.view.hours',
    'list',
  );
  const [filter, setFilter] = useState<string>('all');

  const clientName = (id: string) =>
    data.clients.find((c) => c.id === id)?.name ?? 'Brez stranke';

  // The filtered-on client may have been deleted since — fall back to All.
  const activeFilter =
    filter !== 'all' && !data.clients.some((c) => c.id === filter)
      ? 'all'
      : filter;

  const visible = useMemo(
    () =>
      activeFilter === 'all'
        ? data.sessions
        : data.sessions.filter((s) => s.clientId === activeFilter),
    [data.sessions, activeFilter],
  );

  const totalHours = visible.reduce(
    (sum, s) => sum + hoursBetween(s.start, s.end),
    0,
  );
  const unbilledHours = visible
    .filter((s) => !s.invoiced)
    .reduce((sum, s) => sum + hoursBetween(s.start, s.end), 0);

  const byDate = useMemo(() => {
    const map = new Map<string, Session[]>();
    visible.forEach((s) => {
      const list = map.get(s.date) ?? [];
      list.push(s);
      map.set(s.date, list);
    });
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, items]) => ({
        date,
        items: [...items].sort((a, b) => a.start.localeCompare(b.start)),
      }));
  }, [visible]);

  const deleteEntry = async (id: string) => {
    const s = data.sessions.find((x) => x.id === id);
    if (s?.invoiced) {
      toast('Vnosa ni mogoče izbrisati — je že na računu');
      return;
    }
    try {
      await removeSession(id);
    } catch (err) {
      toast(failureMessage(err));
    }
  };

  const suggestions = useMemo(
    () => shiftSuggestions(data.sessions, data.clients),
    [data.sessions, data.clients],
  );

  const pending = useMemo(
    () => unbilledByClient(data.sessions, data.clients),
    [data.sessions, data.clients],
  );

  /**
   * The whole point of the chips: a shift you work often takes one tap, not a
   * form. The same day's identical entry is refused rather than duplicated,
   * because a double tap should not quietly bill the client twice.
   */
  const quickLog = (shift: ShiftSuggestion) => {
    const today = todayIso();
    const entry = {
      clientId: shift.clientId,
      date: today,
      start: shift.start,
      end: shift.end,
    };
    if (alreadyLogged(data.sessions, entry)) {
      toast('Ta vnos za danes že obstaja');
      return;
    }
    void (async () => {
      try {
        await createSession({ ...entry, note: '' });
        toast(`${shift.clientName}: ${shift.start}–${shift.end} zabeleženo`);
      } catch (err) {
        toast(failureMessage(err));
      }
    })();
  };

  /*
   * The same entries as the list, read across: the table is where a month of
   * days becomes a column of hours that can be added up by eye, and where
   * sorting by client or by status answers a question the grouped list cannot.
   * The note only appears where there is room for it.
   */
  const entryColumns: Column<Session>[] = [
    {
      key: 'date',
      header: 'Datum',
      sortBy: (s) => s.date,
      cell: (s) => <span className="font-mono text-xs">{fmtDMY(s.date)}</span>,
    },
    {
      key: 'client',
      header: 'Stranka',
      sortBy: (s) => clientName(s.clientId),
      cell: (s) => (
        <span className="block max-w-40 truncate font-medium">
          {clientName(s.clientId)}
        </span>
      ),
    },
    {
      key: 'time',
      header: 'Čas',
      sortBy: (s) => s.start,
      cell: (s) => (
        <span className="font-mono text-xs whitespace-nowrap">
          {s.start}–{s.end}
        </span>
      ),
    },
    {
      key: 'hours',
      header: 'Ure',
      align: 'right',
      sortBy: (s) => hoursBetween(s.start, s.end),
      cell: (s) => (
        <span className="font-mono font-semibold tabular-nums">
          {fmtHours(hoursBetween(s.start, s.end))}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortBy: (s) => sessionBillingLabel(s, data.invoices) ?? 'unbilled',
      cell: (s) => {
        const billing = sessionBillingLabel(s, data.invoices);
        // The same three colours the calendar legend uses, so the stages read
        // the same wherever they are met.
        const dot =
          billing === 'paid'
            ? 'bg-secondary'
            : billing === 'invoiced'
              ? 'bg-primary'
              : 'bg-accent';
        return (
          // The labels are written for mid-sentence use in the list; here they
          // start a column, so the first letter is lifted in CSS rather than
          // keeping a second set of strings.
          <span className="flex items-center gap-1.5 whitespace-nowrap text-xs capitalize text-muted-fg">
            <span className={`size-1.5 shrink-0 rounded-full ${dot}`} />
            {billing ? BILLING_LABEL[billing] : 'neobračunano'}
          </span>
        );
      },
    },
    {
      key: 'note',
      header: 'Opomba',
      deskOnly: true,
      sortBy: (s) => s.note,
      cell: (s) => (
        <span className="block max-w-56 truncate text-xs text-muted-fg">
          {s.note || '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (s) => {
        // Hours on an invoice are frozen, here as everywhere else.
        if (s.invoiced) {
          return (
            <span className="flex justify-end text-muted-fg" title="Na računu">
              <LockIcon className="size-3.5" />
            </span>
          );
        }
        return (
          <span className="flex justify-end gap-1.5">
            <span
              className={`${iconBtn} size-7`}
              role="button"
              tabIndex={0}
              aria-label="Uredi vnos"
              onClick={(e) => {
                e.stopPropagation();
                openSheet({ kind: 'entry', editing: s });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  openSheet({ kind: 'entry', editing: s });
                }
              }}
            >
              <EditIcon className="size-3.5" />
            </span>
            <span
              className={`${iconBtn} size-7`}
              role="button"
              tabIndex={0}
              aria-label="Izbriši vnos"
              onClick={(e) => {
                e.stopPropagation();
                void deleteEntry(s.id);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  void deleteEntry(s.id);
                }
              }}
            >
              <TrashIcon className="size-3.5" />
            </span>
          </span>
        );
      },
    },
  ];

  return (
    <>
      <SectionHead
        title="Ure"
        meta={
          visible.length > 0
            ? plural(visible.length, ['vnos', 'vnosa', 'vnosi', 'vnosov'])
            : undefined
        }
      >
        <button
          className={`${btn.primary} ${btnSm} max-desk:hidden`}
          onClick={() => openSheet({ kind: 'entry' })}
        >
          <PlusIcon className="size-3.5" />
          Vnesi ure
        </button>
      </SectionHead>

      {suggestions.length > 0 && (
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {suggestions.map((s) => (
            <button
              key={s.clientId}
              className={`${btn.outline} ${btnSm} shrink-0`}
              onClick={() => quickLog(s)}
              title={`Zabeleži ${s.start}–${s.end} za danes`}
            >
              <RepeatIcon className="size-3.5" />
              <span className="max-w-32 truncate">{s.clientName}</span>
              <span className="font-mono text-muted-fg">
                {s.start}–{s.end}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="mb-3 flex gap-0.5 rounded-lg bg-muted p-1">
        <button
          className={tabSeg(view === 'list')}
          onClick={() => setView('list')}
        >
          <ListIcon className="size-3.5" />
          Seznam
        </button>
        <button
          className={tabSeg(view === 'table')}
          onClick={() => setView('table')}
        >
          <TableIcon className="size-3.5" />
          Tabela
        </button>
        <button
          className={tabSeg(view === 'calendar')}
          onClick={() => setView('calendar')}
        >
          <CalendarIcon className="size-3.5" />
          Koledar
        </button>
      </div>

      {view === 'list' ? (
        <>
          <div className="mb-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            <button
              className={chip(activeFilter === 'all')}
              onClick={() => setFilter('all')}
            >
              Vse
            </button>
            {data.clients.map((c) => (
              <button
                key={c.id}
                className={chip(activeFilter === c.id)}
                onClick={() => setFilter(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>

          {data.sessions.length === 0 ? (
            <EmptyState
              icon={<ClockIcon className="size-8" />}
              lines={['Ni zabeleženih ur.', 'Dodajte prvi vnos z gumbom +.']}
            />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<ClockIcon className="size-8" />}
              lines={['Za to stranko še ni zabeleženih ur.']}
            />
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-fg">
                <div className="flex gap-5">
                  <div>
                    <span className="font-mono text-sm font-bold text-fg">
                      {fmtHours(totalHours)}
                    </span>{' '}
                    skupaj
                  </div>
                  <div>
                    <span className="font-mono text-sm font-bold text-fg">
                      {fmtHours(unbilledHours)}
                    </span>{' '}
                    neobračunano
                  </div>
                </div>
              </div>

              {/*
                Who is owed an invoice, answered here rather than by filtering
                to each client in turn — and billable from the same line, with
                the client and their hours already chosen.
              */}
              {pending.length > 0 && (
                <div className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-xs">
                  <div className={cardLabel}>Za obračun</div>
                  {pending.map((p) => (
                    <div
                      className="flex items-center justify-between gap-3 border-t border-border pt-2.5 first:border-t-0 first:pt-0 [&+&]:mt-2.5"
                      key={p.clientId}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{p.name}</div>
                        <div className="mt-0.5 font-mono text-2xs text-muted-fg">
                          {fmtHours(p.hours)} · od {fmtDMY(p.since)}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="font-mono text-sm font-semibold">
                          {fmtMoney(p.amount)}
                        </span>
                        <button
                          className={`${btn.primary} ${btnSm}`}
                          onClick={() =>
                            openSheet({ kind: 'newInvoice', clientId: p.clientId })
                          }
                        >
                          <InvoiceIcon className="size-3.5" />
                          Izstavi
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {byDate.map(({ date, items }) => {
                const dayTotal = items.reduce(
                  (sum, s) => sum + hoursBetween(s.start, s.end),
                  0,
                );
                return (
                  <div className="mb-4" key={date}>
                    <div className="mb-1.5 ml-0.5 flex justify-between font-mono text-2xs uppercase tracking-wider text-muted-fg">
                      <span>{fmtDateLabel(date)}</span>
                      <span>{fmtHours(dayTotal)}</span>
                    </div>
                    {items.map((s) => (
                      <PunchRow
                        key={s.id}
                        session={s}
                        clientName={clientName(s.clientId)}
                        onEdit={() => openSheet({ kind: 'entry', editing: s })}
                        onDelete={() => deleteEntry(s.id)}
                      />
                    ))}
                  </div>
                );
              })}
            </>
          )}
        </>
      ) : view === 'table' ? (
        <>
          <div className="mb-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            <button
              className={chip(activeFilter === 'all')}
              onClick={() => setFilter('all')}
            >
              Vse
            </button>
            {data.clients.map((c) => (
              <button
                key={c.id}
                className={chip(activeFilter === c.id)}
                onClick={() => setFilter(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={<ClockIcon className="size-8" />}
              lines={['Ni zabeleženih ur.', 'Dodajte prvi vnos z gumbom +.']}
            />
          ) : (
            <DataTable
              columns={entryColumns}
              rows={visible}
              rowKey={(s) => s.id}
              onRowClick={(s) => openSheet({ kind: 'entry', editing: s })}
              rowLabel={(s) => `${fmtDMY(s.date)} ${s.start}–${s.end}`}
              dimmed={(s) => s.invoiced}
            />
          )}
        </>
      ) : (
        <CalendarView openSheet={openSheet} />
      )}
    </>
  );
}

export function PunchRow({
  session,
  clientName,
  onEdit,
  onDelete,
}: {
  session: Session;
  clientName: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { data } = useStore();
  const dur = hoursBetween(session.start, session.end);
  const billing = sessionBillingLabel(session, data.invoices);
  /*
   * Hours that have reached an invoice are part of a document that has left the
   * building, and the server refuses to change them. Offering a pencil that can
   * only fail is worse than not offering one: the lock says why up front, and
   * names the invoice to look at instead.
   */
  const onInvoice = data.invoices.find((i) => i.id === session.invoiceId);
  const lockLabel = onInvoice
    ? `Na računu ${onInvoice.number}${
        onInvoice.status === 'paid' ? ' — plačano' : ''
      }; ur ni več mogoče spreminjati`
    : 'Vnos je na računu; ur ni več mogoče spreminjati';
  return (
    <div
      className={
        'mb-2 flex items-center gap-2.5 rounded-lg border border-l-4 border-border bg-card px-3 py-2.5 shadow-xs' +
        (session.invoiced ? ' opacity-60' : '')
      }
      style={{ borderLeftColor: clientColor(session.clientId) }}
    >
      <div className="min-w-0 flex-1">
        <span className="mb-0.5 inline-block rounded-md bg-muted px-2 py-0.5 text-2xs font-semibold text-fg">
          {clientName}
        </span>
        {session.note ? (
          <div className="truncate text-xs text-muted-fg">{session.note}</div>
        ) : null}
        <div className="mt-px font-mono text-2xs text-muted-fg">
          {fmtHours(dur)}
          {billing ? (
            <>
              {' · '}
              <span
                className={
                  billing === 'paid' ? 'font-semibold text-secondary' : ''
                }
              >
                {BILLING_LABEL[billing]}
              </span>
            </>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-1.5 whitespace-nowrap font-mono text-sm font-medium">
        {session.start}
        <span className="text-xs text-muted-fg">→</span>
        {session.end}
      </div>
      <div className={rowActions}>
        {session.invoiced ? (
          <span
            className="flex size-7 items-center justify-center text-muted-fg"
            title={lockLabel}
            aria-label={lockLabel}
            role="img"
          >
            <LockIcon className="size-3.5" />
          </span>
        ) : (
          <>
            <button
              className={`${iconBtn} size-7`}
              onClick={onEdit}
              aria-label="Uredi vnos"
            >
              <EditIcon className="size-3.5" />
            </button>
            <button
              className={`${iconBtn} size-7`}
              onClick={onDelete}
              aria-label="Izbriši vnos"
            >
              <TrashIcon className="size-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
