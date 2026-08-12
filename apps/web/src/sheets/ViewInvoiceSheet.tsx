import { Receipt } from '../components/Receipt';
import { EditIcon, ListIcon, PrinterIcon, TrashIcon } from '../components/icons';
import { Sheet } from '../components/ui';
import { todayIso } from '../lib/format';
import type { OpenSheet } from '../lib/sheets';
import { useStore } from '../store/context';
import { btn, btnBlock, btnSm, hint } from '../styles/cx';

export function ViewInvoiceSheet({
  id,
  onClose,
  openSheet,
  replaceSheet,
}: {
  id: string;
  onClose: () => void;
  openSheet: OpenSheet;
  replaceSheet: OpenSheet;
}) {
  const { data, update, toast } = useStore();
  const inv = data.invoices.find((i) => i.id === id);

  if (!inv) {
    return (
      <Sheet title="Invoice" onClose={onClose}>
        <p className={hint}>That invoice no longer exists.</p>
      </Sheet>
    );
  }

  const client = data.clients.find((c) => c.id === inv.clientId);

  const togglePaid = () => {
    const nowPaid = inv.status !== 'paid';
    update((d) => {
      const target = d.invoices.find((i) => i.id === id);
      if (!target) return;
      target.status = nowPaid ? 'paid' : 'unpaid';
      target.paidDate = nowPaid ? todayIso() : null;
    });
    toast(nowPaid ? 'Marked as paid' : 'Marked as unpaid');
  };

  const remove = () => {
    if (!confirm('Delete this invoice? Its hours will become unbilled again.')) return;
    update((d) => {
      d.sessions.forEach((s) => {
        if (s.invoiceId === id) {
          s.invoiced = false;
          s.invoiceId = null;
        }
      });
      d.invoices = d.invoices.filter((i) => i.id !== id);
    });
    toast('Invoice deleted');
    onClose();
  };

  return (
    <Sheet title="Invoice" onClose={onClose} printable>
      <Receipt invoice={inv} client={client} profile={data.profile} />

      <div className="no-print mt-4 flex flex-wrap gap-2 [&>button]:flex-1 mt-4">
        <button className={btn.primary} onClick={togglePaid}>
          {inv.status === 'paid' ? 'Mark as unpaid' : 'Mark as paid'}
        </button>
        <button className={`${btn.destructive} grow-0`} onClick={remove}>
          <TrashIcon className="size-3.5" />
          Delete
        </button>
      </div>

      <div className="no-print mt-4 flex flex-wrap gap-2 [&>button]:flex-1 mt-2">
        <button
          className={btn.outline}
          onClick={() => openSheet({ kind: 'timesheet', id })}
        >
          <ListIcon className="size-3.5" />
          View hours
        </button>
        <button className={btn.outline} onClick={() => window.print()}>
          <PrinterIcon className="size-3.5" />
          Print / Save PDF
        </button>
      </div>

      <button
        className={`${btn.ghost} ${btnBlock} ${btnSm} no-print mt-2.5`}
        onClick={() => replaceSheet({ kind: 'editInvoice', id })}
      >
        <EditIcon className="size-3.5" />
        Edit invoice details
      </button>
    </Sheet>
  );
}
