import { useState } from 'react';
import { Field, Sheet } from '../components/ui';
import { todayIso } from '../lib/format';
import type { EntryPrefill } from '../lib/sheets';
import { uid } from '../lib/storage';
import type { Session } from '../lib/types';
import { useStore } from '../store/context';
import { btn, btnBlock, hint, input, row2 } from '../styles/cx';
import { Select } from '../components/Select';
import { DateField } from '../components/DateField';
import { TimeField } from '../components/TimeField';

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
      toast('Izpolnite stranko, datum in čas');
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
    toast('Vnos shranjen');
    onClose();
  };

  if (data.clients.length === 0) {
    return (
      <Sheet title="Vnesi ure" onClose={onClose}>
        <p className={hint}>Najprej dodajte stranko — ure se vedno beležijo nanjo.</p>
      </Sheet>
    );
  }

  return (
    <Sheet
      title={editing ? 'Uredi vnos' : 'Vnesi ure'}
      onClose={onClose}
      footer={
        <button className={`${btn.primary} ${btnBlock}`} onClick={save}>
          Shrani vnos
        </button>
      }
    >
      <Field label="Stranka" htmlFor="entryClient">
        <Select
          id="entryClient"
          value={clientId}
          onChange={setClientId}
          options={data.clients.map((c) => ({ value: c.id, label: c.name }))}
        />
      </Field>

      <Field label="Datum" htmlFor="entryDate">
        <DateField
          id="entryDate"
          value={date}
          onChange={setDate}
        />
      </Field>

      <div className={row2}>
        <Field label="Začetek" htmlFor="entryStart">
          <TimeField id="entryStart" value={start} onChange={setStart} />
        </Field>
        <Field label="Konec" htmlFor="entryEnd">
          <TimeField id="entryEnd" value={end} onChange={setEnd} />
        </Field>
      </div>

      <Field
        label={
          <>
            Opomba <span className="font-normal text-muted-fg">(neobvezno)</span>
          </>
        }
        htmlFor="entryNote"
        hint="Karkoli si želite zapomniti — delovno mesto, lokacija, opravilo. Izpiše se na delovnem listu."
      >
        <input
          id="entryNote"
          className={input}
          type="text"
          placeholder="npr. reševanje iz vode, Žusterna"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>

    </Sheet>
  );
}
