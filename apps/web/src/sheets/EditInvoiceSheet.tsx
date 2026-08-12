import { useState } from 'react';
import { Field, Sheet } from '../components/ui';
import { useStore } from '../store/context';

export function EditInvoiceSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, update, toast } = useStore();
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
      <Sheet title="Edit invoice" onClose={onClose}>
        <p className="hint">That invoice no longer exists.</p>
      </Sheet>
    );
  }

  const isImported = !inv.sessionIds || inv.sessionIds.length === 0;

  const save = () => {
    if (!number.trim()) {
      toast('Invoice number is required');
      return;
    }
    if (data.invoices.some((i) => i.id !== id && i.number === number.trim())) {
      toast('That invoice number is already used');
      return;
    }
    update((d) => {
      const target = d.invoices.find((i) => i.id === id);
      if (!target) return;
      target.number = number.trim();
      target.description = description.trim() || 'Storitve';
      target.issueDate = issueDate || target.issueDate;
      target.dueDate = dueDate || target.dueDate;
      if (isImported) {
        target.clientId = clientId;
        target.periodStart = periodStart || target.periodStart;
        target.periodEnd = periodEnd || target.periodEnd;
        const parsed = parseFloat(total);
        if (!isNaN(parsed)) target.total = parsed;
      }
    });
    toast('Invoice updated');
    onClose();
  };

  return (
    <Sheet title="Edit invoice" onClose={onClose}>
      <Field label="Invoice number" htmlFor="editInvNumber">
        <input
          id="editInvNumber"
          className="input"
          type="text"
          placeholder="e.g. 003/2026"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
        />
      </Field>

      <Field label="Service description" htmlFor="editInvDesc">
        <input
          id="editInvDesc"
          className="input"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>

      <div className="row2">
        <Field label="Issue date" htmlFor="editInvIssueDate">
          <input
            id="editInvIssueDate"
            className="input"
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
          />
        </Field>
        <Field label="Due date" htmlFor="editInvDueDate">
          <input
            id="editInvDueDate"
            className="input"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </Field>
      </div>

      {isImported ? (
        <>
          <Field label="Client" htmlFor="editInvClient">
            <select
              id="editInvClient"
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

          <div className="row2">
            <Field label="Period from" htmlFor="editInvPeriodStart">
              <input
                id="editInvPeriodStart"
                className="input"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </Field>
            <Field label="Period to" htmlFor="editInvPeriodEnd">
              <input
                id="editInvPeriodEnd"
                className="input"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Total (EUR)" htmlFor="editInvTotal">
            <input
              id="editInvTotal"
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
            />
          </Field>
        </>
      ) : (
        <div className="hint" style={{ marginBottom: 16 }}>
          Total, period, and client are derived from linked hours, so they&apos;re locked
          here — edit the underlying entries in Track instead.
        </div>
      )}

      <button className="btn btn-primary btn-block" onClick={save}>
        Save changes
      </button>
    </Sheet>
  );
}
