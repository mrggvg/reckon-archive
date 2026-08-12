import { Receipt } from '../components/Receipt';
import { Sheet } from '../components/ui';
import { todayIso } from '../lib/format';
import type { OpenSheet } from '../lib/sheets';
import { useStore } from '../store/context';

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
        <p className="hint">That invoice no longer exists.</p>
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

      <div className="btn-row no-print" style={{ marginTop: 16 }}>
        <button className="btn btn-primary" onClick={togglePaid}>
          {inv.status === 'paid' ? 'Mark as unpaid' : 'Mark as paid'}
        </button>
        <button className="btn btn-destructive" style={{ flex: 0 }} onClick={remove}>
          Delete
        </button>
      </div>

      <div className="btn-row no-print" style={{ marginTop: 8 }}>
        <button
          className="btn btn-outline"
          onClick={() => openSheet({ kind: 'timesheet', id })}
        >
          View hours ▤
        </button>
        <button className="btn btn-outline" onClick={() => window.print()}>
          Print / Save PDF
        </button>
      </div>

      <button
        className="btn btn-ghost btn-block btn-sm no-print"
        style={{ marginTop: 10 }}
        onClick={() => replaceSheet({ kind: 'editInvoice', id })}
      >
        Edit invoice details
      </button>
    </Sheet>
  );
}
