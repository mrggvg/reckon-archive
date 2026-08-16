import { useMemo, useState } from 'react';
import { invoiceReadiness } from '@reckon/shared';
import { ProfileRequired } from '../components/ProfileRequired';
import { PlusIcon } from '../components/icons';
import { Field, Sheet } from '../components/ui';
import {
  addDaysIso,
  fmtDateLabel,
  fmtMoney,
  hoursBetween,
  todayIso,
} from '../lib/format';
import { defaultClientId, selectableClients } from '../lib/clients';
import { useStore } from '../store/context';
import { btn, btnBlock, field, hint, input, label, row2 } from '../styles/cx';
import { Select } from '../components/Select';
import { DateField } from '../components/DateField';
import { failureMessage } from '../lib/failure';
import type { OpenSheet } from '../lib/sheets';

export function NewInvoiceSheet({
  clientId: initialClientId,
  onClose,
  openSheet,
  replaceSheet,
}: {
  clientId?: string;
  onClose: () => void;
  openSheet?: OpenSheet;
  replaceSheet?: OpenSheet;
}) {
  const { data, generateInvoice, toast } = useStore();
  const [saving, setSaving] = useState(false);
  const [clientId, setClientId] = useState(
    initialClientId ?? defaultClientId(data.clients),
  );
  const [description, setDescription] = useState(data.profile.defaultDesc || '');
  const [issueDate, setIssueDate] = useState(todayIso());
  const [dueDate, setDueDate] = useState(addDaysIso(todayIso(), 14));

  const candidates = useMemo(
    () =>
      data.sessions
        .filter((s) => s.clientId === clientId && !s.invoiced)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [data.sessions, clientId],
  );

  const [unchecked, setUnchecked] = useState<string[]>([]);
  const checkedIds = candidates.filter((s) => !unchecked.includes(s.id)).map((s) => s.id);
  const rate = data.clients.find((c) => c.id === clientId)?.rate ?? 0;

  const toggle = (id: string) =>
    setUnchecked((u) => (u.includes(id) ? u.filter((x) => x !== id) : [...u, id]));

  /**
   * The total, the period and the number all come back from the server: it
   * prices the invoice from the hours it locks, and the number is only really
   * decided once the unique index accepts it.
   */
  const generate = async () => {
    if (checkedIds.length === 0) return;
    setSaving(true);
    try {
      const invoice = await generateInvoice({
        clientId,
        sessionIds: checkedIds,
        issueDate,
        dueDate,
        description: description.trim(),
      });
      toast('Račun ' + invoice.number + ' ustvarjen');
      onClose();
    } catch (err) {
      toast(failureMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const readiness = invoiceReadiness(data.profile);
  if (!readiness.ready) {
    return (
      <Sheet title="Nov račun" onClose={onClose}>
        <ProfileRequired
          missing={readiness.missing}
          onOpenProfile={() => replaceSheet?.({ kind: 'profile' })}
        />
      </Sheet>
    );
  }

  if (data.clients.length === 0) {
    return (
      <Sheet
        title="Nov račun"
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
        <p className={hint}>Račun potrebuje stranko, zato jo dodajte najprej.</p>
      </Sheet>
    );
  }

  return (
    <Sheet
      title="Nov račun"
      onClose={onClose}
      footer={
        <button
          className={`${btn.primary} ${btnBlock}`}
          disabled={saving || checkedIds.length === 0}
          onClick={() => void generate()}
        >
          Ustvari račun
        </button>
      }
    >
      <Field label="Stranka" htmlFor="invClient">
        <Select
          id="invClient"
          value={clientId}
          onChange={(v) => {
            setClientId(v);
            setUnchecked([]);
          }}
          options={selectableClients(data.clients, clientId).map((c) => ({
            value: c.id,
            label: c.name,
            hint: `${fmtMoney(c.rate)}/h`,
          }))}
          action={{
            label: 'Dodaj novo stranko',
            onSelect: () =>
              openSheet?.({
                kind: 'client',
                onCreated: (id) => {
                  setClientId(id);
                  setUnchecked([]);
                },
              }),
          }}
        />
      </Field>

      {candidates.length === 0 ? (
        <p className={`${hint} mb-4`}>
          Za to stranko ni neobračunanih ur.
        </p>
      ) : (
        <div className={field}>
          <span className={label}>Neobračunane ure</span>
          <div className="flex flex-col gap-2">
            {candidates.map((s) => (
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5" key={s.id}>
                <input
                  type="checkbox"
                  checked={!unchecked.includes(s.id)}
                  onChange={() => toggle(s.id)}
                />
                <span className="flex-1 text-sm">
                  {fmtDateLabel(s.date)} · {s.start}–{s.end}
                  {s.note ? ' · ' + s.note : ''}
                </span>
                <span className="font-mono text-sm text-muted-fg">{fmtMoney(hoursBetween(s.start, s.end) * rate)}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <Field label="Opis storitve" htmlFor="invDesc">
        <input
          id="invDesc"
          className={input}
          type="text"
          placeholder="npr. Reševanje iz vode"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>

      <div className={row2}>
        <Field label="Datum izdaje" htmlFor="invDate">
          <DateField
          id="invDate"
          value={issueDate}
          onChange={setIssueDate}
        />
        </Field>
        <Field label="Rok plačila" htmlFor="invDue">
          <DateField
          id="invDue"
          value={dueDate}
          onChange={setDueDate}
        />
        </Field>
      </div>

    </Sheet>
  );
}
