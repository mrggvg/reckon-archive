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
      toast('Vnosa ni mogoče izbrisati — je že na računu');
      return;
    }
    update((d) => {
      d.sessions = d.sessions.filter((x) => x.id !== id);
    });
  };

  return (
    <Sheet
      title={fmtDateLabel(date)}
      onClose={onClose}
      footer={
        <button
          className={`${btn.outline} ${btnBlock}`}
          onClick={() => {
            if (data.clients.length === 0) {
              toast('Najprej dodajte stranko');
              return;
            }
            replaceSheet({ kind: 'entry', prefill: { date } });
          }}
        >
          <PlusIcon className="size-3.5" />
          Dodaj vnos za ta dan
        </button>
      }
    >
      {sessions.length > 0 && (
        <div className={`${hint} mb-3`}>
          {fmtHours(total)} skupaj
        </div>
      )}

      {sessions.length === 0 ? (
        <div className={emptyInline}>Ta dan ni vnosov.</div>
      ) : (
        sessions.map((s) => (
          <PunchRow
            key={s.id}
            session={s}
            clientName={data.clients.find((c) => c.id === s.clientId)?.name ?? 'Brez stranke'}
            onEdit={() => replaceSheet({ kind: 'entry', editing: s })}
            onDelete={() => deleteEntry(s.id)}
          />
        ))
      )}

    </Sheet>
  );
}
