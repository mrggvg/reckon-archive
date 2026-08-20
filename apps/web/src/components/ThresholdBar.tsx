import { fmtMoney } from '../lib/format';

/*
 * The year on one axis, with this invoice on the end of it.
 *
 * The reason a favour's cost jumps is not gradual — it is a line at 60.000 €
 * where flat-rate expenses stop being recognised and VAT registration begins.
 * A number cannot show how close that line is; a bar can.
 */

const VAT_LINE_CENTS = 6_000_000;

export function ThresholdBar({
  receivedCents,
  outstandingCents,
  forecastCents,
  invoiceCents,
}: {
  receivedCents: number;
  outstandingCents: number;
  /** The part of the projection that is neither received nor invoiced yet. */
  forecastCents: number;
  /** The invoice being written, stacked on top of everything else. */
  invoiceCents: number;
}) {
  const total = receivedCents + outstandingCents + forecastCents + invoiceCents;
  // Always show the line, even in a quiet year, so the distance is legible.
  const scale = Math.max(VAT_LINE_CENTS * 1.1, total * 1.05);
  const width = (cents: number) => `${Math.max(0, (cents / scale) * 100)}%`;
  const crosses = total > VAT_LINE_CENTS;

  const segments = [
    { key: 'received', cents: receivedCents, className: 'bg-secondary', label: 'prejeto' },
    { key: 'outstanding', cents: outstandingCents, className: 'bg-accent', label: 'izdano' },
    {
      key: 'forecast',
      cents: forecastCents,
      className: 'bg-primary/30',
      label: 'napoved',
    },
    { key: 'invoice', cents: invoiceCents, className: 'bg-primary', label: 'ta račun' },
  ].filter((s) => s.cents > 0);

  return (
    <div className="mt-2">
      <div
        className="relative h-3 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`Leto skupaj ${fmtMoney(total / 100)} od praga ${fmtMoney(
          VAT_LINE_CENTS / 100,
        )}`}
      >
        <div className="flex h-full">
          {segments.map((s) => (
            <span key={s.key} className={s.className} style={{ width: width(s.cents) }} />
          ))}
        </div>

        {/* the 60.000 line itself */}
        <span
          className="absolute inset-y-0 w-0.5 bg-destructive"
          style={{ left: width(VAT_LINE_CENTS) }}
          aria-hidden="true"
        />
      </div>

      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-2xs text-muted-fg">
        <span className="flex flex-wrap gap-x-2 gap-y-0.5">
          {segments.map((s) => (
            <span key={s.key} className="flex items-center gap-1">
              <span className={`size-1.5 rounded-full ${s.className}`} />
              {s.label} {fmtMoney(s.cents / 100)}
            </span>
          ))}
        </span>
        <span className={crosses ? 'font-semibold text-warning-fg' : ''}>
          {crosses ? 'čez ' : 'do '}
          {fmtMoney(Math.abs(VAT_LINE_CENTS - total) / 100)}
          {crosses ? '' : ' do praga'}
        </span>
      </div>
    </div>
  );
}
