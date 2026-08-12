import { useState } from 'react';
import {
  BackIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  TrashIcon,
} from '../components/icons';
import { Field, StatCard } from '../components/ui';
import { fmtDMY, fmtMoney } from '../lib/format';
import type { OpenSheet } from '../lib/sheets';
import { uid } from '../lib/storage';
import type { TabName, TaxPaymentType } from '../lib/types';
import { useStore } from '../store/context';
import { btn, btnBlock, card, cardLabel, emptyInline, hint, iconBtn, input } from '../styles/cx';

const TYPE_LABELS: Record<TaxPaymentType, string> = {
  dohodnina: 'Akontacija dohodnine',
  prispevki: 'Prispevki',
  drugo: 'Other',
};

export function TaxView({
  openSheet,
  goTab,
}: {
  openSheet: OpenSheet;
  goTab: (t: TabName) => void;
}) {
  const { data, update, toast } = useStore();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());

  const assessment = data.taxAssessments.find((a) => a.year === year);
  // Unsaved edits are kept per year, so switching years doesn't lose one.
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const assessed = drafts[year] ?? (assessment ? String(assessment.amount) : '');
  const setAssessed = (value: string) =>
    setDrafts((d) => ({ ...d, [year]: value }));

  const rate = data.profile.taxRate || 0;
  const monthlyContribution = data.profile.monthlyContribution || 0;

  const paidInYear = data.invoices
    .filter((i) => i.status === 'paid' && i.paidDate?.startsWith(String(year)))
    .reduce((sum, i) => sum + i.total, 0);
  const dohodninaEst = paidInYear * (rate / 100);

  const monthsCount =
    year < now.getFullYear() ? 12 : year === now.getFullYear() ? now.getMonth() + 1 : 0;
  const prispevkiDue = monthlyContribution * monthsCount;
  const totalEstimate = dohodninaEst + prispevkiDue;

  const paymentsThisYear = data.taxPayments.filter((p) => p.date?.startsWith(String(year)));
  const actuallyPaid = paymentsThisYear.reduce((sum, p) => sum + p.amount, 0);
  const balance = totalEstimate - actuallyPaid;

  const sortedPayments = [...paymentsThisYear].sort((a, b) => b.date.localeCompare(a.date));

  const saveAssessment = () => {
    const amount = parseFloat(assessed);
    if (isNaN(amount)) {
      toast('Enter the assessed amount');
      return;
    }
    update((d) => {
      const existing = d.taxAssessments.find((a) => a.year === year);
      if (existing) existing.amount = amount;
      else d.taxAssessments.push({ id: uid('ta'), year, amount });
    });
    toast('Assessment saved');
  };

  const dohodninaPaid = paymentsThisYear
    .filter((p) => p.type === 'dohodnina')
    .reduce((sum, p) => sum + p.amount, 0);
  const diff = assessment ? assessment.amount - dohodninaPaid : 0;

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3 desk:mb-5">
        <button
          className={iconBtn}
          onClick={() => goTab('overview')}
          aria-label="Back to Overview"
        >
          <BackIcon />
        </button>
        <h1 className="flex-1 text-2xl font-bold tracking-tight">Tax</h1>
        <div className="flex items-center gap-2">
          <button
            className={iconBtn}
            onClick={() => setYear((y) => y - 1)}
            aria-label="Previous year"
          >
            <ChevronLeftIcon />
          </button>
          <span className="min-w-10 text-center font-mono font-semibold">{year}</span>
          <button
            className={iconBtn}
            onClick={() => setYear((y) => y + 1)}
            aria-label="Next year"
          >
            <ChevronRightIcon />
          </button>
        </div>
      </div>

      <div className={`${hint} mb-4`}>
        Slovenia splits this in two: <strong>akontacija dohodnine</strong> (income tax
        advance, paid on what you actually earn) and <strong>prispevki</strong> (social
        security — pension, health, parental, employment — a roughly fixed monthly amount
        regardless of income). Both go to FURS but they&apos;re separate obligations.
      </div>

      <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4">
        <StatCard label="Est. dohodnina (year)" value={fmtMoney(dohodninaEst)} tone="primary" />
        <StatCard label="Prispevki due (year)" value={fmtMoney(prispevkiDue)} />
        <StatCard label="Actually paid (year)" value={fmtMoney(actuallyPaid)} />
        <StatCard
          label="Balance"
          tone={balance > 0.005 ? 'behind' : balance < -0.005 ? 'ahead' : undefined}
          value={
            balance > 0.005
              ? `${fmtMoney(balance)} behind`
              : balance < -0.005
                ? `${fmtMoney(Math.abs(balance))} ahead`
                : '€0.00'
          }
        />
      </div>

      <div className={card}>
        <div className={cardLabel}>Payments to FURS</div>
        {sortedPayments.length === 0 ? (
          <div className={emptyInline}>No payments logged for {year} yet.</div>
        ) : (
          sortedPayments.map((p) => (
            <div
              className="flex items-center justify-between gap-2.5 border-b border-muted py-2.5 last:border-b-0"
              key={p.id}
            >
              <div>
                <div className="text-sm font-semibold">{TYPE_LABELS[p.type] ?? p.type}</div>
                <div className="mt-px font-mono text-2xs text-muted-fg">
                  {fmtDMY(p.date)}
                  {p.note ? ' · ' + p.note : ''}
                </div>
              </div>
              <div className="font-mono text-sm text-muted-fg">{fmtMoney(p.amount)}</div>
              <button
                className={iconBtn}
                onClick={() =>
                  update((d) => {
                    d.taxPayments = d.taxPayments.filter((x) => x.id !== p.id);
                  })
                }
                aria-label="Delete payment"
              >
                <TrashIcon className="size-4" />
              </button>
            </div>
          ))
        )}
        <button
          className={`${btn.outline} ${btnBlock}`}
          onClick={() => openSheet({ kind: 'taxPayment' })}
        >
          <PlusIcon className="size-3.5" />
          Log a payment
        </button>
      </div>

      <div className={card}>
        <div className={cardLabel}>Year-end assessment (odločba)</div>
        <div className={`${hint} mb-3`}>
          Once FURS sends your dohodninska odločba for this year, enter the assessed amount
          here to see how it compares to what you paid in akontacije.
        </div>
        <Field label={`Assessed dohodnina for ${year} (EUR)`} htmlFor="taxAssessed">
          <input
            id="taxAssessed"
            className={input}
            type="number"
            min="0"
            step="0.01"
            placeholder="not entered yet"
            value={assessed}
            onChange={(e) => setAssessed(e.target.value)}
          />
        </Field>
        <button className={`${btn.outline} ${btnBlock}`} onClick={saveAssessment}>
          Save assessment
        </button>

        {assessment && (
          <>
            <div className="mt-4 flex items-center justify-between border-t border-dashed border-input-border pt-4">
              <span>{diff >= 0 ? 'Additional to pay' : 'Refund due to you'}</span>
              <span
                className={
                  'text-lg font-bold ' + (diff >= 0 ? 'text-destructive' : 'text-secondary')
                }
              >
                {fmtMoney(Math.abs(diff))}
              </span>
            </div>
            <div className={`${hint} mt-1.5`}>
              Assessed {fmtMoney(assessment.amount)} vs {fmtMoney(dohodninaPaid)} paid in
              akontacije dohodnine logged for {year}.
            </div>
          </>
        )}
      </div>
    </>
  );
}
