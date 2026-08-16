import { Receipt } from '../components/Receipt';
import { EditIcon, ListIcon, PrinterIcon, TrashIcon } from '../components/icons';
import { Sheet } from '../components/ui';
import { todayIso } from '../lib/format';
import type { OpenSheet } from '../lib/sheets';
import { failureMessage } from '../lib/failure';
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
  const { data, setInvoicePaid, removeInvoice, toast } = useStore();
  const inv = data.invoices.find((i) => i.id === id);

  if (!inv) {
    return (
      <Sheet title="Račun" onClose={onClose}>
        <p className={hint}>Ta račun ne obstaja več.</p>
      </Sheet>
    );
  }

  const client = data.clients.find((c) => c.id === inv.clientId);

  const togglePaid = () => {
    const nowPaid = inv.status !== 'paid';
    void setInvoicePaid(id, nowPaid, nowPaid ? todayIso() : null)
      .then(() => toast(nowPaid ? 'Označeno kot plačano' : 'Označeno kot neplačano'))
      .catch((err: unknown) => toast(failureMessage(err)));
  };

  const remove = () => {
    if (!confirm('Izbrišem ta račun? Njegove ure bodo spet neobračunane.')) return;
    // Deleting the invoice is what frees its hours; the store re-reads the
    // ledger afterwards rather than assuming which ones came back.
    void removeInvoice(id)
      .then(() => {
        toast('Račun izbrisan');
        onClose();
      })
      .catch((err: unknown) => toast(failureMessage(err)));
  };

  return (
    <Sheet title="Račun" onClose={onClose} printable>
      <Receipt invoice={inv} client={client} profile={data.profile} />

      <div className="no-print mt-4 flex flex-wrap gap-2 [&>button]:flex-1 mt-4">
        <button className={btn.primary} onClick={togglePaid}>
          {inv.status === 'paid' ? 'Označi kot neplačano' : 'Označi kot plačano'}
        </button>
        <button className={`${btn.destructive} grow-0`} onClick={remove}>
          <TrashIcon className="size-3.5" />
          Izbriši
        </button>
      </div>

      <div className="no-print mt-4 flex flex-wrap gap-2 [&>button]:flex-1 mt-2">
        <button
          className={btn.outline}
          onClick={() => openSheet({ kind: 'timesheet', id })}
        >
          <ListIcon className="size-3.5" />
          Delovni list
        </button>
        <button className={btn.outline} onClick={() => window.print()}>
          <PrinterIcon className="size-3.5" />
          Natisni / PDF
        </button>
      </div>

      <button
        className={`${btn.ghost} ${btnBlock} ${btnSm} no-print mt-2.5`}
        onClick={() => replaceSheet({ kind: 'editInvoice', id })}
      >
        <EditIcon className="size-3.5" />
        Uredi podatke računa
      </button>
    </Sheet>
  );
}
