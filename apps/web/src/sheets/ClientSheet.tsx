import { useState } from 'react';
import {
  POSTAL_CODE_LENGTH,
  TAX_NUMBER_LENGTH,
  clientSchema,
  fieldErrors,
} from '@reckon/shared';
import { Field, Sheet } from '../components/ui';
import { uid } from '../lib/storage';
import type { Client } from '../lib/types';
import { useStore } from '../store/context';
import { btn, btnBlock, cardLabel, input } from '../styles/cx';

/** Numeric fields accept digits only, so a typo can't become a bad invoice. */
const digitsOnly = (value: string, max: number) =>
  value.replace(/\D/g, '').slice(0, max);

export function ClientSheet({
  editing,
  onCreated,
  onClose,
}: {
  editing?: Client;
  /** Called with the new client's id, so the caller can select it. */
  onCreated?: (id: string) => void;
  onClose: () => void;
}) {
  const { update, toast } = useStore();
  const [form, setForm] = useState({
    name: editing?.name ?? '',
    street: editing?.street ?? '',
    postalCode: editing?.postalCode ?? '',
    city: editing?.city ?? '',
    taxNumber: editing?.taxNumber ?? '',
    rate: editing ? String(editing.rate) : '',
    email: editing?.email ?? '',
    phone: editing?.phone ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  /** Editing a field clears its complaint; everything is re-checked on save. */
  const set = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) =>
      key in e ? Object.fromEntries(Object.entries(e).filter(([k]) => k !== key)) : e,
    );
  };

  const created = uid('cl');

  const save = () => {
    const parsed = clientSchema.safeParse({ ...form, rate: parseFloat(form.rate) });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      toast('Preverite označena polja');
      return;
    }

    // Comes back trimmed, with the tax number stripped of any SI prefix.
    const payload = parsed.data;
    update((d) => {
      if (editing) {
        const c = d.clients.find((x) => x.id === editing.id);
        if (c) Object.assign(c, payload);
      } else {
        d.clients.push({ id: created, ...payload });
      }
    });
    if (!editing) onCreated?.(created);
    toast('Stranka shranjena');
    onClose();
  };

  const cls = (key: keyof typeof form) =>
    input + (errors[key] ? ' border-destructive' : '');
  const invalid = (key: keyof typeof form) => (errors[key] ? true : undefined);

  return (
    <Sheet
      title={editing ? 'Uredi stranko' : 'Nova stranka'}
      onClose={onClose}
      footer={
        <button className={`${btn.primary} ${btnBlock}`} onClick={save}>
          {editing ? 'Shrani spremembe' : 'Dodaj stranko'}
        </button>
      }
    >
      <Field label="Naziv podjetja" htmlFor="clientName" error={errors.name}>
        <input
          id="clientName"
          className={cls('name')}
          type="text"
          placeholder="npr. Nordis d.o.o."
          autoComplete="organization"
          value={form.name}
          aria-invalid={invalid('name')}
          onChange={(e) => set('name', e.target.value)}
        />
      </Field>

      <div className={cardLabel}>Naslov sedeža</div>

      <Field label="Ulica in hišna številka" htmlFor="clientStreet" error={errors.street}>
        <input
          id="clientStreet"
          className={cls('street')}
          type="text"
          placeholder="npr. Vojkovo nabrežje 31a"
          autoComplete="street-address"
          value={form.street}
          aria-invalid={invalid('street')}
          onChange={(e) => set('street', e.target.value)}
        />
      </Field>

      {/* Postal code is narrow on purpose — four digits need no more room. */}
      <div className="mb-4 grid grid-cols-[9rem_1fr] gap-3">
        <Field label="Poštna številka" htmlFor="clientPostal" error={errors.postalCode}>
          <input
            id="clientPostal"
            className={cls('postalCode')}
            type="text"
            inputMode="numeric"
            maxLength={POSTAL_CODE_LENGTH}
            placeholder="6000"
            autoComplete="postal-code"
            value={form.postalCode}
            aria-invalid={invalid('postalCode')}
            onChange={(e) => set('postalCode', digitsOnly(e.target.value, POSTAL_CODE_LENGTH))}
          />
        </Field>
        <Field label="Kraj" htmlFor="clientCity" error={errors.city}>
          <input
            id="clientCity"
            className={cls('city')}
            type="text"
            placeholder="Koper"
            autoComplete="address-level2"
            value={form.city}
            aria-invalid={invalid('city')}
            onChange={(e) => set('city', e.target.value)}
          />
        </Field>
      </div>

      <div className={cardLabel}>Obračun</div>

      <div className="mb-4 grid grid-cols-1 gap-3 min-[520px]:grid-cols-2">
        <Field
          label="Davčna številka"
          htmlFor="clientTax"
          error={errors.taxNumber}
          hint={`${form.taxNumber.length}/${TAX_NUMBER_LENGTH} mest`}
        >
          <input
            id="clientTax"
            className={cls('taxNumber')}
            type="text"
            inputMode="numeric"
            maxLength={TAX_NUMBER_LENGTH}
            placeholder="29825962"
            value={form.taxNumber}
            aria-invalid={invalid('taxNumber')}
            onChange={(e) => set('taxNumber', digitsOnly(e.target.value, TAX_NUMBER_LENGTH))}
          />
        </Field>
        <Field label="Urna postavka (€)" htmlFor="clientRate" error={errors.rate}>
          <input
            id="clientRate"
            className={cls('rate')}
            type="number"
            min="0"
            step="0.5"
            inputMode="decimal"
            placeholder="25"
            value={form.rate}
            aria-invalid={invalid('rate')}
            onChange={(e) => set('rate', e.target.value)}
          />
        </Field>
      </div>

      <div className={cardLabel}>
        Kontakt <span className="normal-case">(neobvezno)</span>
      </div>

      <Field label="E-pošta" htmlFor="clientEmail" error={errors.email}>
        <input
          id="clientEmail"
          className={cls('email')}
          type="email"
          inputMode="email"
          placeholder="racuni@company.si"
          autoComplete="email"
          value={form.email}
          aria-invalid={invalid('email')}
          onChange={(e) => set('email', e.target.value)}
        />
      </Field>

      <Field label="Telefon" htmlFor="clientPhone" error={errors.phone}>
        <input
          id="clientPhone"
          className={cls('phone')}
          type="tel"
          inputMode="tel"
          placeholder="+386 41 234 567"
          autoComplete="tel"
          value={form.phone}
          aria-invalid={invalid('phone')}
          onChange={(e) => set('phone', e.target.value)}
        />
      </Field>

    </Sheet>
  );
}
