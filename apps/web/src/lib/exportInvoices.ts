import { downloadBlob, toCsv } from './download';
import { todayIso } from './format';
import { invoiceSortKey, invoiceStatusComputed } from './invoice';
import type { AppData } from './types';

/**
 * Writes the whole invoice book to a CSV a bookkeeper can open.
 *
 * Oldest first — the order the numbers were issued in — and dates stay ISO so
 * a spreadsheet reads them as dates rather than text.
 *
 * @returns false when there is nothing to export.
 */
export function exportInvoicesCsv(data: AppData): boolean {
  if (data.invoices.length === 0) return false;

  const clientName = (id: string) =>
    data.clients.find((c) => c.id === id)?.name ?? 'Neznana stranka';

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

  [...data.invoices]
    .sort((a, b) => invoiceSortKey(a) - invoiceSortKey(b))
    .forEach((inv) => {
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
  return true;
}
