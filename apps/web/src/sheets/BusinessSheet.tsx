import { useState } from 'react';
import {
  DEFAULT_EXPENSE_CAP,
  DEFAULT_EXPENSE_RATE,
  DEFAULT_REVENUE_CAP,
  DEFAULT_TAX_RATE,
  advanceCadence,
  advanceInstalment,
  businessSchema,
  effectiveTaxRate,
  fieldErrors,
} from '@reckon/shared';
import type { Business } from '@reckon/shared';
import { DateField } from '../components/DateField';
import { Select } from '../components/Select';
import { Field, Sheet } from '../components/ui';
import { fmtMoney, todayIso } from '../lib/format';
import { uid } from '../lib/storage';
import { useStore } from '../store/context';
import { btn, btnBlock, cardLabel, hint, input, row2 } from '../styles/cx';

type Draft = Omit<
  Business,
  | 'expenseRatePercent'
  | 'taxRatePercent'
  | 'expectedRevenue'
  | 'advanceAnnual'
  | 'monthlyContribution'
  | 'revenueCap'
  | 'expenseCap'
> & {
  expenseRatePercent: string;
  taxRatePercent: string;
  expectedRevenue: string;
  advanceAnnual: string;
  monthlyContribution: string;
  revenueCap: string;
  expenseCap: string;
};

const blank = (): Draft => ({
  id: uid('biz'),
  firma: '',
  shortName: '',
  startedOn: todayIso(),
  closedOn: null,
  regNumber: '',
  skdCode: '',
  skdName: '',
  insuranceBasis: 'polni',
  scheme: 'normiranec',
  expenseRatePercent: String(DEFAULT_EXPENSE_RATE),
  taxRatePercent: String(DEFAULT_TAX_RATE),
  expectedRevenue: '',
  advanceAnnual: '',
  monthlyContribution: '',
  revenueCap: String(DEFAULT_REVENUE_CAP),
  expenseCap: String(DEFAULT_EXPENSE_CAP),
});

const toDraft = (b: Business): Draft => ({
  ...b,
  expenseRatePercent: String(b.expenseRatePercent),
  taxRatePercent: String(b.taxRatePercent),
  expectedRevenue: String(b.expectedRevenue),
  advanceAnnual: String(b.advanceAnnual),
  monthlyContribution: String(b.monthlyContribution),
  revenueCap: String(b.revenueCap),
  expenseCap: String(b.expenseCap),
});

export function BusinessSheet({
  editing,
  onClose,
}: {
  editing?: Business;
  onClose: () => void;
}) {
  const { update, toast } = useStore();
  const [form, setForm] = useState<Draft>(() => (editing ? toDraft(editing) : blank()));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) =>
      key in e ? Object.fromEntries(Object.entries(e).filter(([k]) => k !== key)) : e,
    );
  };

  const save = () => {
    const parsed = businessSchema.safeParse({
      ...form,
      closedOn: form.closedOn || null,
      expenseRatePercent: parseFloat(form.expenseRatePercent),
      taxRatePercent: parseFloat(form.taxRatePercent),
      expectedRevenue: parseFloat(form.expectedRevenue) || 0,
      advanceAnnual: parseFloat(form.advanceAnnual) || 0,
      monthlyContribution: parseFloat(form.monthlyContribution) || 0,
      revenueCap: parseFloat(form.revenueCap) || 0,
      expenseCap: parseFloat(form.expenseCap) || 0,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      toast('Preverite označena polja');
      return;
    }
    const value = parsed.data;
    update((d) => {
      const at = d.businesses.findIndex((b) => b.id === value.id);
      if (at >= 0) d.businesses[at] = value;
      else d.businesses.push(value);
    });
    toast(editing ? 'Dejavnost posodobljena' : 'Dejavnost registrirana');
    onClose();
  };

  const cls = (key: keyof Draft) => input + (errors[key] ? ' border-destructive' : '');

  // Shown live, so the numbers from the odločba can be sanity-checked here.
  const rate = effectiveTaxRate({
    scheme: form.scheme,
    expenseRatePercent: parseFloat(form.expenseRatePercent) || 0,
    taxRatePercent: parseFloat(form.taxRatePercent) || 0,
  });
  const annual = parseFloat(form.advanceAnnual) || 0;
  const cadence = advanceCadence(annual);

  return (
    <Sheet
      title={editing ? 'Uredi dejavnost' : 'Registracija dejavnosti'}
      onClose={onClose}
      footer={
        <button className={`${btn.primary} ${btnBlock}`} onClick={save}>
          {editing ? 'Shrani spremembe' : 'Dodaj dejavnost'}
        </button>
      }
    >
      <div className={cardLabel}>Vpis v PRS</div>

      <Field
        label="Firma"
        htmlFor="bizFirma"
        error={errors.firma}
        hint="Celotno ime iz sklepa o vpisu, npr. Reševalec iz vode, Ana Novak, s.p."
      >
        <input
          id="bizFirma"
          className={cls('firma')}
          type="text"
          value={form.firma}
          onChange={(e) => set('firma', e.target.value)}
        />
      </Field>

      <Field label="Skrajšana firma" htmlFor="bizShort" error={errors.shortName}>
        <input
          id="bizShort"
          className={cls('shortName')}
          type="text"
          placeholder="Ana Novak, s.p."
          value={form.shortName}
          onChange={(e) => set('shortName', e.target.value)}
        />
      </Field>

      <div className={row2}>
        <Field label="Datum vpisa" htmlFor="bizStart" error={errors.startedOn}>
          <DateField
            id="bizStart"
            value={form.startedOn}
            onChange={(v) => set('startedOn', v)}
            invalid={errors.startedOn ? true : undefined}
          />
        </Field>
        <Field label="Matična številka" htmlFor="bizReg" error={errors.regNumber}>
          <input
            id="bizReg"
            className={cls('regNumber')}
            type="text"
            inputMode="numeric"
            maxLength={10}
            placeholder="1234567000"
            value={form.regNumber}
            onChange={(e) => set('regNumber', e.target.value.replace(/\D/g, '').slice(0, 10))}
          />
        </Field>
      </div>

      <div className={row2}>
        <Field label="Šifra glavne dejavnosti" htmlFor="bizSkd" error={errors.skdCode}>
          <input
            id="bizSkd"
            className={cls('skdCode')}
            type="text"
            placeholder="84.250"
            value={form.skdCode}
            onChange={(e) => set('skdCode', e.target.value)}
          />
        </Field>
        <Field label="Naziv dejavnosti" htmlFor="bizSkdName" error={errors.skdName}>
          <input
            id="bizSkdName"
            className={cls('skdName')}
            type="text"
            placeholder="Zaščita in reševanje …"
            value={form.skdName}
            onChange={(e) => set('skdName', e.target.value)}
          />
        </Field>
      </div>

      <div className={cardLabel}>Zavarovanje in obdavčitev</div>

      <div className={row2}>
        <Field label="Zavarovalna podlaga" htmlFor="bizBasis">
          <Select
            id="bizBasis"
            value={form.insuranceBasis}
            onChange={(v) => set('insuranceBasis', v as Business['insuranceBasis'])}
            options={[
              { value: 'polni', label: 'Polni s.p. (podlaga 05)' },
              { value: 'popoldanski', label: 'Popoldanski s.p.' },
            ]}
          />
        </Field>
        <Field label="Način obdavčitve" htmlFor="bizScheme">
          <Select
            id="bizScheme"
            value={form.scheme}
            onChange={(v) => set('scheme', v as Business['scheme'])}
            options={[
              { value: 'normiranec', label: 'Normiranec' },
              { value: 'dejanski', label: 'Dejanski stroški' },
            ]}
          />
        </Field>
      </div>

      {form.scheme === 'normiranec' && (
        <div className={row2}>
          <Field label="Normirani odhodki (%)" htmlFor="bizExpense" error={errors.expenseRatePercent}>
            <input
              id="bizExpense"
              className={cls('expenseRatePercent')}
              type="number"
              min="0"
              max="100"
              value={form.expenseRatePercent}
              onChange={(e) => set('expenseRatePercent', e.target.value)}
            />
          </Field>
          <Field label="Stopnja dohodnine (%)" htmlFor="bizTaxRate" error={errors.taxRatePercent}>
            <input
              id="bizTaxRate"
              className={cls('taxRatePercent')}
              type="number"
              min="0"
              max="100"
              value={form.taxRatePercent}
              onChange={(e) => set('taxRatePercent', e.target.value)}
            />
          </Field>
        </div>
      )}

      {form.scheme === 'normiranec' && (
        <div className={row2}>
          <Field
            label="Meja prihodkov (EUR)"
            htmlFor="bizRevenueCap"
            error={errors.revenueCap}
            hint="Nad njo normiranstvo preneha."
          >
            <input
              id="bizRevenueCap"
              className={cls('revenueCap')}
              type="number"
              min="0"
              step="1000"
              value={form.revenueCap}
              onChange={(e) => set('revenueCap', e.target.value)}
            />
          </Field>
          <Field
            label="Največ odhodkov (EUR)"
            htmlFor="bizExpenseCap"
            error={errors.expenseCap}
            hint="Zgornja meja priznanih normiranih odhodkov; 0 = brez."
          >
            <input
              id="bizExpenseCap"
              className={cls('expenseCap')}
              type="number"
              min="0"
              step="1000"
              value={form.expenseCap}
              onChange={(e) => set('expenseCap', e.target.value)}
            />
          </Field>
        </div>
      )}

      <div className={`${hint} mb-4`}>
        Preverite pri FURS — meje se spreminjajo in so odvisne od zavarovanja.
        <br />
        Dejanska obremenitev prihodka: <strong>{rate.toLocaleString('sl-SI')} %</strong>
        {form.scheme === 'normiranec' &&
          ` (${form.taxRatePercent} % od ${100 - (parseFloat(form.expenseRatePercent) || 0)} % osnove)`}
      </div>

      <div className={cardLabel}>Akontacija in prispevki</div>

      <div className={row2}>
        <Field
          label="Predvideni prihodki (EUR)"
          htmlFor="bizRevenue"
          error={errors.expectedRevenue}
          hint="Znesek iz obračuna ob registraciji."
        >
          <input
            id="bizRevenue"
            className={cls('expectedRevenue')}
            type="number"
            min="0"
            step="0.01"
            placeholder="5000"
            value={form.expectedRevenue}
            onChange={(e) => set('expectedRevenue', e.target.value)}
          />
        </Field>
        <Field
          label="Letna akontacija (EUR)"
          htmlFor="bizAdvance"
          error={errors.advanceAnnual}
          hint={
            annual > 0
              ? `${cadence === 'monthly' ? 'Mesečni' : 'Trimesečni'} obrok ${fmtMoney(advanceInstalment(annual))}`
              : 'Do 400 € letno se plačuje trimesečno.'
          }
        >
          <input
            id="bizAdvance"
            className={cls('advanceAnnual')}
            type="number"
            min="0"
            step="0.01"
            placeholder="400"
            value={form.advanceAnnual}
            onChange={(e) => set('advanceAnnual', e.target.value)}
          />
        </Field>
      </div>

      <Field
        label="Prispevki na mesec (EUR)"
        htmlFor="bizContribution"
        error={errors.monthlyContribution}
        hint="Trenutni znesek z e-kartice eDavki."
      >
        <input
          id="bizContribution"
          className={cls('monthlyContribution')}
          type="number"
          min="0"
          step="0.01"
          placeholder="651"
          value={form.monthlyContribution}
          onChange={(e) => set('monthlyContribution', e.target.value)}
        />
      </Field>

      {editing && (
        <>
          <div className={cardLabel}>Zaprtje dejavnosti</div>
          <Field
            label="Datum izbrisa"
            htmlFor="bizClosed"
            error={errors.closedOn}
            hint="Ko je dejavnost zaprta, se obveznosti nehajo obračunavati s tem dnem."
          >
            <DateField
              id="bizClosed"
              value={form.closedOn ?? ''}
              onChange={(v) => set('closedOn', v || null)}
              invalid={errors.closedOn ? true : undefined}
            />
          </Field>
        </>
      )}
    </Sheet>
  );
}
