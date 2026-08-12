import { useState } from 'react';
import { Field, Sheet } from '../components/ui';
import { todayIso } from '../lib/format';
import type { EntryPrefill } from '../lib/sheets';
import { uid } from '../lib/storage';
import type { Session } from '../lib/types';
import { useStore } from '../store/context';

export function EntrySheet({
  editing,
  prefill,
  onClose,
}: {
  editing?: Session;
  prefill?: EntryPrefill;
  onClose: () => void;
}) {
  const { data, update, toast } = useStore();
  const [clientId, setClientId] = useState(
    editing?.clientId ?? prefill?.clientId ?? data.clients[0]?.id ?? '',
  );
  const [date, setDate] = useState(editing?.date ?? prefill?.date ?? todayIso());
  const [start, setStart] = useState(editing?.start ?? prefill?.start ?? '09:00');
  const [end, setEnd] = useState(editing?.end ?? prefill?.end ?? '17:00');
  const [note, setNote] = useState(editing?.note ?? prefill?.note ?? '');

  const save = () => {
    if (!clientId || !date || !start || !end) {
      toast('Fill in client, date and times');
      return;
    }
    update((d) => {
      if (editing) {
        const s = d.sessions.find((x) => x.id === editing.id);
        if (s) Object.assign(s, { clientId, date, start, end, note });
      } else {
        d.sessions.push({
          id: uid('ws'),
          clientId,
          date,
          start,
          end,
          note,
          invoiced: false,
          invoiceId: null,
        });
      }
    });
    toast('Entry saved');
    onClose();
  };

  if (data.clients.length === 0) {
    return (
      <Sheet title="Log hours" onClose={onClose}>
        <p className="hint">Add a client first — hours are always logged against one.</p>
      </Sheet>
    );
  }

  return (
    <Sheet title={editing ? 'Edit entry' : 'Log hours'} onClose={onClose}>
      <Field label="Client" htmlFor="entryClient">
        <select
          id="entryClient"
          className="select"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        >
          {data.clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Date" htmlFor="entryDate">
        <input
          id="entryDate"
          className="input"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </Field>

      <div className="row2">
        <Field label="In" htmlFor="entryStart">
          <input
            id="entryStart"
            className="input"
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </Field>
        <Field label="Out" htmlFor="entryEnd">
          <input
            id="entryEnd"
            className="input"
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Position / what you worked on" htmlFor="entryNote">
        <input
          id="entryNote"
          className="input"
          type="text"
          placeholder="e.g. backend integration"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>

      <button className="btn btn-primary btn-block" onClick={save}>
        Save entry
      </button>
    </Sheet>
  );
}
