import { useState } from 'react';
import { Field, StatCard } from '../components/ui';
import { fmtDMY, fmtMoney } from '../lib/format';
import type { OpenSheet } from '../lib/sheets';
import { uid } from '../lib/storage';
import type { TabName, TaxPaymentType } from '../lib/types';
import { useStore } from '../store/context';

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
      <div className="section-head">
        <button
          className="icon-btn"
          onClick={() => goTab('overview')}
          aria-label="Back to Overview"
        >
          ‹
        </button>
        <h1 style={{ flex: 1 }}>Tax</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="icon-btn"
            onClick={() => setYear((y) => y - 1)}
            aria-label="Previous year"
          >
            ‹
          </button>
          <span className="mono" style={{ fontWeight: 600, minWidth: 38, textAlign: 'center' }}>
            {year}
          </span>
          <button
            className="icon-btn"
            onClick={() => setYear((y) => y + 1)}
            aria-label="Next year"
          >
            ›
          </button>
        </div>
      </div>

      <div className="hint" style={{ marginBottom: 16 }}>
        Slovenia splits this in two: <strong>akontacija dohodnine</strong> (income tax
        advance, paid on what you actually earn) and <strong>prispevki</strong> (social
        security — pension, health, parental, employment — a roughly fixed monthly amount
        regardless of income). Both go to FURS but they&apos;re separate obligations.
      </div>

      <div className="stats-grid">
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

      <div className="card">
        <div className="card-label">Payments to FURS</div>
        {sortedPayments.length === 0 ? (
          <div className="empty-inline">No payments logged for {year} yet.</div>
        ) : (
          sortedPayments.map((p) => (
            <div className="tax-payment-row" key={p.id}>
              <div>
                <div className="type">{TYPE_LABELS[p.type] ?? p.type}</div>
                <div className="sub">
                  {fmtDMY(p.date)}
                  {p.note ? ' · ' + p.note : ''}
                </div>
              </div>
              <div className="amt">{fmtMoney(p.amount)}</div>
              <button
                className="icon-btn"
                onClick={() =>
                  update((d) => {
                    d.taxPayments = d.taxPayments.filter((x) => x.id !== p.id);
                  })
                }
                aria-label="Delete payment"
              >
                🗑
              </button>
            </div>
          ))
        )}
        <button
          className="btn btn-outline btn-block"
          style={{ marginTop: 12 }}
          onClick={() => openSheet({ kind: 'taxPayment' })}
        >
          + Log a payment
        </button>
      </div>

      <div className="card">
        <div className="card-label">Year-end assessment (odločba)</div>
        <div className="hint" style={{ marginBottom: 12 }}>
          Once FURS sends your dohodninska odločba for this year, enter the assessed amount
          here to see how it compares to what you paid in akontacije.
        </div>
        <Field label={`Assessed dohodnina for ${year} (EUR)`} htmlFor="taxAssessed">
          <input
            id="taxAssessed"
            className="input"
            type="number"
            min="0"
            step="0.01"
            placeholder="not entered yet"
            value={assessed}
            onChange={(e) => setAssessed(e.target.value)}
          />
        </Field>
        <button className="btn btn-outline btn-block" onClick={saveAssessment}>
          Save assessment
        </button>

        {assessment && (
          <>
            <div className="assessment-diff">
              <span>{diff >= 0 ? 'Additional to pay' : 'Refund due to you'}</span>
              <span className={'amt ' + (diff >= 0 ? 'owe' : 'refund')}>
                {fmtMoney(Math.abs(diff))}
              </span>
            </div>
            <div className="hint" style={{ marginTop: 6 }}>
              Assessed {fmtMoney(assessment.amount)} vs {fmtMoney(dohodninaPaid)} paid in
              akontacije dohodnine logged for {year}.
            </div>
          </>
        )}
      </div>
    </>
  );
}
