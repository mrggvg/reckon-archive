import {
  AlertIcon,
  CheckCircleIcon,
  InvoiceIcon,
  ListIcon,
  PlusIcon,
  RepeatIcon,
  TableIcon,
} from '../components/icons';
import { invoiceReadiness } from '@reckon/shared';
import { DataTable, type Column } from '../components/DataTable';
import { EmptyState, SectionHead } from '../components/ui';
import { failureMessage } from '../lib/failure';
import { fmtDMY, fmtMoney, plural, todayIso } from '../lib/format';
import {
  STATUS_BADGE,
  STATUS_LABEL,
  invoiceSortKey,
  invoiceStatusComputed,
  unpaidWarning,
} from '../lib/invoice';
import type { OpenSheet } from '../lib/sheets';
import type { Invoice } from '../lib/types';
import { useStore } from '../store/context';
import { useViewMode } from '../lib/viewMode';
import { badge, btn, btnSm, btnXs, tabSeg } from '../styles/cx';

export function InvoicesView({ openSheet }: { openSheet: OpenSheet }) {
  const { data, setInvoicePaid, toast } = useStore();
  const [view, setView] = useViewMode<'list' | 'table'>('reckon.view.invoices', 'list');

  const clientName = (id: string) =>
    data.clients.find((c) => c.id === id)?.name ?? 'Neznana stranka';

  const monthStart = todayIso().slice(0, 8) + '01';
  const staleClientIds = [
    ...new Set(
      data.sessions
        .filter((s) => !s.invoiced && s.date < monthStart)
        .map((s) => s.clientId),
    ),
  ];

  /**
   * Payment is the most-changed thing about an invoice and it used to sit
   * three levels deep — open the document, press one button, close it again.
   * Here it is a control on the row, with the reverse always one tap away.
   */
  const togglePaid = (id: string, paid: boolean) => {
    const inv = data.invoices.find((i) => i.id === id);
    // The row makes both directions one tap. Only one of them can be wrong in a
    // way that is hard to notice, so only that one asks.
    if (!paid && inv && !confirm(unpaidWarning(inv, clientName(inv.clientId)))) return;
    void setInvoicePaid(id, paid, paid ? todayIso() : null)
      .then(() =>
        toast(paid ? 'Označeno kot plačano' : 'Označeno kot neplačano'),
      )
      .catch((err: unknown) => toast(failureMessage(err)));
  };

  const sorted = [...data.invoices].sort(
    (a, b) => invoiceSortKey(b) - invoiceSortKey(a),
  );
  const readiness = invoiceReadiness(data.profile);

  // Outstanding money is the one thing worth reading at a glance up here; the
  // bare total on its own was noise.
  const open = data.invoices.filter(
    (inv) => invoiceStatusComputed(inv) !== 'paid',
  );
  const headerMeta =
    data.invoices.length === 0
      ? undefined
      : [
          plural(data.invoices.length, [
            'račun',
            'računa',
            'računi',
            'računov',
          ]),
          open.length > 0
            ? `${plural(open.length, ['odprt', 'odprta', 'odprti', 'odprtih'])} · ${fmtMoney(
                open.reduce((sum, inv) => sum + inv.total, 0),
              )}`
            : 'vse plačano',
        ].join(' · ');

  /*
   * The table is the same ledger read across instead of down: one line per
   * invoice, the money in a column that can be scanned, and the two things
   * anyone does from a row — mark it paid, open its worksheet — still on it.
   */
  const columns: Column<Invoice>[] = [
    {
      key: 'number',
      header: 'Št.',
      sortBy: (inv) => invoiceSortKey(inv),
      cell: (inv) => <span className="font-mono text-xs">{inv.number}</span>,
    },
    {
      key: 'client',
      header: 'Stranka',
      sortBy: (inv) => clientName(inv.clientId),
      cell: (inv) => (
        <span className="block max-w-48 truncate font-medium">
          {clientName(inv.clientId)}
        </span>
      ),
    },
    {
      key: 'issued',
      header: 'Izdan',
      sortBy: (inv) => inv.issueDate,
      cell: (inv) => <span className="font-mono text-xs">{fmtDMY(inv.issueDate)}</span>,
    },
    {
      key: 'due',
      header: 'Rok',
      deskOnly: true,
      sortBy: (inv) => inv.dueDate,
      cell: (inv) => <span className="font-mono text-xs">{fmtDMY(inv.dueDate)}</span>,
    },
    {
      key: 'period',
      header: 'Obdobje',
      deskOnly: true,
      sortBy: (inv) => inv.periodStart,
      cell: (inv) => (
        <span className="font-mono text-2xs text-muted-fg">
          {fmtDMY(inv.periodStart)} – {fmtDMY(inv.periodEnd)}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Znesek',
      align: 'right',
      sortBy: (inv) => inv.total,
      cell: (inv) => (
        <span className="font-mono font-semibold tabular-nums">{fmtMoney(inv.total)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortBy: (inv) => STATUS_LABEL[invoiceStatusComputed(inv)],
      cell: (inv) => {
        const status = invoiceStatusComputed(inv);
        return <span className={badge[STATUS_BADGE[status]]}>{STATUS_LABEL[status]}</span>;
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (inv) => {
        const status = invoiceStatusComputed(inv);
        return (
          <span className="flex justify-end gap-1.5">
            <span
              className={`${status === 'paid' ? btn.ghost : btn.outline} ${btnXs}`}
              role="button"
              tabIndex={0}
              aria-label={
                status === 'paid'
                  ? `Prekliči plačilo računa ${inv.number}`
                  : `Označi račun ${inv.number} kot plačan`
              }
              onClick={(e) => {
                e.stopPropagation();
                togglePaid(inv.id, status !== 'paid');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  togglePaid(inv.id, status !== 'paid');
                }
              }}
            >
              {status === 'paid' ? (
                <>
                  <RepeatIcon className="size-3" />
                  Prekliči
                </>
              ) : (
                <>
                  <CheckCircleIcon className="size-3" />
                  Plačano
                </>
              )}
            </span>
            <span
              className={`${btn.outline} ${btnXs}`}
              role="button"
              tabIndex={0}
              aria-label={`Delovni list računa ${inv.number}`}
              onClick={(e) => {
                e.stopPropagation();
                openSheet({ kind: 'timesheet', id: inv.id });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  openSheet({ kind: 'timesheet', id: inv.id });
                }
              }}
            >
              <ListIcon className="size-3" />
              Ure
            </span>
          </span>
        );
      },
    },
  ];

  return (
    <>
      <SectionHead title="Računi" meta={headerMeta}>
        <button
          className={`${btn.primary} ${btnSm} max-desk:hidden`}
          onClick={() =>
            openSheet(
              readiness.ready ? { kind: 'newInvoice' } : { kind: 'profile' },
            )
          }
        >
          <PlusIcon className="size-3.5" />
          Nov račun
        </button>
      </SectionHead>

      {!readiness.ready && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-border bg-warning-bg p-4 text-sm leading-normal text-warning-fg">
          <AlertIcon className="mt-0.5 size-4 shrink-0" />
          <div className="flex-1">
            <strong className="mb-0.5 block">
              Računov še ni mogoče izstaviti
            </strong>
            Manjka: {readiness.missing.map((m) => m.label).join(', ')}.
          </div>
          <button
            className={`${btn.outline} ${btnSm} shrink-0 bg-card`}
            onClick={() => openSheet({ kind: 'profile' })}
          >
            Dopolni
          </button>
        </div>
      )}

      {staleClientIds.length > 0 && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-border bg-warning-bg p-4 text-sm leading-normal text-warning-fg">
          <AlertIcon className="mt-0.5 size-4 shrink-0" />
          <div className="flex-1">
            <strong className="mb-0.5 block">
              Neobračunane ure iz prejšnjih mesecev
            </strong>
            {staleClientIds.map((id) => clientName(id)).join(', ')} — morda je
            čas za račun.
          </div>
          <button
            className={`${btn.outline} ${btnSm} shrink-0 bg-card`}
            onClick={() =>
              openSheet({ kind: 'newInvoice', clientId: staleClientIds[0] })
            }
          >
            Izstavi račun
          </button>
        </div>
      )}

      {data.invoices.length > 0 && (
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

      {data.invoices.length === 0 ? (
        <EmptyState
          icon={<InvoiceIcon className="size-8" />}
          lines={[
            'Ni izstavljenih računov.',
            'Zabeležene ure zaračunate z enim klikom.',
          ]}
        />
      ) : view === 'table' ? (
        <DataTable
          columns={columns}
          rows={sorted}
          rowKey={(inv) => inv.id}
          onRowClick={(inv) => openSheet({ kind: 'viewInvoice', id: inv.id })}
          rowLabel={(inv) => `Odpri račun ${inv.number}`}
          dimmed={(inv) => invoiceStatusComputed(inv) === 'paid'}
        />
      ) : (
        sorted.map((inv) => {
          const status = invoiceStatusComputed(inv);
          return (
            <button
              key={inv.id}
              className={
                'relative mb-3 block w-full cursor-pointer overflow-hidden rounded-2xl border border-border bg-card p-4 text-left shadow-xs before:absolute before:inset-y-0 before:left-0 before:w-1.5 before:content-[""] ' +
                (status === 'paid'
                  ? 'before:bg-secondary'
                  : status === 'overdue'
                    ? 'before:bg-destructive'
                    : 'before:bg-accent')
              }
              onClick={() => openSheet({ kind: 'viewInvoice', id: inv.id })}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-xs tracking-wide text-muted-fg">
                    #{inv.number}
                  </div>
                  <div className="mt-0.5 text-base font-semibold">
                    {clientName(inv.clientId)}
                  </div>
                </div>
                <div className="whitespace-nowrap text-right font-mono text-lg font-semibold">
                  {fmtMoney(inv.total)}
                </div>
              </div>
              <div className="mt-1.5 text-xs text-muted-fg">
                Izdan {fmtDMY(inv.issueDate)} · Rok {fmtDMY(inv.dueDate)}
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                {/* The state, which stays a label — "zapadlo" is not an action. */}
                <span className={badge[STATUS_BADGE[status]]}>
                  {STATUS_LABEL[status]}
                </span>

                {/*
                  A nested <button> would be invalid inside the row's own
                  button, so these controls carry the role and the keys
                  themselves — the same shape the timesheet shortcut uses.
                */}
                <span className="ml-auto flex items-center gap-1.5">
                  <span
                    className={`${status === 'paid' ? btn.ghost : btn.outline} ${btnXs}`}
                    role="button"
                    tabIndex={0}
                    aria-label={
                      status === 'paid'
                        ? `Prekliči plačilo računa ${inv.number}`
                        : `Označi račun ${inv.number} kot plačan`
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePaid(inv.id, status !== 'paid');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                        togglePaid(inv.id, status !== 'paid');
                      }
                    }}
                  >
                    {status === 'paid' ? (
                      <>
                        <RepeatIcon className="size-3" />
                        Prekliči
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="size-3" />
                        Plačano
                      </>
                    )}
                  </span>
                  <span
                    className={`${btn.outline} ${btnXs}`}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      openSheet({ kind: 'timesheet', id: inv.id });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                        openSheet({ kind: 'timesheet', id: inv.id });
                      }
                    }}
                  >
                    <ListIcon className="size-3" />
                    Ure
                  </span>
                </span>
              </div>
            </button>
          );
        })
      )}
    </>
  );
}
