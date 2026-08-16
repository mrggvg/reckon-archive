import { useRef, useState } from 'react';
import {
  POSTAL_CODE_LENGTH,
  TAX_NUMBER_LENGTH,
  clientSchema,
  fieldErrors,
  taxNumberSchema,
} from '@reckon/shared';
import { SearchIcon } from '../components/icons';
import { ApiError } from '../lib/api';
import { resources } from '../lib/resources';
import { Field, Sheet } from '../components/ui';
import { failureMessage } from '../lib/failure';
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
  const { createClient, updateClient, toast } = useStore();
  const [saving, setSaving] = useState(false);
  const [looking, setLooking] = useState(false);
  // Whatever was last asked about, so a second keystroke can't ask again.
  const asked = useRef('');
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

  /**
   * Fills the company's details from its tax number.
   *
   * The register is the authority on how a company is called and where it
   * sits, and getting either wrong on an invoice is the user's problem, not
   * the register's. What comes back is put in the form, not saved — it is a
   * suggestion in fields that stay editable.
   */
  const lookUp = async (taxNumber: string, quiet = false) => {
    asked.current = taxNumber;
    setLooking(true);
    try {
      const found = await resources.lookup.company(taxNumber);
      setForm((f) => ({
        ...f,
        name: found.name,
        street: found.street,
        postalCode: found.postalCode,
        city: found.city,
      }));
      setErrors({});
      toast(found.source === 'ajpes' ? 'Podatki iz AJPES' : 'Podatki iz registra DDV');
    } catch (err) {
      // An automatic lookup that finds nothing says nothing: the user is
      // typing, not asking. Pressing the button is asking.
      if (quiet) return;
      toast(
        err instanceof ApiError
          ? err.message
          : 'Registra ni bilo mogoče doseči — vnesite podatke ročno',
      );
    } finally {
      setLooking(false);
    }
  };

  const setTaxNumber = (value: string) => {
    const digits = digitsOnly(value, TAX_NUMBER_LENGTH);
    set('taxNumber', digits);

    // A complete, valid number on an empty form is a request to fill it in.
    const complete = taxNumberSchema.safeParse(digits).success;
    if (complete && !form.name.trim() && asked.current !== digits) {
      void lookUp(digits, true);
    }
  };

  const save = async () => {
    const parsed = clientSchema.safeParse({ ...form, rate: parseFloat(form.rate) });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      toast('Preverite označena polja');
      return;
    }

    // Comes back trimmed, with the tax number stripped of any SI prefix.
    const payload = parsed.data;
    setSaving(true);
    try {
      if (editing) {
        await updateClient(editing.id, payload);
      } else {
        // The id is the server's to assign, so the caller is told it after.
        const client = await createClient(payload);
        onCreated?.(client.id);
      }
      toast('Stranka shranjena');
      onClose();
    } catch (err) {
      toast(failureMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const cls = (key: keyof typeof form) =>
    input + (errors[key] ? ' border-destructive' : '');
  const invalid = (key: keyof typeof form) => (errors[key] ? true : undefined);

  return (
    <Sheet
      title={editing ? 'Uredi stranko' : 'Nova stranka'}
      onClose={onClose}
      footer={
        <button className={`${btn.primary} ${btnBlock}`} onClick={() => void save()}
          disabled={saving}>
          {editing ? 'Shrani spremembe' : 'Dodaj stranko'}
        </button>
      }
    >
      <Field
        label="Davčna številka"
        htmlFor="clientTax"
        error={errors.taxNumber}
        hint={
          looking
            ? 'Iščem v registru …'
            : 'Vnesite davčno številko in podatki se izpolnijo sami.'
        }
      >
        <div className="relative">
          <input
            id="clientTax"
            className={cls('taxNumber') + ' pr-11'}
            type="text"
            inputMode="numeric"
            maxLength={TAX_NUMBER_LENGTH}
            placeholder="29825962"
            autoFocus={!editing}
            value={form.taxNumber}
            aria-invalid={invalid('taxNumber')}
            onChange={(e) => setTaxNumber(e.target.value)}
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center text-muted-fg hover:text-fg disabled:opacity-40"
            onClick={() => void lookUp(form.taxNumber)}
            disabled={looking || !taxNumberSchema.safeParse(form.taxNumber).success}
            aria-label="Poišči v registru"
            title="Poišči v registru"
          >
            <SearchIcon className="size-4" />
          </button>
        </div>
      </Field>

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

      <div className="mb-4">
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
