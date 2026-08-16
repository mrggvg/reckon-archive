import { useState } from 'react';
import { PlusIcon } from '../components/icons';
import { Field, Sheet } from '../components/ui';
import { failureMessage } from '../lib/failure';
import { todayIso } from '../lib/format';
import { lastShiftFor } from '../lib/suggestions';
import type { EntryPrefill, OpenSheet } from '../lib/sheets';
import type { Session } from '../lib/types';
import { defaultClientId, selectableClients } from '../lib/clients';
import { useStore } from '../store/context';
import { btn, btnBlock, hint, input, row2 } from '../styles/cx';
import { Select } from '../components/Select';
import { DateField } from '../components/DateField';
import { TimeField } from '../components/TimeField';

export function EntrySheet({
  editing,
  prefill,
  onClose,
  openSheet,
}: {
  editing?: Session;
  prefill?: EntryPrefill;
  onClose: () => void;
  openSheet?: OpenSheet;
}) {
  const { data, createSession, updateSession, toast } = useStore();
  const [saving, setSaving] = useState(false);
  const [clientId, setClientId] = useState(
    editing?.clientId ?? prefill?.clientId ?? defaultClientId(data.clients),
  );
  const [date, setDate] = useState(editing?.date ?? prefill?.date ?? todayIso());

  // A new entry opens on the shift this client was last worked. 09:00–17:00 is
  // only a guess about someone's day; their own last entry is evidence.
  const usual = lastShiftFor(data.sessions, clientId);
  const [start, setStart] = useState(
    editing?.start ?? prefill?.start ?? usual?.start ?? '09:00',
  );
  const [end, setEnd] = useState(editing?.end ?? prefill?.end ?? usual?.end ?? '17:00');
  // Once the times have been typed they are the user's, and switching client
  // must not overwrite them.
  const [timesTouched, setTimesTouched] = useState(false);

  const pickClient = (id: string) => {
    setClientId(id);
    if (editing || timesTouched) return;
    const shift = lastShiftFor(data.sessions, id);
    setStart(shift?.start ?? '09:00');
    setEnd(shift?.end ?? '17:00');
  };
  const [note, setNote] = useState(editing?.note ?? prefill?.note ?? '');

  const save = async () => {
    if (!clientId || !date || !start || !end) {
      toast('Izpolnite stranko, datum in čas');
      return;
    }
    setSaving(true);
    try {
      const entry = { clientId, date, start, end, note };
      // The server refuses to move an entry that is already on an invoice.
      if (editing) await updateSession(editing.id, entry);
      else await createSession(entry);
      toast('Vnos shranjen');
      onClose();
    } catch (err) {
      toast(failureMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (data.clients.length === 0) {
    return (
      <Sheet
        title="Vnesi ure"
        onClose={onClose}
        footer={
          <button
            className={`${btn.primary} ${btnBlock}`}
            onClick={() => openSheet?.({ kind: 'client' })}
          >
            <PlusIcon className="size-3.5" />
            Dodaj stranko
          </button>
        }
      >
        <p className={hint}>Ure se vedno beležijo na stranko, zato jo dodajte najprej.</p>
      </Sheet>
    );
  }

  return (
    <Sheet
      title={editing ? 'Uredi vnos' : 'Vnesi ure'}
      onClose={onClose}
      footer={
        <button className={`${btn.primary} ${btnBlock}`} onClick={() => void save()}
            disabled={saving}>
          Shrani vnos
        </button>
      }
    >
      <Field label="Stranka" htmlFor="entryClient">
        <Select
          id="entryClient"
          value={clientId}
          onChange={pickClient}
          options={selectableClients(data.clients, clientId).map((c) => ({
            value: c.id,
            label: c.name,
          }))}
          action={{
            label: 'Dodaj novo stranko',
            onSelect: () =>
              openSheet?.({ kind: 'client', onCreated: (id) => setClientId(id) }),
          }}
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
          <TimeField
            id="entryStart"
            value={start}
            onChange={(v) => {
              setTimesTouched(true);
              setStart(v);
            }}
          />
        </Field>
        <Field label="Konec" htmlFor="entryEnd">
          <TimeField
            id="entryEnd"
            value={end}
            onChange={(v) => {
              setTimesTouched(true);
              setEnd(v);
            }}
          />
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
