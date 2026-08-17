import { useState } from 'react';
import { fmtDMY, fmtMoney } from '../lib/format';
import type { Trajectory, TrajectoryPoint } from '../lib/types';

/*
 * Revenue through the year, as two lines and the thresholds they are heading
 * for. Plain SVG: a chart library would be a dependency for one picture.
 */

const W = 640;
const H = 220;
const PAD = { top: 12, right: 12, bottom: 22, left: 52 };

const dayNumber = (iso: string) => Math.floor(Date.parse(iso + 'T00:00:00Z') / 86_400_000);

export function TrajectoryChart({ trajectory }: { trajectory: Trajectory }) {
  const [hover, setHover] = useState<{ x: number; point: TrajectoryPoint } | null>(null);

  const x0 = dayNumber(trajectory.yearStart);
  const x1 = dayNumber(trajectory.yearEnd);
  const span = Math.max(1, x1 - x0);

  const everything = [...trajectory.paidSeries, ...trajectory.invoicedSeries];
  const peak = Math.max(
    ...everything.map((p) => p.cumulativeRevenue),
    // A threshold only belongs on the axis once it is within reach; otherwise
    // a quiet year would be drawn as a flat line along the bottom.
    ...trajectory.thresholds
      .filter((t) => t.crossedOn !== null)
      .map((t) => t.amount),
    1000,
  );
  const ceiling = peak * 1.15;

  const px = (iso: string) =>
    PAD.left + ((dayNumber(iso) - x0) / span) * (W - PAD.left - PAD.right);
  const py = (value: number) =>
    H - PAD.bottom - (value / ceiling) * (H - PAD.top - PAD.bottom);

  /** A staircase: revenue holds flat until the day money lands, then steps. */
  const steps = (series: TrajectoryPoint[], from: number) => {
    if (series.length === 0) return '';
    let d = `M ${px(trajectory.yearStart)} ${py(from)}`;
    let last = from;
    for (const p of series) {
      d += ` L ${px(p.date)} ${py(last)} L ${px(p.date)} ${py(p.cumulativeRevenue)}`;
      last = p.cumulativeRevenue;
    }
    d += ` L ${px(trajectory.yearEnd)} ${py(last)}`;
    return d;
  };

  const paidEnd = trajectory.paidSeries.at(-1)?.cumulativeRevenue ?? 0;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-56 w-full min-w-[520px]"
        role="img"
        aria-label={`Prihodki v letu ${trajectory.year}: prejeto ${fmtMoney(paidEnd)}`}
      >
        {/* thresholds first, so the data draws over them */}
        {trajectory.thresholds
          .filter((t) => t.amount <= ceiling)
          .map((t) => (
            <g key={t.amount}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={py(t.amount)}
                y2={py(t.amount)}
                className="stroke-destructive"
                strokeDasharray="4 4"
                strokeWidth={1}
                opacity={0.5}
              />
              <text
                x={W - PAD.right}
                y={py(t.amount) - 4}
                textAnchor="end"
                className="fill-muted-fg font-mono text-[9px]"
              >
                {fmtMoney(t.amount)}
              </text>
            </g>
          ))}

        {/* axes */}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={H - PAD.bottom}
          y2={H - PAD.bottom}
          className="stroke-border"
          strokeWidth={1}
        />
        <text x={PAD.left} y={H - 6} className="fill-muted-fg font-mono text-[9px]">
          {fmtDMY(trajectory.yearStart)}
        </text>
        <text
          x={W - PAD.right}
          y={H - 6}
          textAnchor="end"
          className="fill-muted-fg font-mono text-[9px]"
        >
          {fmtDMY(trajectory.yearEnd)}
        </text>

        {/* where it lands if everyone pays */}
        <path
          d={steps(trajectory.invoicedSeries, paidEnd)}
          fill="none"
          className="stroke-accent"
          strokeWidth={2}
          strokeDasharray="5 4"
        />
        {/* money actually received */}
        <path
          d={steps(trajectory.paidSeries, 0)}
          fill="none"
          className="stroke-secondary"
          strokeWidth={2.5}
        />

        {trajectory.paidSeries.map((p) => (
          <circle
            key={p.date + p.number}
            cx={px(p.date)}
            cy={py(p.cumulativeRevenue)}
            r={4}
            className="cursor-pointer fill-secondary"
            role="button"
            tabIndex={0}
            aria-label={`${p.number}: skupaj ${fmtMoney(p.cumulativeRevenue)}`}
            onMouseEnter={() => setHover({ x: px(p.date), point: p })}
            onMouseLeave={() => setHover(null)}
            // A phone has no hover, so a tap has to do the same thing.
            onClick={() =>
              setHover((h) => (h?.point === p ? null : { x: px(p.date), point: p }))
            }
            onFocus={() => setHover({ x: px(p.date), point: p })}
          />
        ))}

        {hover && (
          <g transform={`translate(${Math.min(hover.x + 8, W - 190)}, ${PAD.top})`}>
            <rect width={182} height={54} rx={8} className="fill-card stroke-border" />
            <text x={10} y={18} className="fill-fg font-mono text-[10px]">
              {fmtDMY(hover.point.date)} · {hover.point.number}
            </text>
            <text x={10} y={32} className="fill-fg text-[10px]">
              Skupaj {fmtMoney(hover.point.cumulativeRevenue)}
            </text>
            <text x={10} y={46} className="fill-muted-fg text-[10px]">
              Dohodnina {fmtMoney(hover.point.taxOwed)}
            </text>
          </g>
        )}
      </svg>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-2xs text-muted-fg">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-secondary" /> Prejeto
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 border-t-2 border-dashed border-accent" /> Izdano, še
          neplačano
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 border-t border-dashed border-destructive" /> Prag
        </span>
      </div>

      {trajectory.thresholds.some((t) => t.crossedOn) && (
        <ul className="mt-2 flex flex-col gap-1">
          {trajectory.thresholds
            .filter((t) => t.crossedOn)
            .map((t) => (
              <li key={t.amount} className="text-2xs text-muted-fg">
                <strong className="text-fg">{fmtMoney(t.amount)}</strong> preseženo{' '}
                {fmtDMY(t.crossedOn as string)} — {t.label}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
