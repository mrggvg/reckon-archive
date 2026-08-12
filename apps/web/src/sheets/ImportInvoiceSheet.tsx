import { useState } from 'react';
import { Field, Sheet } from '../components/ui';
import { uid } from '../lib/storage';
import { useStore } from '../store/context';

export function ImportInvoiceSheet({ onClose }: { onClose: () => void }) {
  const { data, update, toast } = useStore();
  const [clientId, setClientId] = useState(data.clients[0]?.id ?? '');
  const [number, setNumber] = useState('');
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
      toast('Invoice number is required');
      return;
    }
    if (data.invoices.some((i) => i.number === number.trim())) {
      toast('That invoice number already exists');
      return;
    }
    if (!issueDate || isNaN(totalNum)) {
      toast('Issue date and total are required');
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
    toast('Invoice ' + number.trim() + ' added');
    onClose();
  };

  if (data.clients.length === 0) {
    return (
      <Sheet title="Import invoice" onClose={onClose}>
        <p className="hint">Add a client first.</p>
      </Sheet>
    );
  }

  return (
    <Sheet title="Import invoice" onClose={onClose}>
      <div className="hint" style={{ marginBottom: 16 }}>
        For invoices you already made by hand — this just adds them to your history, it
        won&apos;t link any hours.
      </div>

      <Field label="Client" htmlFor="impClient">
        <select
          id="impClient"
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
        <Field label="Invoice number" htmlFor="impNumber">
          <input
            id="impNumber"
            className="input"
            type="text"
            placeholder="e.g. 002/2026"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
        </Field>
        <Field label="Total (EUR)" htmlFor="impTotal">
          <input
            id="impTotal"
            className="input"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Service description" htmlFor="impDesc">
        <input
          id="impDesc"
          className="input"
          type="text"
          placeholder="e.g. Reševanje iz vode"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>

      <div className="row2">
        <Field label="Period from" htmlFor="impPeriodStart">
          <input
            id="impPeriodStart"
            className="input"
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
          />
        </Field>
        <Field label="Period to" htmlFor="impPeriodEnd">
          <input
            id="impPeriodEnd"
            className="input"
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
          />
        </Field>
      </div>

      <div className="row2">
        <Field label="Issue date" htmlFor="impIssueDate">
          <input
            id="impIssueDate"
            className="input"
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
          />
        </Field>
        <Field label="Due date" htmlFor="impDueDate">
          <input
            id="impDueDate"
            className="input"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Status" htmlFor="impStatus">
        <select
          id="impStatus"
          className="select"
          value={status}
          onChange={(e) => setStatus(e.target.value as 'unpaid' | 'paid')}
        >
          <option value="unpaid">Unpaid</option>
          <option value="paid">Paid</option>
        </select>
      </Field>

      {status === 'paid' && (
        <Field label="Paid on" htmlFor="impPaidDate">
          <input
            id="impPaidDate"
            className="input"
            type="date"
            value={paidDate}
            onChange={(e) => setPaidDate(e.target.value)}
          />
        </Field>
      )}

      <button className="btn btn-primary btn-block" onClick={save}>
        Add to history
      </button>
    </Sheet>
  );
}
