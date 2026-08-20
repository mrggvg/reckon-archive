import { useState } from 'react';
import { invoiceReadiness } from '@reckon/shared';
import { ProfileRequired } from '../components/ProfileRequired';
import { PlusIcon } from '../components/icons';
import { Field, Sheet } from '../components/ui';
import { defaultClientId, selectableClients } from '../lib/clients';
import { useStore } from '../store/context';
import { btn, btnBlock, hint, input, row2 } from '../styles/cx';
import { Select } from '../components/Select';
import { DateField } from '../components/DateField';
import { PassthroughFields } from '../components/PassthroughFields';
import { yearPositionFrom } from '../lib/yearPosition';
import { failureMessage } from '../lib/failure';
import { todayIso } from '../lib/format';
import type { OpenSheet } from '../lib/sheets';

export function ImportInvoiceSheet({
  onClose,
  openSheet,
  replaceSheet,
}: {
  onClose: () => void;
  openSheet?: OpenSheet;
  replaceSheet?: OpenSheet;
}) {
  const { data, importInvoice, toast } = useStore();
  const [saving, setSaving] = useState(false);
  const [clientId, setClientId] = useState(defaultClientId(data.clients));
  const [number, setNumber] = useState('');
  const [total, setTotal] = useState('');
  const [description, setDescription] = useState(data.profile.defaultDesc || '');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<'unpaid' | 'paid'>('unpaid');
  const [paidDate, setPaidDate] = useState('');
  const [passthrough, setPassthrough] = useState<
    { forWhom: string; keep: number } | null
  >(null);

  const save = async () => {
    const totalNum = parseFloat(total);
    if (!number.trim()) {
      toast('Številka računa je obvezna');
      return;
    }
    if (!issueDate || isNaN(totalNum)) {
      toast('Datum izdaje in znesek sta obvezna');
      return;
    }
    setSaving(true);
    try {
      // Uniqueness of the number is the database's to enforce, not a check
      // against whatever this browser happens to have loaded.
      const invoice = await importInvoice({
        number: number.trim(),
        clientId,
        issueDate,
        dueDate: dueDate || issueDate,
        description: description.trim(),
        periodStart: periodStart || issueDate,
        periodEnd: periodEnd || issueDate,
        total: totalNum,
        status,
        paidDate: status === 'paid' ? paidDate || issueDate : null,
        passthrough: passthrough?.forWhom.trim() ? passthrough : null,
      });
      toast('Račun ' + invoice.number + ' dodan');
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
      <Sheet
        title="Uvoz računa"
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
      title="Uvoz računa"
      onClose={onClose}
      footer={
        <button className={`${btn.primary} ${btnBlock}`} onClick={() => void save()}
            disabled={saving}>
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

      <PassthroughFields
        totalEuros={parseFloat(total) || 0}
        value={passthrough}
        onChange={setPassthrough}
        year={Number(issueDate.slice(0, 4)) || Number(todayIso().slice(0, 4))}
        kind="full"
        position={yearPositionFrom(
          data.invoices,
          todayIso(),
          data.profile.businessStartDate ?? null,
        )}
      />

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
