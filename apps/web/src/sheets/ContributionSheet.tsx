import { useEffect, useState } from 'react';
import { Field, Sheet } from '../components/ui';
import { failureMessage } from '../lib/failure';
import { MONTH_NAMES, todayIso } from '../lib/format';
import { resources } from '../lib/resources';
import { useStore } from '../store/context';
import { btn, btnBlock, cardLabel, hint, input, label, row2 } from '../styles/cx';
import { Select } from '../components/Select';

const GROUPS = [
  { key: 'piz', label: 'PIZ', account: 'Pokojninsko in invalidsko zavarovanje' },
  { key: 'zzDo', label: 'ZZ + DO', account: 'Zdravstveno in dolgotrajna oskrba' },
  { key: 'stv', label: 'STV', account: 'Starševsko varstvo' },
  { key: 'zap', label: 'ZAP', account: 'Zaposlovanje' },
] as const;

type GroupKey = (typeof GROUPS)[number]['key'];

/**
 * Recording a real PODO-OPSVZ filing.
 *
 * Everything here is transcribed rather than computed: the estimate the app
 * shows is its own guess, and the filing is the fact. The accounts and
 * references especially — FURS credits a payment by its reference, so an
 * invented one sends money into the wrong obligation.
 */
export function ContributionSheet({
  year,
  onClose,
}: {
  year: number;
  onClose: () => void;
}) {
  const { toast } = useStore();
  const [month, setMonth] = useState(() => String(Number(todayIso().slice(5, 7))));
  const [base, setBase] = useState('');
  const [amounts, setAmounts] = useState<Record<GroupKey, string>>({
    piz: '', zzDo: '', stv: '', zap: '',
  });
  const [payment, setPayment] = useState<Record<GroupKey, { iban: string; reference: string }>>({
    piz: { iban: '', reference: '' },
    zzDo: { iban: '', reference: '' },
    stv: { iban: '', reference: '' },
    zap: { iban: '', reference: '' },
  });
  const [saving, setSaving] = useState(false);

  // Accounts and references barely change month to month, so the last filing
  // is a better starting point than an empty form.
  useEffect(() => {
    let cancelled = false;
    void resources.tax
      .lastPaymentDetails()
      .then((last) => {
        if (last && !cancelled) setPayment(last);
      })
      .catch(() => {
        /* an empty form is a fine fallback */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const total = GROUPS.reduce((sum, g) => sum + (parseFloat(amounts[g.key]) || 0), 0);

  const save = async () => {
    const numbers = Object.fromEntries(
      GROUPS.map((g) => [g.key, parseFloat(amounts[g.key]) || 0]),
    ) as Record<GroupKey, number>;

    if (total <= 0) {
      toast('Vnesite zneske z obračuna');
      return;
    }
    setSaving(true);
    try {
      const saved = await resources.tax.fileContribution({
        year,
        month: Number(month),
        base: parseFloat(base) || 0,
        ...numbers,
        payment,
      });
      // The filing is the authority on the base; say so when it corrects it,
      // rather than quietly changing a number the user typed elsewhere.
      toast(
        saved.baseUpdated
          ? `Obračun shranjen — zavarovalna osnova posodobljena na ${(
              saved.baseUpdated.to / 100
            ).toFixed(2)} €`
          : 'Obračun shranjen',
      );
      onClose();
    } catch (err) {
      toast(failureMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const setAmount = (key: GroupKey, value: string) =>
    setAmounts((a) => ({ ...a, [key]: value }));
  const setAccount = (key: GroupKey, field: 'iban' | 'reference', value: string) =>
    setPayment((p) => ({ ...p, [key]: { ...p[key], [field]: value } }));

  return (
    <Sheet
      title="Obračun prispevkov"
      onClose={onClose}
      footer={
        <button
          className={`${btn.primary} ${btnBlock}`}
          onClick={() => void save()}
          disabled={saving}
        >
          Shrani obračun
        </button>
      }
    >
      <p className={`${hint} mb-4`}>
        Prepišite zneske z obračuna PODO-OPSVZ za {year}. Aplikacija do takrat prikazuje
        svojo oceno.
      </p>

      <div className={row2}>
        <Field label="Mesec" htmlFor="cMonth">
          <Select
            id="cMonth"
            value={month}
            onChange={setMonth}
            options={MONTH_NAMES.map((name, i) => ({
              value: String(i + 1),
              label: name,
            }))}
          />
        </Field>
        <Field label="Zavarovalna osnova (€)" htmlFor="cBase">
          <input
            id="cBase"
            className={input}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="1521.62"
            value={base}
            onChange={(e) => setBase(e.target.value)}
          />
        </Field>
      </div>

      <div className={cardLabel}>Zneski po skupinah</div>
      {GROUPS.map((g) => (
        <div className="mb-4 rounded-2xl border border-border bg-bg p-3" key={g.key}>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold">{g.label}</span>
            <span className="text-2xs text-muted-fg">{g.account}</span>
          </div>

          <Field label="Znesek (€)" htmlFor={`c-${g.key}`}>
            <input
              id={`c-${g.key}`}
              className={input}
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={amounts[g.key]}
              onChange={(e) => setAmount(g.key, e.target.value)}
            />
          </Field>

          <div className={row2}>
            <Field label="Račun (IBAN)" htmlFor={`c-${g.key}-iban`}>
              <input
                id={`c-${g.key}-iban`}
                className={input}
                type="text"
                placeholder="SI56011008882000003"
                value={payment[g.key].iban}
                onChange={(e) => setAccount(g.key, 'iban', e.target.value)}
              />
            </Field>
            <Field label="Sklic" htmlFor={`c-${g.key}-ref`}>
              <input
                id={`c-${g.key}-ref`}
                className={input}
                type="text"
                placeholder="SI19 12345678-44008"
                value={payment[g.key].reference}
                onChange={(e) => setAccount(g.key, 'reference', e.target.value)}
              />
            </Field>
          </div>
        </div>
      ))}

      <div className="mb-4 flex items-baseline justify-between gap-2 rounded-lg border border-border bg-muted px-3 py-2">
        <span className={label + ' mb-0'}>Skupaj</span>
        <span className="font-mono text-sm font-bold">{total.toFixed(2)} €</span>
      </div>
    </Sheet>
  );
}
