import { useState } from 'react';
import {
  keepFromRate,
  passthroughOutcome,
  type NormiranecKind,
} from '@reckon/shared';
import { AlertIcon } from './icons';
import { ThresholdBar } from './ThresholdBar';
import { Field } from './ui';
import { fmtMoney } from '../lib/format';
import { toCents } from '../lib/money';
import type { YearPosition } from '../lib/yearPosition';
import { cardLabel, hint, input, row2 } from '../styles/cx';

/**
 * The cut, and what it is actually worth.
 *
 * The whole invoice is taxed here — a normiranec deducts nothing, so the cash
 * handed over is invisible to the tax system — which is why a tenth of the
 * invoice is not a tenth in the pocket. Shown while the number is being agreed
 * rather than discovered in March.
 */
export function PassthroughFields({
  totalEuros,
  value,
  onChange,
  year,
  kind,
  position,
}: {
  totalEuros: number;
  value: { forWhom: string; keep: number } | null;
  onChange: (next: { forWhom: string; keep: number } | null) => void;
  year: number;
  kind: NormiranecKind;
  position: YearPosition;
}) {
  const [projectionOverride, setProjectionOverride] = useState<string>('');
  const [ratePercent, setRatePercent] = useState('10');

  const on = value !== null;
  const totalCents = toCents(totalEuros);
  const projectedCents =
    projectionOverride === ''
      ? position.projectedCents
      : toCents(parseFloat(projectionOverride) || 0);

  const outcome = passthroughOutcome({
    totalCents,
    keepCents: toCents(value?.keep ?? 0),
    // The favour sits on top of the year, so it is measured against the year
    // without it.
    yearBaseCents: projectedCents,
    kind,
    year,
  });

  const setRate = (percent: string) => {
    setRatePercent(percent);
    const rate = (parseFloat(percent) || 0) / 100;
    onChange({ forWhom: value?.forWhom ?? '', keep: keepFromRate(totalCents, rate) / 100 });
  };

  const setKeep = (euros: string) => {
    const keep = parseFloat(euros) || 0;
    onChange({ forWhom: value?.forWhom ?? '', keep });
    if (totalCents > 0) setRatePercent(((keep / totalEuros) * 100).toFixed(1));
  };

  return (
    <div className="mb-4 rounded-2xl border border-border bg-bg p-3">
      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={on}
          onChange={(e) =>
            onChange(e.target.checked ? { forWhom: '', keep: keepFromRate(totalCents, 0.1) / 100 } : null)
          }
        />
        <span>
          <span className="block text-sm font-medium">Račun za nekoga drugega</span>
          <span className={hint}>
            Delo je opravil nekdo drug, ti pa zadržiš dogovorjeni delež.
          </span>
        </span>
      </label>

      {on && (
        <div className="mt-3">
          <div className={row2}>
            <Field label="Za koga" htmlFor="ptFor">
              <input
                id="ptFor"
                className={input}
                type="text"
                placeholder="npr. Miha"
                value={value.forWhom}
                onChange={(e) => onChange({ ...value, forWhom: e.target.value })}
              />
            </Field>
            <Field label="Tvoj delež (%)" htmlFor="ptRate">
              <input
                id="ptRate"
                className={input}
                type="number"
                min="0"
                max="100"
                step="0.5"
                inputMode="decimal"
                value={ratePercent}
                onChange={(e) => setRate(e.target.value)}
              />
            </Field>
          </div>

          <Field
            label="Zadržiš (€)"
            htmlFor="ptKeep"
            hint="Če ste se dogovorili za okrogel znesek, ga vpiši sem."
          >
            <input
              id="ptKeep"
              className={input}
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={value.keep}
              onChange={(e) => setKeep(e.target.value)}
            />
          </Field>

          {/* What the cut is really worth, at this year's margin. */}
          <dl className="rounded-lg border border-border bg-card p-3 text-xs">
            <div className="flex justify-between gap-2">
              <dt>Zadržiš</dt>
              <dd className="font-mono">{fmtMoney(outcome.keepCents / 100)}</dd>
            </div>
            <div className="mt-1 flex justify-between gap-2">
              <dt className="text-muted-fg">Izplačaš v gotovini</dt>
              <dd className="font-mono text-muted-fg">
                {fmtMoney(outcome.handOverCents / 100)}
              </dd>
            </div>
            <div className="mt-1 flex justify-between gap-2">
              <dt className="text-muted-fg">Dohodnina na celoten znesek</dt>
              <dd className="font-mono text-muted-fg">
                −{fmtMoney(outcome.taxCents / 100)}
              </dd>
            </div>
            <div className="mt-2 flex justify-between gap-2 border-t border-border pt-2">
              <dt className="font-semibold">Ostane ti</dt>
              <dd
                className={
                  'font-mono font-bold ' + (outcome.losesMoney ? 'text-error-fg' : '')
                }
              >
                {fmtMoney(outcome.netCents / 100)}
                <span className="ml-1.5 font-normal text-muted-fg">
                  {(outcome.netRate * 100).toFixed(1)} %
                </span>
              </dd>
            </div>
          </dl>

          {outcome.losesMoney && (
            <p className="mt-2 flex items-start gap-2 rounded-lg border border-border bg-error-bg p-2.5 text-2xs leading-normal text-error-fg">
              <AlertIcon className="mt-px size-3.5 shrink-0" />
              <span>
                Pri tem deležu te usluga stane{' '}
                <strong>{fmtMoney(Math.abs(outcome.netCents) / 100)}</strong>. Da ne bi
                bil na minusu, mora biti delež vsaj{' '}
                <strong>{(outcome.breakEvenRate * 100).toFixed(1)} %</strong>.
              </span>
            </p>
          )}

          {/* Where the year is heading — the thing the rate depends on. */}
          <div className="mt-2 text-2xs leading-normal text-muted-fg">
            <span className={cardLabel + ' mb-1 mt-2 block'}>Projekcija leta</span>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <input
                className="w-32 rounded-md border border-input-border bg-card px-2 py-1 font-mono text-2xs"
                type="number"
                min="0"
                step="100"
                inputMode="decimal"
                value={projectionOverride === '' ? projectedCents / 100 : projectionOverride}
                onChange={(e) => setProjectionOverride(e.target.value)}
                aria-label="Projekcija letnega prihodka"
              />
              <span>
                € · prag za ničlo{' '}
                <strong className="text-fg">
                  {(outcome.breakEvenRate * 100).toFixed(1)} %
                </strong>
              </span>
            </div>
            <p className="mt-1">
              {position.workingLine}. Spremeni številko, da vidiš, kakšen delež
              potrebuješ pri boljšem letu.
            </p>

            {/* Where this invoice lands against the 60.000 € line. */}
            <ThresholdBar
              receivedCents={position.receivedCents}
              outstandingCents={position.outstandingCents}
              forecastCents={Math.max(
                0,
                projectedCents - position.receivedCents - position.outstandingCents,
              )}
              invoiceCents={totalCents}
            />
          </div>

          {projectedCents + totalCents > 6_000_000 &&
            projectedCents <= 6_000_000 && (
              <p className="mt-2 flex items-start gap-2 rounded-lg border border-border bg-warning-bg p-2.5 text-2xs leading-normal text-warning-fg">
                <AlertIcon className="mt-px size-3.5 shrink-0" />
                <span>
                  S tem računom gre leto čez <strong>60.000 €</strong> — konec priznanih
                  normiranih odhodkov in prag za vstop v sistem DDV. Od tam naprej je
                  vsak evro obdavčen po 20 % namesto 4 %.
                </span>
              </p>
            )}

          <p className="mt-2 mb-0 text-2xs leading-normal text-muted-fg">
            Celoten znesek računa šteje kot tvoj prihodek — gotovina, ki jo izplačaš,
            ni odbitna postavka.
          </p>
        </div>
      )}
    </div>
  );
}
