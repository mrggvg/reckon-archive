import { useState } from 'react';
import { invoiceReadiness } from '@reckon/shared';
import { ProfileRequired } from '../components/ProfileRequired';
import { Field, Sheet } from '../components/ui';
import { uid } from '../lib/storage';
import { useStore } from '../store/context';
import { btn, btnBlock, hint, input, row2 } from '../styles/cx';
import { Select } from '../components/Select';
import { DateField } from '../components/DateField';
import type { OpenSheet } from '../lib/sheets';

export function ImportInvoiceSheet({
  onClose,
  replaceSheet,
  prefillNumber,
}: {
  onClose: () => void;
  replaceSheet?: OpenSheet;
  /** Pre-set when recording a specific gap in the numbering. */
  prefillNumber?: string;
}) {
  const { data, update, toast } = useStore();
  const [clientId, setClientId] = useState(data.clients[0]?.id ?? '');
  const [number, setNumber] = useState(prefillNumber ?? '');
  const [total, setTotal] = useState('');
  const [description, setDescription] = useState(data.profile.defaultDesc || '');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<'unpaid' | 'paid'>('unpaid');
  const [paidDate, setPaidDate] = useState('');

  const save = () => {
    const totalNum = parseFloat(total);
    if (!number.trim()) {
      toast('Številka računa je obvezna');
      return;
    }
    if (data.invoices.some((i) => i.number === number.trim())) {
      toast('Račun s to številko že obstaja');
      return;
    }
    if (!issueDate || isNaN(totalNum)) {
      toast('Datum izdaje in znesek sta obvezna');
      return;
    }
    update((d) => {
      d.invoices.push({
        id: uid('inv'),
        number: number.trim(),
        clientId,
        issueDate,
        dueDate: dueDate || issueDate,
        description: description.trim() || 'Storitve',
        periodStart: periodStart || issueDate,
        periodEnd: periodEnd || issueDate,
        sessionIds: [],
        totalHours: null,
        rate: null,
        total: totalNum,
        status,
        paidDate: status === 'paid' ? paidDate || issueDate : null,
        imported: true,
      });
    });
    toast('Račun ' + number.trim() + ' dodan');
    onClose();
  };

  const readiness = invoiceReadiness(data.profile);
  if (!readiness.ready) {
    return (
      <Sheet title="Uvoz računa" onClose={onClose}>
        <ProfileRequired
          missing={readiness.missing}
          onOpenProfile={() => replaceSheet?.({ kind: 'profile' })}
        />
      </Sheet>
    );
  }

  if (data.clients.length === 0) {
    return (
      <Sheet title="Uvoz računa" onClose={onClose}>
        <p className={hint}>Najprej dodajte stranko.</p>
      </Sheet>
    );
  }

  return (
    <Sheet
      title="Uvoz računa"
      onClose={onClose}
      footer={
        <button className={`${btn.primary} ${btnBlock}`} onClick={save}>
          Dodaj v zgodovino
        </button>
      }
    >
      <div className={`${hint} mb-4`}>
        Za račune, ki ste jih izstavili drugje — doda jih v zgodovino, ur pa ne poveže.
      </div>

      <Field label="Stranka" htmlFor="impClient">
        <Select
          id="impClient"
          value={clientId}
          onChange={setClientId}
          options={data.clients.map((c) => ({ value: c.id, label: c.name }))}
        />
      </Field>

      <div className={row2}>
        <Field label="Številka računa" htmlFor="impNumber">
          <input
            id="impNumber"
            className={input}
            type="text"
            placeholder="npr. 002/2026"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
        </Field>
        <Field label="Znesek (EUR)" htmlFor="impTotal">
          <input
            id="impTotal"
            className={input}
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Opis storitve" htmlFor="impDesc">
        <input
          id="impDesc"
          className={input}
          type="text"
          placeholder="npr. Reševanje iz vode"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>

      <div className={row2}>
        <Field label="Obdobje od" htmlFor="impPeriodStart">
          <DateField
          id="impPeriodStart"
          value={periodStart}
          onChange={setPeriodStart}
        />
        </Field>
        <Field label="Obdobje do" htmlFor="impPeriodEnd">
          <DateField
          id="impPeriodEnd"
          value={periodEnd}
          onChange={setPeriodEnd}
        />
        </Field>
      </div>

      <div className={row2}>
        <Field label="Datum izdaje" htmlFor="impIssueDate">
          <DateField
          id="impIssueDate"
          value={issueDate}
          onChange={setIssueDate}
        />
        </Field>
        <Field label="Rok plačila" htmlFor="impDueDate">
          <DateField
          id="impDueDate"
          value={dueDate}
          onChange={setDueDate}
        />
        </Field>
      </div>

      <Field label="Status" htmlFor="impStatus">
        <Select
          id="impStatus"
          value={status}
          onChange={(v) => setStatus(v as 'unpaid' | 'paid')}
          options={[
            { value: 'unpaid', label: 'Neplačano' },
            { value: 'paid', label: 'Plačano' },
          ]}
        />
      </Field>

      {status === 'paid' && (
        <Field label="Datum plačila" htmlFor="impPaidDate">
          <DateField
          id="impPaidDate"
          value={paidDate}
          onChange={setPaidDate}
        />
        </Field>
      )}

    </Sheet>
  );
}
