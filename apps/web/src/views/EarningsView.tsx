import { useCallback, useEffect, useState } from 'react';
import { AlertIcon, ClockIcon } from '../components/icons';
import { SectionHead } from '../components/ui';
import { failureMessage } from '../lib/failure';
import { fmtHours, fmtMoney } from '../lib/format';
import { resources } from '../lib/resources';
import type { Earnings } from '../lib/types';
import { useStore } from '../store/context';
import { badge, cardLabel, tabSeg } from '../styles/cx';

/**
 * What an hour is actually worth.
 *
 * The tax tab answers "what do I owe"; this answers "what am I worth" — the
 * number a rate negotiation should start from, and the one the headline hourly
 * rate quietly overstates.
 */
export function EarningsView() {
  const { data } = useStore();
  const [basis, setBasis] = useState<'payment' | 'service'>('payment');
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setEarnings(await resources.earnings.effectiveRate(basis));
      setError('');
    } catch (err) {
      setError(failureMessage(err));
    }
  }, [basis]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (!earnings) {
    return (
      <>
        <SectionHead title="Zaslužek" />
        <p className="text-sm text-muted-fg">{error || 'Računam …'}</p>
      </>
    );
  }

  const nominal = (clientId: string) =>
    data.clients.find((c) => c.id === clientId)?.rate ?? null;

  /**
   * The rate is net earnings divided by hours worked, so without hours there
   * is no rate — only revenue. That is a real state for someone who has been
   * invoicing without logging time, and it deserves an explanation rather
   * than a column of dashes.
   */
  const noHours = earnings.windows.every((w) => w.hours === 0);

  return (
    <>
      <SectionHead title="Zaslužek" meta="po plačilu obveznosti" />

      <div className="mb-4 flex gap-0.5 rounded-lg bg-muted p-1">
        <button
          type="button"
          className={tabSeg(basis === 'payment')}
          onClick={() => setBasis('payment')}
          title="Prihodek šteje na dan prejema"
        >
          Denarni tok
        </button>
        <button
          type="button"
          className={tabSeg(basis === 'service')}
          onClick={() => setBasis('service')}
          title="Prihodek šteje v obdobju opravljenega dela"
        >
          Po opravljenem delu
        </button>
      </div>

      <p className="mb-4 text-xs leading-normal text-muted-fg">
        {basis === 'payment'
          ? 'Prihodek se šteje na dan, ko je denar prišel. Pove, kako teče denar.'
          : 'Prihodek se šteje v obdobju, na katero se račun nanaša. Pove, koliko je delo dejansko vredno — ure iz julija so pogosto plačane septembra.'}
      </p>

      {noHours && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-border bg-info-bg p-4 text-info-fg">
          <ClockIcon className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <strong className="block text-sm">Ni zabeleženih ur</strong>
            <p className="mt-0.5 mb-0 text-xs leading-normal">
              Prihodek in obveznosti so znani, ura pa ne — zaslužek na uro se izračuna iz
              zabeleženih ur, ne iz računov. Zabeležite ure v zavihku Ure, tudi za nazaj,
              in številke se izpišejo same. Spodaj je medtem prikazano, koliko od
              prihodka ostane po plačilu obveznosti.
            </p>
          </div>
        </div>
      )}

      {/* ── the windows, longest first, because short ones lie ─────────────── */}
      <div className="mb-4 flex flex-col gap-2">
        {[...earnings.windows].reverse().map((w) => (
          <div
            className="rounded-2xl border border-border bg-card p-4 shadow-xs"
            key={w.key}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex items-center gap-2">
                <span className="text-sm font-semibold">{w.label}</span>
                {w.thin && (
                  <span className={badge.warning} title="Malo ur v tem obdobju">
                    malo ur
                  </span>
                )}
              </span>
              {w.effectiveRate === null ? (
                <span className="text-right">
                  <span className="block font-mono text-xl font-bold tabular-nums">
                    {fmtMoney(w.net)}
                  </span>
                  <span className="block text-2xs text-muted-fg">
                    ostane · brez ur
                  </span>
                </span>
              ) : (
                <span className="font-mono text-xl font-bold tabular-nums">
                  {fmtMoney(w.effectiveRate)}/h
                </span>
              )}
            </div>

            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-2xs min-[520px]:grid-cols-4">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-fg">Prejeto</dt>
                <dd className="font-mono">{fmtMoney(w.gross)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-fg">Prispevki</dt>
                <dd className="font-mono">−{fmtMoney(w.contributions)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-fg">Dohodnina</dt>
                <dd className="font-mono">−{fmtMoney(w.dohodnina)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-fg">Ure</dt>
                <dd className="font-mono">{fmtHours(w.hours)}</dd>
              </div>
            </dl>

            {w.net < 0 && (
              <p className="mt-2 flex items-start gap-1.5 text-2xs leading-normal text-warning-fg">
                <AlertIcon className="mt-px size-3 shrink-0" />
                Prispevki v tem obdobju presegajo prejeti prihodek — plačajo se po
                koledarju, ne glede na delo.
              </p>
            )}
          </div>
        ))}
      </div>

      {/* ── which client is actually worth the time ────────────────────────── */}
      <section className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-xs desk:p-5">
        <div className={cardLabel}>Po strankah, letos</div>

        {earnings.clients.length === 0 ? (
          <p className="text-xs text-muted-fg">
            Ko bo prvi račun plačan, se tu pokaže, koliko posamezna stranka dejansko
            prinese na uro.
          </p>
        ) : (
          earnings.clients.map((c) => {
            const rate = nominal(c.clientId);
            return (
              <div
                key={c.clientId}
                className="flex items-center justify-between gap-3 border-t border-border py-2.5 first:border-t-0"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{c.name}</div>
                  <div className="mt-0.5 flex items-center gap-1 font-mono text-2xs text-muted-fg">
                    <ClockIcon className="size-3" />
                    {c.hours > 0 ? `${fmtHours(c.hours)} · ` : 'brez ur · '}
                    {fmtMoney(c.gross)}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-sm font-semibold tabular-nums">
                    {c.effectiveRate === null
                      ? fmtMoney(c.gross)
                      : `${fmtMoney(c.effectiveRate)}/h`}
                  </div>
                  {/*
                    The nominal rate is struck through to say "this is not what
                    you got". With no hours there is nothing to compare it to,
                    so it is shown plainly instead of crossed out.
                  */}
                  {rate !== null && (
                    <div
                      className={
                        'font-mono text-2xs text-muted-fg ' +
                        (c.effectiveRate === null ? '' : 'line-through')
                      }
                    >
                      {fmtMoney(rate)}/h
                      {c.effectiveRate === null ? ' dogovorjeno' : ''}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </section>
    </>
  );
}
