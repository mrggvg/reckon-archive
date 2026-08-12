import { EmptyState, SectionHead } from '../components/ui';
import { downloadBlob, toCsv } from '../lib/download';
import { fmtDMY, fmtMoney, todayIso } from '../lib/format';
import { STATUS_BADGE, invoiceSortKey, invoiceStatusComputed } from '../lib/invoice';
import type { OpenSheet } from '../lib/sheets';
import { useStore } from '../store/context';

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
          className="btn btn-primary btn-sm desktop-only"
          onClick={() => openSheet({ kind: 'newInvoice' })}
        >
          + New invoice
        </button>
      </SectionHead>

      <div className="btn-row" style={{ marginBottom: 16 }}>
        <button
          className="btn btn-outline btn-sm"
          onClick={() => openSheet({ kind: 'importInvoice' })}
        >
          Import a manually-made invoice
        </button>
        <button className="btn btn-outline btn-sm" onClick={exportCsv}>
          Export all (CSV)
        </button>
      </div>

      {staleClientIds.length > 0 && (
        <div className="banner warn">
          <div>
            <strong>Unbilled hours from before this month</strong>
            {staleClientIds.map((id) => clientName(id)).join(', ')} — might be time to
            invoice.
          </div>
          <button
            className="btn btn-sm"
            onClick={() => openSheet({ kind: 'newInvoice', clientId: staleClientIds[0] })}
          >
            Invoice
          </button>
        </div>
      )}

      {data.invoices.length === 0 ? (
        <EmptyState
          glyph="▤"
          lines={['No invoices yet.', 'Bill your logged hours in one tap.']}
        />
      ) : (
        sorted.map((inv) => {
          const status = invoiceStatusComputed(inv);
          return (
            <button
              key={inv.id}
              className={`invoice-card status-${status}`}
              onClick={() => openSheet({ kind: 'viewInvoice', id: inv.id })}
            >
              <div className="inv-top">
                <div>
                  <div className="inv-num">#{inv.number}</div>
                  <div className="inv-client">{clientName(inv.clientId)}</div>
                </div>
                <div className="inv-total">{fmtMoney(inv.total)}</div>
              </div>
              <div className="inv-dates">
                Issued {fmtDMY(inv.issueDate)} · Due {fmtDMY(inv.dueDate)}
              </div>
              <div className="inv-card-foot">
                <span className={'badge ' + STATUS_BADGE[status]}>{status}</span>
                <span
                  className="btn btn-outline btn-xs"
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
                  Hours ▤
                </span>
              </div>
            </button>
          );
        })
      )}
    </>
  );
}
