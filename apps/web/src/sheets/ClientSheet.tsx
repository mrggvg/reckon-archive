import { useState } from 'react';
import { Field, Sheet } from '../components/ui';
import { uid } from '../lib/storage';
import type { Client } from '../lib/types';
import { useStore } from '../store/context';

export function ClientSheet({
  editing,
  onClose,
}: {
  editing?: Client;
  onClose: () => void;
}) {
  const { update, toast } = useStore();
  const [name, setName] = useState(editing?.name ?? '');
  const [address, setAddress] = useState(editing?.address ?? '');
  const [taxNumber, setTaxNumber] = useState(editing?.taxNumber ?? '');
  const [rate, setRate] = useState(editing ? String(editing.rate) : '');
  const [email, setEmail] = useState(editing?.email ?? '');
  const [phone, setPhone] = useState(editing?.phone ?? '');

  const save = () => {
    if (!name.trim()) {
      toast('Client name is required');
      return;
    }
    const payload = {
      name: name.trim(),
      address: address.trim(),
      taxNumber: taxNumber.trim(),
      rate: parseFloat(rate) || 0,
      email: email.trim(),
      phone: phone.trim(),
    };
    update((d) => {
      if (editing) {
        const c = d.clients.find((x) => x.id === editing.id);
        if (c) Object.assign(c, payload);
      } else {
        d.clients.push({ id: uid('cl'), ...payload });
      }
    });
    toast('Client saved');
    onClose();
  };

  return (
    <Sheet title={editing ? 'Edit client' : 'New client'} onClose={onClose}>
      <Field label="Company name" htmlFor="clientName">
        <input
          id="clientName"
          className="input"
          type="text"
          placeholder="e.g. Nordis d.o.o."
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>

      <Field label="Registered address" htmlFor="clientAddress">
        <input
          id="clientAddress"
          className="input"
          type="text"
          placeholder="Street, postal code, city"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </Field>

      <div className="row2">
        <Field label="Tax number" htmlFor="clientTax">
          <input
            id="clientTax"
            className="input"
            type="text"
            placeholder="SI12345678"
            value={taxNumber}
            onChange={(e) => setTaxNumber(e.target.value)}
          />
        </Field>
        <Field label="Hourly rate (€)" htmlFor="clientRate">
          <input
            id="clientRate"
            className="input"
            type="number"
            min="0"
            step="0.5"
            placeholder="25"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        </Field>
      </div>

      <div className="row2">
        <Field
          label={
            <>
              Email <span className="optional">(optional)</span>
            </>
          }
          htmlFor="clientEmail"
        >
          <input
            id="clientEmail"
            className="input"
            type="email"
            placeholder="accounting@company.si"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field
          label={
            <>
              Phone <span className="optional">(optional)</span>
            </>
          }
          htmlFor="clientPhone"
        >
          <input
            id="clientPhone"
            className="input"
            type="tel"
            placeholder="+386 ..."
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
      </div>

      <button className="btn btn-primary btn-block" onClick={save}>
        Save client
      </button>
    </Sheet>
  );
}
