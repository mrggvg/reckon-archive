import { useState } from 'react';
import {
  BackIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  TrashIcon,
} from '../components/icons';
import {
  advanceCadence,
  advanceInstalment,
  contributionReliefEndsOn,
  normiranecCapUsage,
} from '@reckon/shared';
import { Field, StatCard } from '../components/ui';
import { activeBusiness, contributionsForYear, incomeTaxForYear } from '../lib/business';
import { missingInvoiceNumbers } from '../lib/invoice';
import { InvoiceHistoryRequired } from '../components/InvoiceHistoryRequired';
import { fmtDMY, fmtMoney, todayIso } from '../lib/format';
import type { OpenSheet } from '../lib/sheets';
import { uid } from '../lib/storage';
import type { TabName, TaxPaymentType } from '../lib/types';
import { useStore } from '../store/context';
import { btn, btnBlock, btnSm, card, cardLabel, emptyInline, hint, iconBtn, input } from '../styles/cx';

const TYPE_LABELS: Record<TaxPaymentType, string> = {
  dohodnina: 'Akontacija dohodnine',
  prispevki: 'Prispevki',
  drugo: 'Drugo',
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

  const business = activeBusiness(data.businesses);

  const paidThisYear = data.invoices.filter(
    (i) => i.status === 'paid' && i.paidDate?.startsWith(String(year)),
  );
  const paidInYear = paidThisYear.reduce((sum, i) => sum + i.total, 0);

  // Taxed at the rate of whichever registration was in force when it was paid;
  // the profile's own rate is only a fallback for pre-registration data.
  const dohodninaEst = incomeTaxForYear(data.businesses, paidThisYear, data.profile.taxRate || 0);

  // Prispevki run from the day of vpis, not from January — and stop at izbris.
  const prispevkiDue = data.businesses.length
    ? contributionsForYear(data.businesses, year, todayIso())
    : (data.profile.monthlyContribution || 0) *
      (year < now.getFullYear() ? 12 : year === now.getFullYear() ? now.getMonth() + 1 : 0);

  const totalEstimate = dohodninaEst + prispevkiDue;

  const cap = normiranecCapUsage(paidInYear, business?.revenueCap);
  const missing = missingInvoiceNumbers(data.profile.nextInvoiceNumber, data.invoices);
  const relief = business ? contributionReliefEndsOn(business) : null;

  const paymentsThisYear = data.taxPayments.filter((p) => p.date?.startsWith(String(year)));
  const actuallyPaid = paymentsThisYear.reduce((sum, p) => sum + p.amount, 0);
  const balance = totalEstimate - actuallyPaid;

  const sortedPayments = [...paymentsThisYear].sort((a, b) => b.date.localeCompare(a.date));

  const saveAssessment = () => {
    const amount = parseFloat(assessed);
    if (isNaN(amount)) {
      toast('Vnesite odmerjeni znesek');
      return;
    }
    update((d) => {
      const existing = d.taxAssessments.find((a) => a.year === year);
      if (existing) existing.amount = amount;
      else d.taxAssessments.push({ id: uid('ta'), year, amount });
    });
    toast('Odločba shranjena');
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
          aria-label="Nazaj na pregled"
        >
          <BackIcon />
        </button>
        <h1 className="flex-1 text-2xl font-bold tracking-tight">Davki</h1>
        <div className="flex items-center gap-2">
          <button
            className={iconBtn}
            onClick={() => setYear((y) => y - 1)}
            aria-label="Prejšnje leto"
          >
            <ChevronLeftIcon />
          </button>
          <span className="min-w-10 text-center font-mono font-semibold">{year}</span>
          <button
            className={iconBtn}
            onClick={() => setYear((y) => y + 1)}
            aria-label="Naslednje leto"
          >
            <ChevronRightIcon />
          </button>
        </div>
      </div>

      <div className={`${hint} mb-4`}>
Dajatve sta dve: <strong>akontacija dohodnine</strong> (odvisna od dejanskega
        zaslužka) in <strong>prispevki</strong> (PIZ, zdravstvo, starševsko varstvo in
        zaposlovanje — približno stalen mesečni znesek ne glede na prihodek). Oboje gre
        FURS-u, a sta ločeni obveznosti.
      </div>

      {business && (
        <div className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-xs">
          <div className={cardLabel}>Dejavnost</div>
          <div className="text-sm font-semibold">{business.firma || '—'}</div>
          <div className={`${hint} mt-1`}>
            Vpis {fmtDMY(business.startedOn)}
            {business.closedOn ? ` · izbris ${fmtDMY(business.closedOn)}` : ''}
            {business.skdCode ? ` · SKD ${business.skdCode}` : ''}
          </div>
          {business.advanceAnnual > 0 && (
            <div className={`${hint} mt-1`}>
              Akontacija {fmtMoney(business.advanceAnnual)} letno ·{' '}
              {advanceCadence(business.advanceAnnual) === 'monthly' ? 'mesečni' : 'trimesečni'} obrok{' '}
              {fmtMoney(advanceInstalment(business.advanceAnnual))}
            </div>
          )}
          {relief && !business.closedOn && (
            <div className={`${hint} mt-1`}>
              Znižani prispevki: 50 % do {fmtDMY(relief.firstTierEndsOn)}, nato 30 % do{' '}
              {fmtDMY(relief.secondTierEndsOn)}.
            </div>
          )}
          <button
            className={`${btn.outline} ${btnSm} mt-3`}
            onClick={() => openSheet({ kind: 'business', editing: business })}
          >
            Uredi dejavnost
          </button>
        </div>
      )}

      {!business && (
        <div className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-xs">
          <div className={cardLabel}>Dejavnost ni vnesena</div>
          <div className={hint}>
            Vnesite podatke o vpisu s.p., da bodo prispevki obračunani od dneva začetka in
            ne od januarja.
          </div>
          <button
            className={`${btn.primary} ${btnSm} mt-3`}
            onClick={() => openSheet({ kind: 'business' })}
          >
            Registriraj dejavnost
          </button>
        </div>
      )}

      {missing.length > 0 && (
        <InvoiceHistoryRequired
          missing={missing}
          onRecord={(number) => openSheet({ kind: 'importInvoice', prefillNumber: number })}
        />
      )}

      {missing.length === 0 && (cap.nearing || cap.exceeded) && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-border bg-warning-bg p-4 text-sm leading-normal text-warning-fg">
          <div>
            <strong className="mb-0.5 block">
              {cap.exceeded ? 'Meja za normiranca presežena' : 'Približujete se meji za normiranca'}
            </strong>
            {fmtMoney(paidInYear)} od {fmtMoney(cap.cap)} letnega prihodka.
          </div>
        </div>
      )}

      {missing.length === 0 && (
        <>
      <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4">
        <StatCard label="Ocenjena dohodnina (leto)" value={fmtMoney(dohodninaEst)} tone="primary" />
        <StatCard label="Prispevki (leto)" value={fmtMoney(prispevkiDue)} />
        <StatCard label="Dejansko plačano (leto)" value={fmtMoney(actuallyPaid)} />
        <StatCard
          label="Razlika"
          tone={balance > 0.005 ? 'behind' : balance < -0.005 ? 'ahead' : undefined}
          value={
            balance > 0.005
              ? `${fmtMoney(balance)} zaostanka`
              : balance < -0.005
                ? `${fmtMoney(Math.abs(balance))} vnaprej`
                : '€0.00'
          }
        />
      </div>

      <div className={card}>
        <div className={cardLabel}>Plačila FURS</div>
        {sortedPayments.length === 0 ? (
          <div className={emptyInline}>Za leto {year} ni zabeleženih plačil.</div>
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
                aria-label="Izbriši plačilo"
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
          Dodaj plačilo
        </button>
      </div>
        </>
      )}

      <div className={card}>
        <div className={cardLabel}>Letna odločba</div>
        <div className={`${hint} mb-3`}>
          Ko prejmete dohodninsko odločbo za to leto, vnesite odmerjeni znesek in
          primerjajte ga s plačanimi akontacijami.
        </div>
        <Field label={`Odmerjena dohodnina za ${year} (EUR)`} htmlFor="taxAssessed">
          <input
            id="taxAssessed"
            className={input}
            type="number"
            min="0"
            step="0.01"
            placeholder="še ni vneseno"
            value={assessed}
            onChange={(e) => setAssessed(e.target.value)}
          />
        </Field>
        <button className={`${btn.outline} ${btnBlock}`} onClick={saveAssessment}>
          Shrani odločbo
        </button>

        {assessment && (
          <>
            <div className="mt-4 flex items-center justify-between border-t border-dashed border-input-border pt-4">
              <span>{diff >= 0 ? 'Za doplačilo' : 'Za vračilo'}</span>
              <span
                className={
                  'text-lg font-bold ' + (diff >= 0 ? 'text-destructive' : 'text-secondary')
                }
              >
                {fmtMoney(Math.abs(diff))}
              </span>
            </div>
            <div className={`${hint} mt-1.5`}>
              Odmerjeno {fmtMoney(assessment.amount)} proti {fmtMoney(dohodninaPaid)}{' '}
              plačanih akontacij za {year}.
            </div>
          </>
        )}
      </div>
    </>
  );
}
