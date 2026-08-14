import { useState } from 'react';
import { Field, Sheet } from '../components/ui';
import { todayIso } from '../lib/format';
import { uid } from '../lib/storage';
import type { TaxPaymentType } from '../lib/types';
import { useStore } from '../store/context';
import { btn, btnBlock, input, row2 } from '../styles/cx';
import { Select } from '../components/Select';
import { DateField } from '../components/DateField';

export function TaxPaymentSheet({ onClose }: { onClose: () => void }) {
  const { update, toast } = useStore();
  const [type, setType] = useState<TaxPaymentType>('dohodnina');
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const save = () => {
    const value = parseFloat(amount);
    if (!date || isNaN(value) || value <= 0) {
      toast('Vnesite veljaven datum in znesek');
      return;
    }
    update((d) => {
      d.taxPayments.push({ id: uid('tp'), type, date, amount: value, note: note.trim() });
    });
    toast('Plačilo zabeleženo');
    onClose();
  };

  return (
    <Sheet
      title="Plačilo FURS"
      onClose={onClose}
      footer={
        <button className={`${btn.primary} ${btnBlock}`} onClick={save}>
          Shrani plačilo
        </button>
      }
    >
      <Field label="Vrsta" htmlFor="taxPayType">
        <Select
          id="taxPayType"
          value={type}
          onChange={(v) => setType(v as TaxPaymentType)}
          options={[
            { value: 'dohodnina', label: 'Akontacija dohodnine' },
            { value: 'prispevki', label: 'Prispevki' },
            { value: 'drugo', label: 'Drugo' },
          ]}
        />
      </Field>

      <div className={row2}>
        <Field label="Datum plačila" htmlFor="taxPayDate">
          <DateField
          id="taxPayDate"
          value={date}
          onChange={setDate}
        />
        </Field>
        <Field label="Znesek (EUR)" htmlFor="taxPayAmount">
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

      <Field label="Opomba (neobvezno)" htmlFor="taxPayNote">
        <input
          id="taxPayNote"
          className={input}
          type="text"
          placeholder="npr. akontacija januar"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>

    </Sheet>
  );
}
