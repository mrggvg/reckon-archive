import { Receipt } from '../components/Receipt';
import { EditIcon, ListIcon, PrinterIcon, TrashIcon } from '../components/icons';
import { Sheet } from '../components/ui';
import { fmtDMY, todayIso } from '../lib/format';
import { numberAfterDelete, unpaidWarning } from '../lib/invoice';
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
    // Marking paid is safe and reversible; reversing it is the one that moves
    // money out of a month whose taxes may already be settled.
    if (!nowPaid && !confirm(unpaidWarning(inv, client?.name ?? inv.clientName ?? 'stranko'))) return;
    void setInvoicePaid(id, nowPaid, nowPaid ? todayIso() : null)
      .then(() => toast(nowPaid ? 'Označeno kot plačano' : 'Označeno kot neplačano'))
      .catch((err: unknown) => toast(failureMessage(err)));
  };

  /*
   * Deleting is the one place the numbering can go backwards.
   *
   * The series is derived from the ledger, so removing the newest invoice hands
   * its number to the next one. That is usually what someone wants — a wrong
   * invoice deleted minutes after it was made should not burn a number — but if
   * the invoice has already been sent, the same number ends up on two different
   * documents. Only the user knows which case this is, so they are told which
   * number is at stake before they answer.
   */
  const remove = () => {
    const freed = numberAfterDelete(data.invoices, inv, data.profile.nextInvoiceNumber);
    const consequence =
      freed === inv.number
        ? `Številko ${inv.number} bo dobil naslednji račun. Če ste ta račun že ` +
          'poslali stranki, bosta v obtoku dva dokumenta z isto številko.'
        : `Številka ${inv.number} ostane preskočena — naslednji račun dobi ${freed}.`;
    // A paid invoice is also a record of money that arrived, and the tax figures
    // are counted from it. Deleting one removes both, so it is named first.
    const settled =
      inv.status === 'paid'
        ? `Račun je označen kot plačan${
            inv.paidDate ? ` ${fmtDMY(inv.paidDate)}` : ''
          }; z brisanjem izgine tudi ta prejem iz izračuna davkov. `
        : '';
    if (
      !confirm(
        `Izbrišem račun ${inv.number}?\n\n${settled}Njegove ure bodo spet ` +
          `neobračunane. ${consequence}`,
      )
    )
      return;
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
