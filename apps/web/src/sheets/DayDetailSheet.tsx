import { PlusIcon } from '../components/icons';
import { Sheet } from '../components/ui';
import { fmtDateLabel, fmtHours, hoursBetween } from '../lib/format';
import type { OpenSheet } from '../lib/sheets';
import { useStore } from '../store/context';
import { PunchRow } from '../views/TrackView';
import { btn, btnBlock, emptyInline, hint } from '../styles/cx';

export function DayDetailSheet({
  date,
  onClose,
  replaceSheet,
}: {
  date: string;
  onClose: () => void;
  openSheet: OpenSheet;
  replaceSheet: OpenSheet;
}) {
  const { data, update, toast } = useStore();

  const sessions = data.sessions
    .filter((s) => s.date === date)
    .sort((a, b) => a.start.localeCompare(b.start));
  const total = sessions.reduce((sum, s) => sum + hoursBetween(s.start, s.end), 0);

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

  return (
    <Sheet title={fmtDateLabel(date)} onClose={onClose}>
      {sessions.length > 0 && (
        <div className={`${hint} mb-3`}>
          {fmtHours(total)} total
        </div>
      )}

      {sessions.length === 0 ? (
        <div className={emptyInline}>No entries this day.</div>
      ) : (
        sessions.map((s) => (
          <PunchRow
            key={s.id}
            session={s}
            clientName={data.clients.find((c) => c.id === s.clientId)?.name ?? 'Unassigned'}
            onEdit={() => replaceSheet({ kind: 'entry', editing: s })}
            onDelete={() => deleteEntry(s.id)}
          />
        ))
      )}

      <button
        className={`${btn.outline} ${btnBlock}`}
        onClick={() => {
          if (data.clients.length === 0) {
            toast('Add a client first');
            return;
          }
          replaceSheet({ kind: 'entry', prefill: { date } });
        }}
      >
        <PlusIcon className="size-3.5" />
        Add entry for this day
      </button>
    </Sheet>
  );
}
