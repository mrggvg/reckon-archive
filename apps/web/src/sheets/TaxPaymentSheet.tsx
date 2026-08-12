import { useState } from 'react';
import { Field, Sheet } from '../components/ui';
import { todayIso } from '../lib/format';
import { uid } from '../lib/storage';
import type { TaxPaymentType } from '../lib/types';
import { useStore } from '../store/context';
import { btn, btnBlock, input, row2 } from '../styles/cx';

export function TaxPaymentSheet({ onClose }: { onClose: () => void }) {
  const { update, toast } = useStore();
  const [type, setType] = useState<TaxPaymentType>('dohodnina');
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const save = () => {
    const value = parseFloat(amount);
    if (!date || isNaN(value) || value <= 0) {
      toast('Enter a valid date and amount');
      return;
    }
    update((d) => {
      d.taxPayments.push({ id: uid('tp'), type, date, amount: value, note: note.trim() });
    });
    toast('Payment logged');
    onClose();
  };

  return (
    <Sheet title="Log a FURS payment" onClose={onClose}>
      <Field label="Type" htmlFor="taxPayType">
        <select
          id="taxPayType"
          className={input}
          value={type}
          onChange={(e) => setType(e.target.value as TaxPaymentType)}
        >
          <option value="dohodnina">Akontacija dohodnine</option>
          <option value="prispevki">Prispevki (social security)</option>
          <option value="drugo">Other</option>
        </select>
      </Field>

      <div className={row2}>
        <Field label="Date paid" htmlFor="taxPayDate">
          <input
            id="taxPayDate"
            className={input}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="Amount (EUR)" htmlFor="taxPayAmount">
          <input
            id="taxPayAmount"
            className={input}
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Note (optional)" htmlFor="taxPayNote">
        <input
          id="taxPayNote"
          className={input}
          type="text"
          placeholder="e.g. January akontacija"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>

      <button className={`${btn.primary} ${btnBlock}`} onClick={save}>
        Save payment
      </button>
    </Sheet>
  );
}
