import { useCallback, useEffect, useState } from 'react';
import {
  AlertIcon,
  CalendarIcon,
  CheckCircleIcon,
  PlusIcon,
  TrashIcon,
} from '../components/icons';
import { SectionHead } from '../components/ui';
import { EarningsView } from './EarningsView';
import { TrajectoryChart } from '../components/TrajectoryChart';
import { UpnQr } from '../components/UpnQr';
import { failureMessage } from '../lib/failure';
import { MONTH_NAMES, fmtDMY, fmtMoney, todayIso } from '../lib/format';
import { resources } from '../lib/resources';
import { splitContributionMonths } from '../lib/taxSchedule';
import type { OpenSheet } from '../lib/sheets';
import type {
  ContributionMonth,
  TaxPayment,
  TaxSummary,
  Trajectory,
} from '../lib/types';
import { useStore } from '../store/context';
import { badge, btn, btnSm, btnXs, cardLabel, iconBtn, tabSeg } from '../styles/cx';

const GROUPS = [
  { key: 'piz', label: 'PIZ', full: 'Pokojninsko in invalidsko' },
  { key: 'zzDo', label: 'ZZ + DO', full: 'Zdravstveno in dolgotrajna oskrba' },
  { key: 'stv', label: 'STV', full: 'Starševsko varstvo' },
  { key: 'zap', label: 'ZAP', full: 'Zaposlovanje' },
] as const;

const PAYMENT_KIND: Record<TaxPayment['kind'], string> = {
  contributions: 'Prispevki',
  income_tax: 'Akontacija dohodnine',
  other: 'Drugo',
};

const pct = (v: number) => `${Math.round(v * 100)} %`;

/**
 * Two related questions, deliberately not mixed: what is owed, and what is
 * left. Same inputs, different answers.
 */
function PaneSwitch({
  pane,
  setPane,
}: {
  pane: 'owed' | 'earned';
  setPane: (p: 'owed' | 'earned') => void;
}) {
  return (
    <div className="mb-3 flex gap-0.5 rounded-lg bg-muted p-1">
      <button type="button" className={tabSeg(pane === 'owed')} onClick={() => setPane('owed')}>
        Obveznosti
      </button>
      <button type="button" className={tabSeg(pane === 'earned')} onClick={() => setPane('earned')}>
        Zaslužek na uro
      </button>
    </div>
  );
}

/**
 * What is owed to FURS, and when.
 *
 * Ordered by what a person needs to know standing at their phone: the figure
 * to pay this month first, then each obligation on its own terms, then the
 * year's shape, then the records that produced it.
 */
export function TaxView({ openSheet }: { openSheet: OpenSheet }) {
  const { data, toast } = useStore();
  const [pane, setPane] = useState<'owed' | 'earned'>('owed');
  const [year, setYear] = useState(() => Number(todayIso().slice(0, 4)));
  const [summary, setSummary] = useState<TaxSummary | null>(null);
  const [trajectory, setTrajectory] = useState<Trajectory | null>(null);
  const [months, setMonths] = useState<ContributionMonth[]>([]);
  const [payments, setPayments] = useState<TaxPayment[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [openMonth, setOpenMonth] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, t, m, p] = await Promise.all([
        resources.tax.summary(year),
        resources.tax.trajectory(year),
        resources.tax.contributions(year),
        resources.tax.payments(year),
      ]);
      setSummary(s);
      setTrajectory(t);
      setMonths(m);
      setPayments(p);
      setStatus('ready');
    } catch (err) {
      setError(failureMessage(err));
      setStatus('error');
    }
  }, [year]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  /**
   * Recording a payment where it was made, rather than as a loose entry.
   *
   * The point of paying early is not having to remember afterwards what the
   * transfer was for, so the row that produced it writes that down.
   */
  const markPaid = async (
    m: ContributionMonth,
    group: 'piz' | 'zzDo' | 'stv' | 'zap',
    label: string,
  ) => {
    try {
      await resources.tax.addPayment({
        paidOn: todayIso(),
        amount: m.breakdown[group],
        kind: 'contributions',
        note: `${label} ${String(m.month).padStart(2, '0')}/${m.year}`,
        periodYear: m.year,
        periodMonth: m.month,
        groupKey: group === 'zzDo' ? 'zz_do' : group,
      });
      await load();
      toast(`${label} ${String(m.month).padStart(2, '0')}/${m.year} označeno kot plačano`);
    } catch (err) {
      toast(failureMessage(err));
    }
  };

  /** One transfer for the lot, which is how a month is usually settled. */
  const markMonthPaid = async (m: ContributionMonth) => {
    try {
      await resources.tax.addPayment({
        paidOn: todayIso(),
        amount: m.total - m.settled.paid,
        kind: 'contributions',
        note: `Prispevki ${String(m.month).padStart(2, '0')}/${m.year}`,
        periodYear: m.year,
        periodMonth: m.month,
        groupKey: null,
      });
      await load();
      toast(`Prispevki ${String(m.month).padStart(2, '0')}/${m.year} označeni kot plačani`);
    } catch (err) {
      toast(failureMessage(err));
    }
  };

  const removePayment = async (id: string) => {
    try {
      await resources.tax.deletePayment(id);
      setPayments((list) => list.filter((p) => p.id !== id));
      await load();
      toast('Plačilo izbrisano');
    } catch (err) {
      toast(failureMessage(err));
    }
  };

  const years = [year - 1, year, year + 1];

  if (status === 'loading' || !summary || !trajectory) {
    return (
      <>
        <SectionHead title="Davki" />
        <p className="text-sm text-muted-fg">
          {status === 'error' ? error : 'Računam …'}
        </p>
      </>
    );
  }

  const { thisMonth, contributions, dohodnina } = summary;
  const { due, settled: settledMonths } = splitContributionMonths(
    months,
    contributions.dueMonth,
  );

  if (pane === 'earned') {
    return (
      <>
        <PaneSwitch pane={pane} setPane={setPane} />
        <EarningsView />
      </>
    );
  }

  return (
    <>
      <PaneSwitch pane={pane} setPane={setPane} />
      <SectionHead
        title="Davki"
        meta={
          contributions.dueMonth
            ? `obveznosti za ${MONTH_NAMES[contributions.dueMonth - 1]?.toLowerCase()} ${year}`
            : String(year)
        }
      >
        <div className="flex shrink-0 gap-1">
          {years.map((y) => (
            <button
              key={y}
              className={`${y === year ? btn.primary : btn.outline} ${btnSm}`}
              onClick={() => setYear(y)}
            >
              {y}
            </button>
          ))}
        </div>
      </SectionHead>

      {/* ── the one number, and only from what is known ───────────────────── */}
      <div className="mb-4 rounded-2xl border border-border bg-primary p-5 text-primary-fg shadow-xs desk:p-6">
        <div className="font-mono text-2xs uppercase tracking-wider opacity-80">
          {contributions.dueMonth
            ? `Za plačilo — ${MONTH_NAMES[contributions.dueMonth - 1]?.toLowerCase()}`
            : 'Za plačilo'}
        </div>
        <div className="mt-1 text-4xl font-bold tracking-tight tabular-nums">
          {fmtMoney(thisMonth.total)}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm opacity-90">
          <span className="flex items-center gap-1.5">
            Prispevki{' '}
            {thisMonth.contributionsSettled ? (
              <>
                <CheckCircleIcon className="size-3.5" />
                plačani
              </>
            ) : thisMonth.contributions === null ? (
              '—'
            ) : (
              fmtMoney(thisMonth.contributions)
            )}
          </span>
          <span>
            Priporočena akontacija {fmtMoney(thisMonth.recommendedDohodnina)}
          </span>
        </div>
      </div>

      {/*
        Nothing is guessed at here. Income tax comes from invoices that have
        actually been paid; contributions come from the registration date, and
        until that exists the app says so rather than showing a figure that
        looks authoritative and isn't.
      */}
      {/*
        A year before the s.p. was registered owes nothing — not a smaller
        amount, nothing — and saying that is more useful than an empty card.
      */}
      {contributions.beforeBusiness && (
        <p className="mb-4 flex items-start gap-2 rounded-2xl border border-border bg-info-bg px-4 py-3 text-xs leading-normal text-info-fg">
          <CalendarIcon className="mt-0.5 size-3.5 shrink-0" />
          <span>
            V letu {year} dejavnost še ni bila odprta
            {contributions.businessStartDate
              ? ` — začela se je ${fmtDMY(contributions.businessStartDate)}`
              : ''}
            , zato za to leto ni prispevkov.
          </span>
        </p>
      )}

      {contributions.estimateUnavailable && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-border bg-info-bg p-4 text-info-fg">
          <AlertIcon className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <strong className="block text-sm">Prispevkov za popoldanski s.p. ne računamo</strong>
            <p className="mt-0.5 mb-0 text-xs leading-normal">
              Popoldanski s.p. plačuje pavšalne prispevke — nekaj čez sto evrov na mesec —
              in ne deleža zavarovalne osnove. Da ne bi prikazali napačne številke,
              zneskov ne ocenjujemo: vnesite jih z obračuna prek »Vnesi obračun«.
              Dohodnina se izračuna normalno.
            </p>
          </div>
        </div>
      )}

      {!contributions.configured && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-border bg-warning-bg p-4 text-warning-fg">
          <AlertIcon className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <strong className="block text-sm">Prispevki še niso izračunani</strong>
            <p className="mt-0.5 mb-2 text-xs leading-normal">
              Za izračun potrebujemo datum začetka dejavnosti in zavarovalno osnovo z
              vašega obračuna — brez njiju bi bila številka izmišljena.
            </p>
            <button
              className={`${btn.outline} ${btnSm} bg-card`}
              onClick={() => openSheet({ kind: 'profile' })}
            >
              Dopolni podatke v profilu
            </button>
          </div>
        </div>
      )}

      {summary.partialYear && (
        <p className="mb-4 flex items-start gap-2 rounded-2xl border border-border bg-info-bg px-4 py-3 text-xs leading-normal text-info-fg">
          <CalendarIcon className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Prvo delno leto: dejavnost od {fmtDMY(summary.partialYear.businessStartDate)},
            torej {summary.partialYear.monthsCovered} mesecev. Pragovi se ne
            sorazmerno znižajo — leto je krajše, meje pa ostanejo iste.
          </span>
        </p>
      )}

      {/* ── the two obligations, deliberately apart ───────────────────────── */}
      <div className="mb-4 grid grid-cols-1 gap-3 min-[720px]:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-xs desk:p-5">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className={cardLabel + ' mb-0'}>Prispevki</div>
            <span className={badge.muted}>po koledarju</span>
          </div>
          <div className="text-2xl font-bold tracking-tight tabular-nums">
            {contributions.dueSettled ? (
              <span className="flex items-center gap-2 text-success-fg">
                <CheckCircleIcon className="size-5 shrink-0" />
                <span>
                  Plačano
                  <span className="ml-1.5 font-mono text-sm font-normal text-muted-fg">
                    {fmtMoney(contributions.monthlyAmount ?? 0)}
                  </span>
                </span>
              </span>
            ) : contributions.monthlyAmount === null ? (
              <span className="text-base font-normal text-muted-fg">
                {contributions.beforeBusiness
                  ? 'Dejavnost še ni bila odprta'
                  : contributions.estimateUnavailable
                    ? 'Pavšal — vnesite z obračuna'
                    : contributions.configured
                      ? 'Za to leto še ni zapadlo nič'
                      : 'Ni podatkov za izračun'}
              </span>
            ) : (
              <>
                {fmtMoney(contributions.monthlyAmount)}
                <span className="ml-1 text-sm font-normal text-muted-fg">/ mesec</span>
              </>
            )}
          </div>

          <dl
            className={
              'mt-3 flex flex-col gap-1.5 text-xs ' +
              (contributions.configured && !contributions.beforeBusiness ? '' : 'hidden')
            }
          >
            <div className="flex justify-between gap-2">
              <dt className="text-muted-fg">Olajšava</dt>
              <dd className="font-mono font-semibold">
                {contributions.relief > 0 ? pct(contributions.relief) + ' na PIZ' : 'brez'}
              </dd>
            </div>
            {contributions.nextReliefChange && (
              <div className="flex justify-between gap-2">
                <dt className="text-muted-fg">Naslednja sprememba</dt>
                <dd className="font-mono">
                  {fmtDMY(contributions.nextReliefChange.onIso)} →{' '}
                  {pct(contributions.nextReliefChange.relief)}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <dt className="text-muted-fg">Letos plačano</dt>
              <dd className="font-mono">
                {fmtMoney(contributions.paidThisYear)} od {fmtMoney(contributions.dueThisYear)}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-xs desk:p-5">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className={cardLabel + ' mb-0'}>Dohodnina</div>
            <span className={badge.muted}>po prihodkih</span>
          </div>
          <div className="text-2xl font-bold tracking-tight tabular-nums">
            {fmtMoney(dohodnina.recommendedNow)}
            <span className="ml-1 text-sm font-normal text-muted-fg">priporočeno zdaj</span>
          </div>

          <dl className="mt-3 flex flex-col gap-1.5 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-fg">Prejeto letos</dt>
              <dd className="font-mono">{fmtMoney(dohodnina.ytdRevenue)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-fg">Mejna / efektivna stopnja</dt>
              <dd className="font-mono">
                {pct(dohodnina.marginalRate)} / {(dohodnina.effectiveRate * 100).toFixed(1)} %
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-fg">Obračunano / plačano</dt>
              <dd className="font-mono">
                {fmtMoney(dohodnina.owedToDate)} / {fmtMoney(dohodnina.paidToDate)}
              </dd>
            </div>
          </dl>

          {summary.officialInstallment && (
            <p className="mt-3 border-t border-border pt-2 text-2xs leading-normal text-muted-fg">
              Uradna akontacija je{' '}
              <strong>{fmtMoney(summary.officialInstallment.amount)}</strong>{' '}
              {summary.officialInstallment.frequency === 'quarterly'
                ? 'na četrtletje'
                : 'na mesec'}{' '}
              — to je določen obrok, ne isto kot zgornji priporočeni znesek.
            </p>
          )}

          {/*
            Paying this while invoices are still out means paying it again as
            each one lands: the recommendation is only ever square with money
            that has arrived, and every later payment adds tax on top of it.
          */}
          {dohodnina.outstanding.count > 0 && (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-warning-bg p-2.5 text-2xs leading-normal text-warning-fg">
              <AlertIcon className="mt-px size-3.5 shrink-0" />
              <span>
                Odprtih je še {dohodnina.outstanding.count}{' '}
                {dohodnina.outstanding.count === 1 ? 'račun' : 'računov'} za{' '}
                <strong>{fmtMoney(dohodnina.outstanding.amount)}</strong>. Ko bodo
                plačani, se akontacija poveča še za{' '}
                <strong>{fmtMoney(dohodnina.outstanding.taxIfPaid)}</strong> — če
                plačate zdaj, boste ob vsakem prejetem plačilu doplačevali znova.
                Praviloma se splača počakati, da so računi plačani.
              </span>
            </p>
          )}

          {dohodnina.recommendedNow > 0 && (
            <>
              <UpnQr
                className="mt-3"
                profile={data.profile}
                amount={dohodnina.recommendedNow}
                iban={dohodnina.iban}
                reference={dohodnina.reference}
                purpose={`Akontacija dohodnine ${year}`}
                title="Priporočeno plačilo"
              />
              <button
                className={`${btn.outline} ${btnXs} mt-1.5`}
                onClick={() => {
                  void resources.tax
                    .addPayment({
                      paidOn: todayIso(),
                      amount: dohodnina.recommendedNow,
                      kind: 'income_tax',
                      note: `Akontacija dohodnine ${year}`,
                      periodYear: year,
                      periodMonth: null,
                      groupKey: null,
                    })
                    .then(load)
                    .then(() => toast('Plačilo dohodnine zabeleženo'))
                    .catch((err: unknown) => toast(failureMessage(err)));
                }}
              >
                <CheckCircleIcon className="size-3" />
                Označi kot plačano
              </button>
            </>
          )}
        </section>
      </div>

      {/* ── the year's shape ──────────────────────────────────────────────── */}
      <section className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-xs desk:p-5">
        <div className={cardLabel}>Prihodki skozi leto</div>
        <TrajectoryChart trajectory={trajectory} />
        {trajectory.outstanding > 0 && (
          <p className="mt-3 text-xs leading-normal text-muted-fg">
            Razlika med črtama je <strong>{fmtMoney(trajectory.outstanding)}</strong> —
            izdano, a še ne prejeto. Ta denar še ni obdavčen, ker davek teče od dneva
            prejema.
          </p>
        )}
      </section>

      {/* ── what is still to pay ──────────────────────────────────────────── */}
      <section className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-xs desk:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className={cardLabel + ' mb-0'}>Prispevki za plačilo</div>
          <button
            className={`${btn.outline} ${btnSm}`}
            onClick={() => openSheet({ kind: 'contribution', year })}
          >
            <PlusIcon className="size-3.5" />
            Vnesi obračun
          </button>
        </div>

        {months.length === 0 ? (
          <p className="text-xs leading-normal text-muted-fg">
            {contributions.configured
              ? 'Za to leto ni mesecev — dejavnost se je začela pozneje.'
              : 'Ko v profil vnesete datum začetka dejavnosti, se tu izpiše mesečni razpored s prispevki.'}
          </p>
        ) : due.length === 0 ? (
          <p className="flex items-center gap-2 text-xs text-success-fg">
            <CheckCircleIcon className="size-3.5" />
            Vse do tega meseca je plačano.
          </p>
        ) : (
          <div className="flex flex-col">
            {due.map((m) => (
              <div key={m.month} className="border-t border-border first:border-t-0">
                <button
                  className="flex w-full cursor-pointer items-center justify-between gap-3 py-2.5 text-left"
                  onClick={() => setOpenMonth(openMonth === m.month ? null : m.month)}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {MONTH_NAMES[m.month - 1]}
                    </span>
                    <span className={m.estimated ? badge.warning : badge.success}>
                      {m.estimated ? 'ocena' : 'obračun'}
                    </span>
                    {Object.values(m.settled.groups).every(Boolean) && (
                      <span className={badge.success}>plačano</span>
                    )}
                  </span>
                  <span className="font-mono text-sm font-semibold tabular-nums">
                    {fmtMoney(m.total)}
                  </span>
                </button>

                {openMonth === m.month && (
                  <div className="pb-3">
                    {GROUPS.map((g) => (
                      <div
                        key={g.key}
                        className="mb-2 rounded-lg border border-border bg-bg p-3"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-xs font-semibold">
                            {g.label}
                            <span className="ml-1.5 font-normal text-muted-fg">
                              {g.full}
                            </span>
                          </span>
                          <span className="font-mono text-sm font-semibold tabular-nums">
                            {fmtMoney(m.breakdown[g.key])}
                          </span>
                        </div>

                        {m.payment ? (
                          <>
                            <UpnQr
                              className="mt-2"
                              profile={data.profile}
                              amount={m.breakdown[g.key]}
                              iban={m.payment[g.key].iban}
                              reference={m.payment[g.key].reference}
                              purpose={`Prispevki ${g.label} ${String(m.month).padStart(2, '0')}/${m.year}`}
                              title={g.label}
                            />
                            {/*
                              Scan, pay, tap. The payment records itself against
                              this month and this group, so next month the row
                              already knows it was settled.
                            */}
                            {m.settled.groups[g.key] ? (
                              <p className="mt-1.5 flex items-center gap-1.5 text-2xs font-semibold text-success-fg">
                                <CheckCircleIcon className="size-3" />
                                Plačano
                              </p>
                            ) : (
                              <button
                                className={`${btn.outline} ${btnXs} mt-1.5`}
                                onClick={() => void markPaid(m, g.key, g.label)}
                              >
                                <CheckCircleIcon className="size-3" />
                                Označi kot plačano
                              </button>
                            )}
                          </>
                        ) : (
                          <p className="mt-1 text-2xs leading-normal text-muted-fg">
                            Za plačilo potrebujemo račun in sklic. Potrdite ju enkrat v
                            profilu ali vnesite obračun PODO-OPSVZ — nato se koda izriše
                            tudi za oceno, še preden FURS objavi znesek.
                          </p>
                        )}
                      </div>
                    ))}
                    <button
                      className={`${btn.outline} ${btnSm} mb-2 w-full`}
                      onClick={() => void markMonthPaid(m)}
                    >
                      <CheckCircleIcon className="size-3.5" />
                      Označi cel mesec kot plačan
                    </button>

                    {m.id && (
                      <button
                        className={`${btn.ghost} ${btnXs}`}
                        onClick={() => {
                          void resources.tax
                            .deleteContribution(m.id as string)
                            .then(load)
                            .then(() => toast('Obračun izbrisan'))
                            .catch((err: unknown) => toast(failureMessage(err)));
                        }}
                      >
                        <TrashIcon className="size-3" />
                        Izbriši obračun
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {settledMonths.length > 0 && (
        <section className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-xs desk:p-5">
          <div className={cardLabel}>Plačani prispevki</div>
          {settledMonths.map((m) => (
            <div
              key={m.month}
              className="flex items-center justify-between gap-3 border-t border-border py-2.5 first:border-t-0"
            >
              <span className="flex min-w-0 items-center gap-2">
                <CheckCircleIcon className="size-3.5 shrink-0 text-success-fg" />
                <span className="truncate text-sm">{MONTH_NAMES[m.month - 1]}</span>
                {!m.estimated && <span className={badge.success}>obračun</span>}
              </span>
              <span className="font-mono text-sm tabular-nums text-muted-fg">
                {fmtMoney(m.settled.paid || m.total)}
              </span>
            </div>
          ))}
        </section>
      )}

      {/* ── what was actually sent ────────────────────────────────────────── */}
      <section className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-xs desk:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className={cardLabel + ' mb-0'}>Plačila FURS</div>
          <button
            className={`${btn.outline} ${btnSm}`}
            onClick={() => openSheet({ kind: 'taxPayment', year })}
          >
            <PlusIcon className="size-3.5" />
            Zabeleži plačilo
          </button>
        </div>

        {payments.length === 0 ? (
          <p className="text-xs text-muted-fg">Za to leto ni zabeleženih plačil.</p>
        ) : (
          payments.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 border-t border-border py-2.5 first:border-t-0"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{PAYMENT_KIND[p.kind]}</div>
                <div className="mt-0.5 font-mono text-2xs text-muted-fg">
                  {fmtDMY(p.paidOn)}
                  {p.periodMonth
                    ? ` · za ${String(p.periodMonth).padStart(2, '0')}/${p.periodYear}`
                    : p.periodYear
                      ? ` · za ${p.periodYear}`
                      : ''}
                  {p.note ? ' · ' + p.note : ''}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-mono text-sm font-semibold tabular-nums">
                  {fmtMoney(p.amount)}
                </span>
                <button
                  className={iconBtn}
                  onClick={() => void removePayment(p.id)}
                  aria-label="Izbriši plačilo"
                >
                  <TrashIcon className="size-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      {/* ── and the honest caveat, which does not go away ─────────────────── */}
      <div className="mb-2 flex items-start gap-2.5 rounded-2xl border border-border bg-warning-bg p-4 text-xs leading-normal text-warning-fg">
        <AlertIcon className="mt-0.5 size-4 shrink-0" />
        <span>
          Izračuni so ocena za načrtovanje, narejena iz podatkov, ki ste jih vnesli sami.
          Ne nadomeščajo obračuna pri računovodji ali podatkov FURS. Zneski za
          {summary.figuresFromYear !== year
            ? ` ${year} so izračunani po stopnjah za ${summary.figuresFromYear}.`
            : ' plačilo vedno preverite na obračunu.'}
        </span>
      </div>
    </>
  );
}
