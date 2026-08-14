import { useMemo, useState } from 'react';
import { invoiceReadiness } from '@reckon/shared';
import { ProfileRequired } from '../components/ProfileRequired';
import { Field, Sheet } from '../components/ui';
import {
  addDaysIso,
  fmtDateLabel,
  fmtMoney,
  hoursBetween,
  todayIso,
} from '../lib/format';
import { nextInvoiceNumber } from '../lib/invoice';
import { uid } from '../lib/storage';
import { useStore } from '../store/context';
import { btn, btnBlock, field, hint, input, label, row2 } from '../styles/cx';
import { Select } from '../components/Select';
import { DateField } from '../components/DateField';
import type { OpenSheet } from '../lib/sheets';

export function NewInvoiceSheet({
  clientId: initialClientId,
  onClose,
  replaceSheet,
}: {
  clientId?: string;
  onClose: () => void;
  replaceSheet?: OpenSheet;
}) {
  const { data, update, toast } = useStore();
  const [clientId, setClientId] = useState(
    initialClientId ?? data.clients[0]?.id ?? '',
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

  const generate = () => {
    if (checkedIds.length === 0) return;
    const client = data.clients.find((c) => c.id === clientId);
    if (!client) return;

    const records = checkedIds.map((id) => {
      const s = data.sessions.find((x) => x.id === id);
      return { date: s?.date ?? '', hours: s ? hoursBetween(s.start, s.end) : 0 };
    });
    const totalHours = records.reduce((sum, r) => sum + r.hours, 0);
    const dates = records.map((r) => r.date).sort();
    const number = nextInvoiceNumber(
      data.invoices,
      data.profile.nextInvoiceNumber,
      issueDate,
    );
    const id = uid('inv');

    update((d) => {
      d.invoices.push({
        id,
        number,
        clientId,
        issueDate,
        dueDate,
        description: description.trim() || 'Storitve',
        periodStart: dates[0] ?? issueDate,
        periodEnd: dates[dates.length - 1] ?? issueDate,
        sessionIds: checkedIds,
        totalHours,
        rate: client.rate,
        total: totalHours * client.rate,
        status: 'unpaid',
        paidDate: null,
      });
      checkedIds.forEach((sid) => {
        const s = d.sessions.find((x) => x.id === sid);
        if (s) {
          s.invoiced = true;
          s.invoiceId = id;
        }
      });
    });
    toast('Račun ' + number + ' ustvarjen');
    onClose();
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
      <Sheet title="Nov račun" onClose={onClose}>
        <p className={hint}>Najprej dodajte stranko.</p>
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
          disabled={checkedIds.length === 0}
          onClick={generate}
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
          options={data.clients.map((c) => ({
            value: c.id,
            label: c.name,
            hint: `${fmtMoney(c.rate)}/h`,
          }))}
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
