import {
  AlertIcon,
  DownloadIcon,
  FilePlusIcon,
  InvoiceIcon,
  ListIcon,
  PlusIcon,
} from '../components/icons';
import { invoiceReadiness } from '@reckon/shared';
import { EmptyState, SectionHead } from '../components/ui';
import { downloadBlob, toCsv } from '../lib/download';
import { fmtDMY, fmtMoney, plural, todayIso } from '../lib/format';
import {
  STATUS_BADGE,
  STATUS_LABEL,
  invoiceSortKey,
  invoiceStatusComputed,
} from '../lib/invoice';
import type { OpenSheet } from '../lib/sheets';
import { useStore } from '../store/context';
import { badge, btn, btnSm, btnXs } from '../styles/cx';

export function InvoicesView({ openSheet }: { openSheet: OpenSheet }) {
  const { data, toast } = useStore();

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

  const exportCsv = () => {
    if (data.invoices.length === 0) {
      toast('Ni računov za izvoz');
      return;
    }
    const sorted = [...data.invoices].sort(
      (a, b) => invoiceSortKey(a) - invoiceSortKey(b),
    );
    const rows: (string | number)[][] = [
      [
        'Številka',
        'Stranka',
        'Datum izdaje',
        'Rok plačila',
        'Opis',
        'Obdobje od',
        'Obdobje do',
        'Znesek EUR',
        'Status',
        'Datum plačila',
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
    toast('Računi izvoženi');
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

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          className={`${btn.outline} ${btnSm} flex-1`}
          onClick={() =>
            openSheet(
              readiness.ready ? { kind: 'importInvoice' } : { kind: 'profile' },
            )
          }
        >
          <FilePlusIcon className="size-3.5" />
          Uvozi obstoječi račun
        </button>
        <button
          className={`${btn.outline} ${btnSm} flex-1`}
          onClick={exportCsv}
        >
          <DownloadIcon className="size-3.5" />
          Izvozi vse (CSV)
        </button>
      </div>

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

      {data.invoices.length === 0 ? (
        <EmptyState
          icon={<InvoiceIcon className="size-8" />}
          lines={[
            'Ni izstavljenih računov.',
            'Zabeležene ure zaračunate z enim klikom.',
          ]}
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
                <span className={badge[STATUS_BADGE[status]]}>
                  {STATUS_LABEL[status]}
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
              </div>
            </button>
          );
        })
      )}
    </>
  );
}
