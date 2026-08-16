import { useState } from 'react';
import { Field, Sheet } from '../components/ui';
import { failureMessage } from '../lib/failure';
import { selectableClients } from '../lib/clients';
import { useStore } from '../store/context';
import { btn, btnBlock, hint, input, row2 } from '../styles/cx';
import { Select } from '../components/Select';
import { DateField } from '../components/DateField';
import type { OpenSheet } from '../lib/sheets';

export function EditInvoiceSheet({
  id,
  onClose,
  openSheet,
}: {
  id: string;
  onClose: () => void;
  openSheet?: OpenSheet;
}) {
  const { data, updateInvoice, toast } = useStore();
  const [saving, setSaving] = useState(false);
  const inv = data.invoices.find((i) => i.id === id);

  const [number, setNumber] = useState(inv?.number ?? '');
  const [description, setDescription] = useState(inv?.description ?? '');
  const [issueDate, setIssueDate] = useState(inv?.issueDate ?? '');
  const [dueDate, setDueDate] = useState(inv?.dueDate ?? '');
  const [clientId, setClientId] = useState(inv?.clientId ?? '');
  const [periodStart, setPeriodStart] = useState(inv?.periodStart ?? '');
  const [periodEnd, setPeriodEnd] = useState(inv?.periodEnd ?? '');
  const [total, setTotal] = useState(inv ? String(inv.total) : '');

  if (!inv) {
    return (
      <Sheet title="Uredi račun" onClose={onClose}>
        <p className={hint}>Ta račun ne obstaja več.</p>
      </Sheet>
    );
  }

  const isImported = !inv.sessionIds || inv.sessionIds.length === 0;

  const save = async () => {
    if (!number.trim()) {
      toast('Številka računa je obvezna');
      return;
    }
    if (data.invoices.some((i) => i.id !== id && i.number === number.trim())) {
      toast('Ta številka računa je že v uporabi');
      return;
    }
    setSaving(true);
    try {
      // The client, period and total of an invoice generated from hours are
      // facts about those hours; the server refuses to let them drift.
      const parsedTotal = parseFloat(total);
      await updateInvoice(id, {
        number: number.trim(),
        description: description.trim(),
        ...(issueDate ? { issueDate } : {}),
        ...(dueDate ? { dueDate } : {}),
        ...(isImported
          ? {
              clientId,
              ...(periodStart ? { periodStart } : {}),
              ...(periodEnd ? { periodEnd } : {}),
              ...(isNaN(parsedTotal) ? {} : { total: parsedTotal }),
            }
          : {}),
      });
    } catch (err) {
      toast(failureMessage(err));
      setSaving(false);
      return;
    }
    setSaving(false);
    toast('Račun posodobljen');
    onClose();
  };

  return (
    <Sheet
      title="Uredi račun"
      onClose={onClose}
      footer={
        <button className={`${btn.primary} ${btnBlock}`} onClick={() => void save()}
            disabled={saving}>
          Shrani spremembe
        </button>
      }
    >
      <Field label="Številka računa" htmlFor="editInvNumber">
        <input
          id="editInvNumber"
          className={input}
          type="text"
          placeholder="npr. 003/2026"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
        />
      </Field>

      <Field label="Opis storitve" htmlFor="editInvDesc">
        <input
          id="editInvDesc"
          className={input}
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>

      <div className={row2}>
        <Field label="Datum izdaje" htmlFor="editInvIssueDate">
          <DateField
          id="editInvIssueDate"
          value={issueDate}
          onChange={setIssueDate}
        />
        </Field>
        <Field label="Rok plačila" htmlFor="editInvDueDate">
          <DateField
          id="editInvDueDate"
          value={dueDate}
          onChange={setDueDate}
        />
        </Field>
      </div>

      {isImported ? (
        <>
          <Field label="Stranka" htmlFor="editInvClient">
            <Select
              id="editInvClient"
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
            <Field label="Obdobje od" htmlFor="editInvPeriodStart">
              <DateField
          id="editInvPeriodStart"
          value={periodStart}
          onChange={setPeriodStart}
        />
            </Field>
            <Field label="Obdobje do" htmlFor="editInvPeriodEnd">
              <DateField
          id="editInvPeriodEnd"
          value={periodEnd}
          onChange={setPeriodEnd}
        />
            </Field>
          </div>

          <Field label="Znesek (EUR)" htmlFor="editInvTotal">
            <input
              id="editInvTotal"
              className={input}
              type="number"
              min="0"
              step="0.01"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
            />
          </Field>
        </>
      ) : (
        <div className={`${hint} mb-4`}>
          Znesek, obdobje in stranka izhajajo iz povezanih ur, zato jih tu ni mogoče
          spreminjati — uredite vnose pod Ure.
        </div>
      )}

    </Sheet>
  );
}
