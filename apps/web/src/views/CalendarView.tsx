import { useMemo, useRef, useState } from 'react';
import {
  MONTH_NAMES,
  WEEKDAY_NAMES,
  addDaysIso,
  clientColor,
  fmtHours,
  fmtHoursCompact,
  fmtMoney,
  hoursBetween,
  isoOf,
  todayIso,
} from '../lib/format';
import type { OpenSheet } from '../lib/sheets';
import {
  BillingIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClientsIcon,
} from '../components/icons';
import { invoiceStatusComputed, sessionBillingLabel } from '../lib/invoice';
import type { InvoiceStatus } from '../lib/types';

/** One invoice, as a day inside its period needs to know it. */
interface InvoiceBand {
  id: string;
  number: string;
  client: string;
  total: number;
  status: InvoiceStatus;
}

/** The same three colours the invoice list uses for a status. */
const INVOICE_BAND: Record<InvoiceStatus, string> = {
  paid: 'bg-secondary',
  unpaid: 'bg-accent',
  overdue: 'bg-destructive',
};

/** The billing cycle, in order, with the colour each stage owns app-wide. */
const BILLING_LEGEND = [
  { key: 'unbilled', label: 'Neobračunano', swatch: 'bg-accent' },
  { key: 'invoiced', label: 'Zaračunano', swatch: 'bg-primary' },
  { key: 'paid', label: 'Plačano', swatch: 'bg-secondary' },
] as const;
import { useStore } from '../store/context';
import { btn, btnXs, chip, emptyInline, iconBtn, tabSeg } from '../styles/cx';

export function CalendarView({ openSheet }: { openSheet: OpenSheet }) {
  const { data } = useStore();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [hidden, setHidden] = useState<string[]>([]);
  const [focusDay, setFocusDay] = useState(1);
  const [colorBy, setColorBy] = useState<'client' | 'status'>('status');
  const cellRefs = useRef(new Map<number, HTMLButtonElement>());

  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayIso();
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const isCurrentMonth = month === now.getMonth() && year === now.getFullYear();

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setMonth(d.getMonth());
    setYear(d.getFullYear());
    setFocusDay(1);
  };

  const jumpToToday = () => {
    setMonth(now.getMonth());
    setYear(now.getFullYear());
    setFocusDay(now.getDate());
  };

  const toggleClient = (id: string) =>
    setHidden((h) => (h.includes(id) ? h.filter((x) => x !== id) : [...h, id]));

  /**
   * The invoice periods that fall inside the visible month.
   *
   * An invoice says which stretch of work it covers, and that stretch is worth
   * seeing on the calendar — especially for an invoice with no hours behind it,
   * where the days would otherwise look untouched.
   */
  const invoiceDays = useMemo(() => {
    const map = new Map<string, InvoiceBand[]>();
    const monthStart = `${monthPrefix}-01`;
    const monthEnd = `${monthPrefix}-31`;

    data.invoices.forEach((inv) => {
      if (hidden.includes(inv.clientId)) return;
      if (inv.periodEnd < monthStart || inv.periodStart > monthEnd) return;

      const band: InvoiceBand = {
        id: inv.id,
        number: inv.number,
        total: inv.total,
        status: invoiceStatusComputed(inv),
        client:
          inv.clientName ??
          data.clients.find((c) => c.id === inv.clientId)?.name ??
          'Brez stranke',
      };

      let day = inv.periodStart < monthStart ? monthStart : inv.periodStart;
      // Guarded by the month prefix rather than by counting: periods can be
      // long, and only this month's days are drawn.
      while (day <= inv.periodEnd && day.startsWith(monthPrefix)) {
        map.set(day, [...(map.get(day) ?? []), band]);
        day = addDaysIso(day, 1);
      }
    });
    return map;
  }, [data.invoices, data.clients, hidden, monthPrefix]);

  // Per-day totals for the visible month, honouring the client filter.
  const { days, monthHours, monthUnbilled, daysWorked, peakHours } = useMemo(() => {
    const map = new Map<string, DayStat>();
    data.sessions.forEach((s) => {
      if (!s.date.startsWith(monthPrefix)) return;
      if (hidden.includes(s.clientId)) return;
      const h = hoursBetween(s.start, s.end);
      const stat = map.get(s.date) ?? {
        hours: 0,
        unbilled: 0,
        invoiced: 0,
        paid: 0,
        entries: 0,
        segments: [] as { clientId: string; hours: number }[],
        list: [] as EntryLine[],
      };
      stat.hours += h;
      stat.entries += 1;
      const billing = sessionBillingLabel(s, data.invoices) ?? 'unbilled';
      if (billing === 'paid') stat.paid += h;
      else if (billing === 'invoiced') stat.invoiced += h;
      else stat.unbilled += h;
      stat.list.push({
        id: s.id,
        start: s.start,
        end: s.end,
        note: s.note,
        hours: h,
        client: data.clients.find((c) => c.id === s.clientId)?.name ?? 'Brez stranke',
        billing,
      });
      const seg = stat.segments.find((x) => x.clientId === s.clientId);
      if (seg) seg.hours += h;
      else stat.segments.push({ clientId: s.clientId, hours: h });
      map.set(s.date, stat);
    });
    map.forEach((stat) => stat.list.sort((a, b) => a.start.localeCompare(b.start)));
    const totals = [...map.values()];
    return {
      days: map,
      monthHours: totals.reduce((sum, d) => sum + d.hours, 0),
      monthUnbilled: totals.reduce((sum, d) => sum + d.unbilled, 0),
      daysWorked: totals.length,
      // A full 8h day fills the bar; longer days set their own ceiling.
      peakHours: Math.max(8, ...totals.map((d) => d.hours)),
    };
  }, [data.sessions, data.invoices, data.clients, hidden, monthPrefix]);

  const datesWithEntries = useMemo(
    () => new Set(data.sessions.map((s) => s.date)),
    [data.sessions],
  );

  const focusCell = (day: number) => {
    const clamped = Math.min(Math.max(day, 1), daysInMonth);
    setFocusDay(clamped);
    cellRefs.current.get(clamped)?.focus();
  };

  const onGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (e.key in moves) {
      e.preventDefault();
      focusCell(focusDay + (moves[e.key] as number));
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusCell(1);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusCell(daysInMonth);
    }
  };

  const weeks: (number | null)[][] = [];
  const cells: (number | null)[] = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  if (data.clients.length === 0) {
    return <div className={emptyInline}>Za prikaz koledarja dodajte stranko.</div>;
  }

  return (
    <>
      <div className="mb-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {data.clients.map((c) => {
          const active = !hidden.includes(c.id);
          return (
            <button
              key={c.id}
              className={chip(false) + (active ? '' : ' opacity-50')}
              onClick={() => toggleClient(c.id)}
              aria-pressed={active}
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: clientColor(c.id) }}
              />
              {c.name}
            </button>
          );
        })}
      </div>

      <div className="mb-2 flex items-center justify-between gap-2">
        <button className={iconBtn} onClick={() => shiftMonth(-1)} aria-label="Prejšnji mesec">
          <ChevronLeftIcon />
        </button>
        <div className="flex min-w-0 items-center gap-2.5">
          <h2 className="whitespace-nowrap text-base font-semibold" aria-live="polite">
            {MONTH_NAMES[month]} {year}
          </h2>
          {!isCurrentMonth && (
            <button className={`${btn.outline} ${btnXs}`} onClick={jumpToToday}>
              Danes
            </button>
          )}
        </div>
        <button className={iconBtn} onClick={() => shiftMonth(1)} aria-label="Naslednji mesec">
          <ChevronRightIcon />
        </button>
      </div>

      <div className="mb-3 flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-fg">
        <div className="flex gap-5">
          <div>
            <span className="font-mono text-sm font-bold text-fg">{fmtHours(monthHours)}</span>{' '}
            ta mesec
          </div>
          <div>
            <span className="font-mono text-sm font-bold text-fg">{fmtHours(monthUnbilled)}</span>{' '}
            neobračunano
          </div>
        </div>
        <div>
          {daysWorked} {daysWorked === 1 ? 'dan' : 'dni'}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex shrink-0 gap-0.5 rounded-lg bg-muted p-1">
          <button className={tabSeg(colorBy === 'status')} onClick={() => setColorBy('status')}>
            <BillingIcon className="size-3.5" />
            Po statusu
          </button>
          <button className={tabSeg(colorBy === 'client')} onClick={() => setColorBy('client')}>
            <ClientsIcon className="size-3.5" />
            Po stranki
          </button>
        </div>

        {colorBy === 'status' && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted-fg">
            {BILLING_LEGEND.map((l) => (
              <span key={l.label} className="inline-flex items-center gap-1.5">
                <span className={`size-2.5 rounded-full ${l.swatch}`} />
                {l.label}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mb-1 grid grid-cols-7 gap-0.5 desk:gap-1.5" aria-hidden="true">
        {WEEKDAY_NAMES.map((w, i) => (
          <span
            key={w}
            className={
              'text-center font-mono text-2xs uppercase tracking-wider text-muted-fg' +
              (i > 4 ? ' opacity-50' : '')
            }
          >
            {w}
          </span>
        ))}
      </div>

      <div
        className="grid grid-cols-7 gap-0.5 desk:gap-1.5"
        role="grid"
        aria-label={`${MONTH_NAMES[month]} ${year}`}
        onKeyDown={onGridKeyDown}
      >
        {weeks.map((week, wi) => (
          <div className="contents" role="row" key={wi}>
            {week.map((day, di) => {
              if (day === null) {
                return (
                  <div
                    className="invisible min-h-16 desk:h-28"
                    role="gridcell"
                    key={`b${wi}-${di}`}
                  />
                );
              }
              const iso = isoOf(new Date(year, month, day));
              const stat = days.get(iso);
              const billed = invoiceDays.get(iso);
              const hasEntries = datesWithEntries.has(iso);
              const label = new Date(year, month, day).toLocaleDateString('sl-SI', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              });
              return (
                <button
                  key={iso}
                  role="gridcell"
                  ref={(el) => {
                    if (el) cellRefs.current.set(day, el);
                    else cellRefs.current.delete(day);
                  }}
                  tabIndex={day === Math.min(focusDay, daysInMonth) ? 0 : -1}
                  className={
                    'group relative flex min-h-16 cursor-pointer flex-col gap-1 rounded-md border p-1 text-left transition-all duration-100 hover:border-primary hover:bg-primary/12 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/15 desk:h-28 desk:p-2 ' +
                    (stat || billed
                      ? 'border-border bg-card shadow-xs'
                      : 'border-transparent bg-muted') +
                    (iso === today ? ' border-2 border-primary' : '')
                  }
                  aria-label={
                    stat
                      ? `${label} — ${fmtHours(stat.hours)} v ${stat.entries} ${
                          stat.entries === 1 ? 'vnosu' : 'vnosih'
                        }${BILLING_LEGEND.filter((l) => stat[l.key] > 0)
                          .map((l) => `, ${fmtHours(stat[l.key])} ${l.label.toLowerCase()}`)
                          .join('')}`
                      : billed
                        ? `${label} — na računu ${billed.map((b) => b.number).join(', ')}`
                        : `${label} — ni zabeleženih ur, dodajte vnos`
                  }
                  onClick={() =>
                    hasEntries
                      ? openSheet({ kind: 'dayDetail', date: iso })
                      : openSheet({ kind: 'entry', prefill: { date: iso } })
                  }
                >
                  <span className="flex items-baseline justify-between gap-1">
                    <span
                      className={
                        'font-mono text-xs leading-none ' +
                        (iso === today
                          ? 'font-bold text-primary'
                          : stat
                            ? 'font-bold text-fg'
                            : 'text-muted-fg')
                      }
                    >
                      {day}
                    </span>
                    {stat && (
                      <span
                        className={
                          'font-mono text-2xs font-semibold leading-none ' +
                          (stat.unbilled > 0
                            ? 'text-warning-fg'
                            : stat.invoiced > 0
                              ? 'text-primary'
                              : 'text-secondary')
                        }
                      >
                        {fmtHoursCompact(stat.hours)}
                      </span>
                    )}
                  </span>
                  {/* Entry chips — desktop only; the phone cell is too small. */}
                  {stat && (
                    <span className="hidden min-h-0 flex-1 flex-col gap-0.5 overflow-hidden desk:flex">
                      {stat.list.slice(0, MAX_CHIPS).map((e) => (
                        <span
                          key={e.id}
                          className="flex items-center gap-1 truncate text-2xs leading-tight text-muted-fg"
                        >
                          <span
                            className={`size-1.5 shrink-0 rounded-full ${swatchFor(e.billing)}`}
                          />
                          <span className="truncate">{e.client}</span>
                        </span>
                      ))}
                      {stat.list.length > MAX_CHIPS && (
                        <span className="text-2xs font-semibold leading-tight text-muted-fg">
                          +{stat.list.length - MAX_CHIPS} več
                        </span>
                      )}
                    </span>
                  )}

                  {stat && (
                    <span
                      className="mt-auto block h-1 shrink-0 overflow-hidden rounded-sm bg-muted desk:h-1.5"
                      aria-hidden="true"
                    >
                      <span
                        className="flex h-full gap-px overflow-hidden rounded-sm"
                        style={{ width: `${Math.min(100, (stat.hours / peakHours) * 100)}%` }}
                      >
                        {colorBy === 'client'
                          ? stat.segments.map((seg) => (
                              <span
                                key={seg.clientId}
                                className="block h-full"
                                style={{ flex: seg.hours, background: clientColor(seg.clientId) }}
                              />
                            ))
                          : BILLING_LEGEND.filter((l) => stat[l.key] > 0).map((l) => (
                              <span
                                key={l.key}
                                className={`block h-full ${l.swatch}`}
                                style={{ flex: stat[l.key] }}
                              />
                            ))}
                      </span>
                    </span>
                  )}

                  {/* The stretch an invoice covers, drawn along the foot of the
                      day it covers. */}
                  {billed && (
                    <span
                      className={
                        'block h-1 shrink-0 rounded-sm ' +
                        (stat ? 'mt-0.5' : 'mt-auto') +
                        ' ' +
                        INVOICE_BAND[billed[0]!.status]
                      }
                      aria-hidden="true"
                    />
                  )}

                  {/* Hover/focus card. Anchored away from the edge columns so it
                      can't run off the grid. */}
                  {(stat || billed) && (
                    <span
                      className={
                        'pointer-events-none invisible absolute top-full z-50 mt-1 hidden w-64 flex-col gap-2 rounded-2xl border border-border bg-card p-3 opacity-0 shadow-lg transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100 desk:flex ' +
                        (di <= 1 ? 'left-0' : di >= 5 ? 'right-0' : 'left-1/2 -translate-x-1/2')
                      }
                      role="presentation"
                    >
                      <span className="flex items-baseline justify-between gap-2 border-b border-border pb-2">
                        <span className="text-sm font-semibold">{label}</span>
                        {stat && (
                          <span className="font-mono text-xs text-muted-fg">
                            {fmtHours(stat.hours)}
                          </span>
                        )}
                      </span>

                      {/* Which invoice this day is covered by, if any. */}
                      {billed?.map((b) => (
                        <span
                          key={b.id}
                          className="flex items-baseline justify-between gap-2 text-xs"
                        >
                          <span className="flex min-w-0 items-baseline gap-1.5">
                            <span
                              className={`size-2 shrink-0 rounded-full ${INVOICE_BAND[b.status]}`}
                            />
                            <span className="truncate font-medium">Račun {b.number}</span>
                          </span>
                          <span className="whitespace-nowrap font-mono text-2xs text-muted-fg">
                            {fmtMoney(b.total)}
                          </span>
                        </span>
                      ))}

                      <span className="flex max-h-52 flex-col gap-1.5 overflow-y-auto">
                        {stat?.list.map((e) => (
                          <span key={e.id} className="flex items-start gap-2 text-xs">
                            <span
                              className={`mt-1 size-2 shrink-0 rounded-full ${swatchFor(e.billing)}`}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{e.client}</span>
                              {e.note && (
                                <span className="block truncate text-muted-fg">{e.note}</span>
                              )}
                            </span>
                            <span className="whitespace-nowrap font-mono text-2xs text-muted-fg">
                              {e.start}–{e.end}
                            </span>
                          </span>
                        ))}
                      </span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}

interface EntryLine {
  id: string;
  start: string;
  end: string;
  note: string;
  hours: number;
  client: string;
  billing: 'unbilled' | 'invoiced' | 'paid';
}

interface DayStat {
  hours: number;
  /** Hours split by where they are in the billing cycle. */
  unbilled: number;
  invoiced: number;
  paid: number;
  entries: number;
  segments: { clientId: string; hours: number }[];
  list: EntryLine[];
}

/** How many entry chips fit in a cell before it collapses to "+n more". */
const MAX_CHIPS = 3;

const swatchFor = (billing: EntryLine['billing']) =>
  BILLING_LEGEND.find((l) => l.key === billing)?.swatch ?? 'bg-muted';
