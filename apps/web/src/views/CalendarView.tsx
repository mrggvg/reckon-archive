import { useMemo, useRef, useState } from 'react';
import {
  MONTH_NAMES,
  clientColor,
  fmtHours,
  fmtHoursCompact,
  hoursBetween,
  isoOf,
  todayIso,
} from '../lib/format';
import type { OpenSheet } from '../lib/sheets';
import { useStore } from '../store/context';

export function CalendarView({ openSheet }: { openSheet: OpenSheet }) {
  const { data } = useStore();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [hidden, setHidden] = useState<string[]>([]);
  const [focusDay, setFocusDay] = useState(1);
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
        entries: 0,
        segments: [] as { clientId: string; hours: number }[],
      };
      stat.hours += h;
      stat.entries += 1;
      if (!s.invoiced) stat.unbilled += h;
      const seg = stat.segments.find((x) => x.clientId === s.clientId);
      if (seg) seg.hours += h;
      else stat.segments.push({ clientId: s.clientId, hours: h });
      map.set(s.date, stat);
    });
    const totals = [...map.values()];
    return {
      days: map,
      monthHours: totals.reduce((sum, d) => sum + d.hours, 0),
      monthUnbilled: totals.reduce((sum, d) => sum + d.unbilled, 0),
      daysWorked: totals.length,
      // A full 8h day fills the bar; longer days set their own ceiling.
      peakHours: Math.max(8, ...totals.map((d) => d.hours)),
    };
  }, [data.sessions, hidden, monthPrefix]);

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
    return <div className="empty-inline">Add a client to see the calendar.</div>;
  }

  return (
    <>
      <div className="chips">
        {data.clients.map((c) => {
          const active = !hidden.includes(c.id);
          return (
            <button
              key={c.id}
              className={'chip' + (active ? '' : ' dimmed')}
              style={{ ['--dot' as string]: clientColor(c.id) }}
              onClick={() => toggleClient(c.id)}
              aria-pressed={active}
            >
              <span className="dot" />
              {c.name}
            </button>
          );
        })}
      </div>

      <div className="cal-nav">
        <button className="icon-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">
          ‹
        </button>
        <div className="cal-nav-center">
          <h2 className="cal-month-label" aria-live="polite">
            {MONTH_NAMES[month]} {year}
          </h2>
          {!isCurrentMonth && (
            <button className="btn btn-outline btn-xs" onClick={jumpToToday}>
              Today
            </button>
          )}
        </div>
        <button className="icon-btn" onClick={() => shiftMonth(1)} aria-label="Next month">
          ›
        </button>
      </div>

      <div className="summary-bar">
        <div className="split">
          <div>
            <span className="n">{fmtHours(monthHours)}</span> this month
          </div>
          <div>
            <span className="n">{fmtHours(monthUnbilled)}</span> unbilled
          </div>
        </div>
        <div>
          {daysWorked} {daysWorked === 1 ? 'day' : 'days'}
        </div>
      </div>

      <div className="cal-weekdays" aria-hidden="true">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((w, i) => (
          <span key={w} className={i > 4 ? 'weekend' : undefined}>
            {w}
          </span>
        ))}
      </div>

      <div
        className="cal-days"
        role="grid"
        aria-label={`${MONTH_NAMES[month]} ${year}`}
        onKeyDown={onGridKeyDown}
      >
        {weeks.map((week, wi) => (
          <div className="cal-week" role="row" key={wi}>
            {week.map((day, di) => {
              if (day === null) {
                return <div className="cal-cell blank" role="gridcell" key={`b${wi}-${di}`} />;
              }
              const iso = isoOf(new Date(year, month, day));
              const stat = days.get(iso);
              const hasEntries = datesWithEntries.has(iso);
              const label = new Date(year, month, day).toLocaleDateString('en-GB', {
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
                    'cal-cell' +
                    (iso === today ? ' today' : '') +
                    (stat ? ' has-entries' : '')
                  }
                  aria-label={
                    stat
                      ? `${label} — ${fmtHours(stat.hours)} across ${stat.entries} ${
                          stat.entries === 1 ? 'entry' : 'entries'
                        }${stat.unbilled > 0 ? `, ${fmtHours(stat.unbilled)} unbilled` : ''}`
                      : `${label} — no hours logged, add an entry`
                  }
                  onClick={() =>
                    hasEntries
                      ? openSheet({ kind: 'dayDetail', date: iso })
                      : openSheet({ kind: 'entry', prefill: { date: iso } })
                  }
                >
                  <span className="cal-cell-top">
                    <span className="cal-daynum">{day}</span>
                    {stat && (
                      <span
                        className={'cal-hours' + (stat.unbilled > 0 ? ' unbilled' : '')}
                      >
                        {fmtHoursCompact(stat.hours)}
                      </span>
                    )}
                  </span>
                  {stat && (
                    <span className="cal-load" aria-hidden="true">
                      <span
                        className="cal-load-fill"
                        style={{ width: `${Math.min(100, (stat.hours / peakHours) * 100)}%` }}
                      >
                        {stat.segments.map((seg) => (
                          <span
                            key={seg.clientId}
                            style={{ flex: seg.hours, background: clientColor(seg.clientId) }}
                          />
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

interface DayStat {
  hours: number;
  unbilled: number;
  entries: number;
  segments: { clientId: string; hours: number }[];
}
