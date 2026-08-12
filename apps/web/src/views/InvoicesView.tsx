import {
  AlertIcon,
  DownloadIcon,
  FilePlusIcon,
  InvoiceIcon,
  ListIcon,
  PlusIcon,
} from '../components/icons';
import { EmptyState, SectionHead } from '../components/ui';
import { downloadBlob, toCsv } from '../lib/download';
import { fmtDMY, fmtMoney, todayIso } from '../lib/format';
import { STATUS_BADGE, invoiceSortKey, invoiceStatusComputed } from '../lib/invoice';
import type { OpenSheet } from '../lib/sheets';
import { useStore } from '../store/context';
import { badge, btn, btnSm, btnXs } from '../styles/cx';

export function InvoicesView({ openSheet }: { openSheet: OpenSheet }) {
  const { data, toast } = useStore();

  const clientName = (id: string) =>
    data.clients.find((c) => c.id === id)?.name ?? 'Unknown client';

  const monthStart = todayIso().slice(0, 8) + '01';
  const staleClientIds = [
    ...new Set(
      data.sessions.filter((s) => !s.invoiced && s.date < monthStart).map((s) => s.clientId),
    ),
  ];

  const exportCsv = () => {
    if (data.invoices.length === 0) {
      toast('No invoices to export');
      return;
    }
    const sorted = [...data.invoices].sort((a, b) => invoiceSortKey(a) - invoiceSortKey(b));
    const rows: (string | number)[][] = [
      [
        'Number',
        'Client',
        'Issue date',
        'Due date',
        'Description',
        'Period from',
        'Period to',
        'Total EUR',
        'Status',
        'Paid date',
      ],
    ];
    sorted.forEach((inv) => {
      rows.push([
        inv.number,
        clientName(inv.clientId),
        inv.issueDate,
        inv.dueDate,
        inv.description,
        inv.periodStart,
        inv.periodEnd,
        inv.total.toFixed(2),
        invoiceStatusComputed(inv),
        inv.paidDate ?? '',
      ]);
    });
    downloadBlob(
      toCsv(rows),
      `invoices-export-${todayIso()}.csv`,
      'text/csv;charset=utf-8;',
    );
    toast('Invoices exported');
  };

  const sorted = [...data.invoices].sort((a, b) => invoiceSortKey(b) - invoiceSortKey(a));

  return (
    <>
      <SectionHead title="Invoices" count={data.invoices.length}>
        <button
          className={`${btn.primary} ${btnSm} max-desk:hidden`}
          onClick={() => openSheet({ kind: 'newInvoice' })}
        >
          <PlusIcon className="size-3.5" />
          New invoice
        </button>
      </SectionHead>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          className={`${btn.outline} ${btnSm} flex-1`}
          onClick={() => openSheet({ kind: 'importInvoice' })}
        >
          <FilePlusIcon className="size-3.5" />
          Import a manually-made invoice
        </button>
        <button className={`${btn.outline} ${btnSm} flex-1`} onClick={exportCsv}>
          <DownloadIcon className="size-3.5" />
          Export all (CSV)
        </button>
      </div>

      {staleClientIds.length > 0 && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-border bg-warning-bg p-4 text-sm leading-normal text-warning-fg">
          <AlertIcon className="mt-0.5 size-4 shrink-0" />
          <div className="flex-1">
            <strong className="mb-0.5 block">Unbilled hours from before this month</strong>
            {staleClientIds.map((id) => clientName(id)).join(', ')} — might be time to
            invoice.
          </div>
          <button
            className={`${btn.outline} ${btnSm} shrink-0 bg-card`}
            onClick={() => openSheet({ kind: 'newInvoice', clientId: staleClientIds[0] })}
          >
            Invoice
          </button>
        </div>
      )}

      {data.invoices.length === 0 ? (
        <EmptyState
          icon={<InvoiceIcon className="size-8" />}
          lines={['No invoices yet.', 'Bill your logged hours in one tap.']}
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
                  <div className="font-mono text-xs tracking-wide text-muted-fg">#{inv.number}</div>
                  <div className="mt-0.5 text-base font-semibold">{clientName(inv.clientId)}</div>
                </div>
                <div className="whitespace-nowrap text-right font-mono text-lg font-semibold">
                  {fmtMoney(inv.total)}
                </div>
              </div>
              <div className="mt-1.5 text-xs text-muted-fg">
                Issued {fmtDMY(inv.issueDate)} · Due {fmtDMY(inv.dueDate)}
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className={badge[STATUS_BADGE[status]]}>{status}</span>
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
                  Hours
                </span>
              </div>
            </button>
          );
        })
      )}
    </>
  );
}
