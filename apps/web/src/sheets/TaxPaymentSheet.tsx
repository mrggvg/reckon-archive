import { useState } from 'react';
import { DateField } from '../components/DateField';
import { Select } from '../components/Select';
import { Field, Sheet } from '../components/ui';
import { failureMessage } from '../lib/failure';
import { MONTH_NAMES, todayIso } from '../lib/format';
import { resources } from '../lib/resources';
import { useStore } from '../store/context';
import { btn, btnBlock, input, row2 } from '../styles/cx';

/** A remittance to FURS, recorded so the forecasts can be checked against it. */
export function TaxPaymentSheet({
  year,
  onClose,
}: {
  year: number;
  onClose: () => void;
}) {
  const { toast } = useStore();
  const [paidOn, setPaidOn] = useState(todayIso());
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<'contributions' | 'income_tax' | 'other'>(
    'contributions',
  );
  // What the payment settles. Contributions belong to a month; income tax to
  // the year. Without this a payment is an amount with no subject, and a year
  // later nobody can tell what it cleared.
  const [month, setMonth] = useState(() => String(Number(todayIso().slice(5, 7))));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const value = parseFloat(amount);
    if (!(value > 0)) {
      toast('Vnesite znesek');
      return;
    }
    setSaving(true);
    try {
      await resources.tax.addPayment({
        paidOn,
        amount: value,
        kind,
        note: note.trim(),
        periodYear: year,
        // A lump payment for a month settles all four groups; a single group is
        // recorded from its own row on the schedule.
        periodMonth: kind === 'contributions' ? Number(month) : null,
        groupKey: null,
      });
      toast('Plačilo zabeleženo');
      onClose();
    } catch (err) {
      toast(failureMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      title="Plačilo FURS"
      onClose={onClose}
      footer={
        <button
          className={`${btn.primary} ${btnBlock}`}
          onClick={() => void save()}
          disabled={saving}
        >
          Zabeleži plačilo
        </button>
      }
    >
      <Field label="Kaj ste plačali" htmlFor="tpKind">
        <Select
          id="tpKind"
          value={kind}
          onChange={(v) => setKind(v as typeof kind)}
          options={[
            { value: 'contributions', label: 'Prispevki' },
            { value: 'income_tax', label: 'Akontacija dohodnine' },
            { value: 'other', label: 'Drugo' },
          ]}
        />
      </Field>

      {kind === 'contributions' && (
        <Field
          label="Za kateri mesec"
          htmlFor="tpMonth"
          hint={`Prispevki za ta mesec v letu ${year}.`}
        >
          <Select
            id="tpMonth"
            value={month}
            onChange={setMonth}
            options={MONTH_NAMES.map((name, i) => ({
              value: String(i + 1),
              label: name,
            }))}
          />
        </Field>
      )}

      <div className={row2}>
        <Field label="Datum plačila" htmlFor="tpDate">
          <DateField id="tpDate" value={paidOn} onChange={setPaidOn} />
        </Field>
        <Field label="Znesek (€)" htmlFor="tpAmount">
          <input
            id="tpAmount"
            className={input}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="465.79"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Zaznamek" htmlFor="tpNote" hint="Na primer obdobje, na katero se nanaša.">
        <input
          id="tpNote"
          className={input}
          type="text"
          placeholder="npr. prispevki 07/2026"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
    </Sheet>
  );
}
