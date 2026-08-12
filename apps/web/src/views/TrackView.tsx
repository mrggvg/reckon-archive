import { useMemo, useState } from 'react';
import { EmptyState, SectionHead } from '../components/ui';
import {
  clientColor,
  fmtDateLabel,
  fmtHours,
  hoursBetween,
  todayIso,
} from '../lib/format';
import type { OpenSheet } from '../lib/sheets';
import { sessionBillingLabel } from '../lib/invoice';
import { uid } from '../lib/storage';
import type { Session } from '../lib/types';
import { useStore } from '../store/context';
import { CalendarView } from './CalendarView';

export function TrackView({ openSheet }: { openSheet: OpenSheet }) {
  const { data, update, toast } = useStore();
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [filter, setFilter] = useState<string>('all');

  const clientName = (id: string) =>
    data.clients.find((c) => c.id === id)?.name ?? 'Unassigned';

  // The filtered-on client may have been deleted since — fall back to All.
  const activeFilter =
    filter !== 'all' && !data.clients.some((c) => c.id === filter) ? 'all' : filter;

  const visible = useMemo(
    () =>
      activeFilter === 'all'
        ? data.sessions
        : data.sessions.filter((s) => s.clientId === activeFilter),
    [data.sessions, activeFilter],
  );

  const totalHours = visible.reduce((sum, s) => sum + hoursBetween(s.start, s.end), 0);
  const unbilledHours = visible
    .filter((s) => !s.invoiced)
    .reduce((sum, s) => sum + hoursBetween(s.start, s.end), 0);

  const byDate = useMemo(() => {
    const map = new Map<string, Session[]>();
    visible.forEach((s) => {
      const list = map.get(s.date) ?? [];
      list.push(s);
      map.set(s.date, list);
    });
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, items]) => ({
        date,
        items: [...items].sort((a, b) => a.start.localeCompare(b.start)),
      }));
  }, [visible]);

  const deleteEntry = (id: string) => {
    const s = data.sessions.find((x) => x.id === id);
    if (s?.invoiced) {
      toast("Can't delete — already on an invoice");
      return;
    }
    update((d) => {
      d.sessions = d.sessions.filter((x) => x.id !== id);
    });
  };

  const repeatLast = () => {
    const sorted = [...data.sessions].sort((a, b) =>
      (a.date + a.start).localeCompare(b.date + b.start),
    );
    const last = sorted[sorted.length - 1];
    if (!last) return;
    const today = todayIso();
    const dupe = data.sessions.some(
      (s) =>
        s.date === today &&
        s.clientId === last.clientId &&
        s.start === last.start &&
        s.end === last.end,
    );
    if (dupe) {
      toast('Already logged that for today');
      return;
    }
    update((d) => {
      d.sessions.push({
        id: uid('ws'),
        clientId: last.clientId,
        date: today,
        start: last.start,
        end: last.end,
        note: last.note || '',
        invoiced: false,
        invoiceId: null,
      });
    });
    toast('Entry repeated for today');
  };

  return (
    <>
      <SectionHead
        title="Hours"
        count={`${visible.length} ${visible.length === 1 ? 'entry' : 'entries'}`}
      />

      {data.sessions.length > 0 && (
        <div className="quickrow">
          <button className="btn btn-outline btn-sm" onClick={repeatLast}>
            ↻ Repeat last entry
          </button>
        </div>
      )}

      <div className="tabs">
        <button
          className={'tab-seg' + (view === 'list' ? ' active' : '')}
          onClick={() => setView('list')}
        >
          List
        </button>
        <button
          className={'tab-seg' + (view === 'calendar' ? ' active' : '')}
          onClick={() => setView('calendar')}
        >
          Calendar
        </button>
      </div>

      {view === 'list' ? (
        <>
          <div className="chips">
            <button
              className={'chip' + (activeFilter === 'all' ? ' active' : '')}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            {data.clients.map((c) => (
              <button
                key={c.id}
                className={'chip' + (activeFilter === c.id ? ' active' : '')}
                onClick={() => setFilter(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>

          {data.sessions.length === 0 ? (
            <EmptyState
              glyph="⏱"
              lines={['No hours logged yet.', 'Tap + to punch in your first entry.']}
            />
          ) : visible.length === 0 ? (
            <EmptyState glyph="⏱" lines={['No hours for this client yet.']} />
          ) : (
            <>
              <div className="summary-bar">
                <div className="split">
                  <div>
                    <span className="n">{fmtHours(totalHours)}</span> total
                  </div>
                  <div>
                    <span className="n">{fmtHours(unbilledHours)}</span> unbilled
                  </div>
                </div>
              </div>

              {byDate.map(({ date, items }) => {
                const dayTotal = items.reduce(
                  (sum, s) => sum + hoursBetween(s.start, s.end),
                  0,
                );
                return (
                  <div className="day-group" key={date}>
                    <div className="day-label">
                      <span>{fmtDateLabel(date)}</span>
                      <span>{fmtHours(dayTotal)}</span>
                    </div>
                    {items.map((s) => (
                      <PunchRow
                        key={s.id}
                        session={s}
                        clientName={clientName(s.clientId)}
                        onEdit={() => openSheet({ kind: 'entry', editing: s })}
                        onDelete={() => deleteEntry(s.id)}
                      />
                    ))}
                  </div>
                );
              })}
            </>
          )}
        </>
      ) : (
        <CalendarView openSheet={openSheet} />
      )}
    </>
  );
}

export function PunchRow({
  session,
  clientName,
  onEdit,
  onDelete,
}: {
  session: Session;
  clientName: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { data } = useStore();
  const dur = hoursBetween(session.start, session.end);
  const billing = sessionBillingLabel(session, data.invoices);
  return (
    <div
      className={'punch' + (session.invoiced ? ' billed' : '')}
      style={{ ['--accent-color' as string]: clientColor(session.clientId) }}
    >
      <div className="meta">
        <span className="client-tag">{clientName}</span>
        {session.note ? <div className="note">{session.note}</div> : null}
        <div className="dur">
          {fmtHours(dur)}
          {billing ? (
            <>
              {' · '}
              <span className={'dur-status ' + billing}>{billing}</span>
            </>
          ) : null}
        </div>
      </div>
      <div className="times">
        {session.start}
        <span className="arrow">→</span>
        {session.end}
      </div>
      <div className="row-actions">
        <button className="icon-btn" onClick={onEdit} aria-label="Edit entry">
          ✎
        </button>
        <button className="icon-btn" onClick={onDelete} aria-label="Delete entry">
          🗑
        </button>
      </div>
    </div>
  );
}
