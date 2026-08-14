import { useRef, useState } from 'react';
import { POSTAL_CODE_LENGTH, TAX_NUMBER_LENGTH, fieldErrors, profileSchema } from '@reckon/shared';
import { useAuth } from '../auth/context';
import { DownloadIcon, UploadIcon } from '../components/icons';
import { Select } from '../components/Select';
import { Field, Sheet } from '../components/ui';
import { downloadBlob } from '../lib/download';
import { todayIso } from '../lib/format';
import { DEFAULT_VAT_CLAUSE, normalize } from '../lib/storage';
import type { Profile } from '../lib/types';
import { useStore } from '../store/context';
import { btn, btnBlock, btnSm, cardLabel, hint, input, row2 } from '../styles/cx';

const digitsOnly = (value: string, max: number) => value.replace(/\D/g, '').slice(0, max);

export function ProfileSheet({ onClose }: { onClose: () => void }) {
  const { data, update, replace, toast } = useStore();
  const { user, signOut } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<Profile>({
    ...data.profile,
    vatClause: data.profile.vatClause || DEFAULT_VAT_CLAUSE,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) =>
      key in e ? Object.fromEntries(Object.entries(e).filter(([k]) => k !== key)) : e,
    );
  };

  const save = () => {
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      toast('Preverite označena polja');
      return;
    }
    update((d) => {
      d.profile = parsed.data;
    });
    toast('Podatki shranjeni');
    onClose();
  };

  const downloadBackup = () => {
    downloadBlob(
      JSON.stringify(data, null, 2),
      `reckon-varnostna-kopija-${todayIso()}.json`,
      'application/json',
    );
    toast('Varnostna kopija prenesena');
  };

  const restoreBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result));
        if (!parsed || typeof parsed !== 'object') throw new Error('bad format');
        if (!confirm('To bo zamenjalo vse trenutne podatke z vsebino varnostne kopije. Nadaljujem?')) {
          return;
        }
        replace(normalize(parsed));
        toast('Podatki obnovljeni');
        onClose();
      } catch {
        toast('Datoteke ni bilo mogoče prebrati');
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  };

  const cls = (key: keyof Profile) => input + (errors[key] ? ' border-destructive' : '');
  const invalid = (key: keyof Profile) => (errors[key] ? true : undefined);

  return (
    <Sheet
      title="Moji podatki"
      onClose={onClose}
      footer={
        <button className={`${btn.primary} ${btnBlock}`} onClick={save}>
          Shrani
        </button>
      }
    >
      <div className={cardLabel}>Izdajatelj računa</div>

      <Field
        label="Ime in priimek / naziv"
        htmlFor="pName"
        error={errors.name}
        hint="Točno kot je registrirano, vključno s pripisom s.p."
      >
        <input
          id="pName"
          className={cls('name')}
          type="text"
          placeholder="npr. Ana Novak s.p."
          value={form.name}
          aria-invalid={invalid('name')}
          onChange={(e) => set('name', e.target.value)}
        />
      </Field>

      <Field label="Ulica in hišna številka" htmlFor="pStreet" error={errors.street}>
        <input
          id="pStreet"
          className={cls('street')}
          type="text"
          placeholder="npr. Izletniška pot 52"
          autoComplete="street-address"
          value={form.street}
          aria-invalid={invalid('street')}
          onChange={(e) => set('street', e.target.value)}
        />
      </Field>

      <div className="mb-4 grid grid-cols-[9rem_1fr] gap-3">
        <Field label="Poštna številka" htmlFor="pPostal" error={errors.postalCode}>
          <input
            id="pPostal"
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
        <Field label="Kraj" htmlFor="pCity" error={errors.city}>
          <input
            id="pCity"
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

      <div className={cardLabel}>Registracija</div>

      <div className={row2}>
        <Field
          label="Davčna številka"
          htmlFor="pTax"
          error={errors.taxNumber}
          hint={`${form.taxNumber.length}/${TAX_NUMBER_LENGTH} mest`}
        >
          <input
            id="pTax"
            className={cls('taxNumber')}
            type="text"
            inputMode="numeric"
            maxLength={TAX_NUMBER_LENGTH}
            placeholder="82426490"
            value={form.taxNumber}
            aria-invalid={invalid('taxNumber')}
            onChange={(e) => set('taxNumber', digitsOnly(e.target.value, TAX_NUMBER_LENGTH))}
          />
        </Field>
        <Field
          label={
            <>
              Matična številka{' '}
              <span className="font-normal text-muted-fg">(neobvezno)</span>
            </>
          }
          htmlFor="pReg"
          error={errors.regNumber}
        >
          <input
            id="pReg"
            className={cls('regNumber')}
            type="text"
            inputMode="numeric"
            maxLength={10}
            placeholder="1234567000"
            value={form.regNumber}
            aria-invalid={invalid('regNumber')}
            onChange={(e) => set('regNumber', digitsOnly(e.target.value, 10))}
          />
        </Field>
      </div>

      <Field label="Zavezanec za DDV" htmlFor="pVat">
        <Select
          id="pVat"
          value={form.vatPayer}
          onChange={(v) => set('vatPayer', v as Profile['vatPayer'])}
          options={[
            { value: 'NE', label: 'NE — nisem zavezanec' },
            { value: 'DA', label: 'DA — sem zavezanec' },
          ]}
        />
      </Field>

      <div className={cardLabel}>Plačilo</div>

      <Field
        label="TRR (IBAN)"
        htmlFor="pIban"
        error={errors.iban}
        hint="Natisnjen na vsakem računu in zapisan v UPN QR kodo."
      >
        <input
          id="pIban"
          className={cls('iban')}
          type="text"
          placeholder="SI56 1010 0005 8079 036"
          value={form.iban}
          aria-invalid={invalid('iban')}
          onChange={(e) => set('iban', e.target.value)}
        />
      </Field>

      <Field
        label={
          <>
            Imetnik računa <span className="font-normal text-muted-fg">(neobvezno)</span>
          </>
        }
        htmlFor="pAccountHolder"
        error={errors.accountHolder}
        hint="Izpolnite, če TRR ni odprt na ime firme — npr. osebni račun."
      >
        <input
          id="pAccountHolder"
          className={cls('accountHolder')}
          type="text"
          maxLength={33}
          placeholder={form.name || 'Ime in priimek imetnika'}
          value={form.accountHolder}
          aria-invalid={invalid('accountHolder')}
          onChange={(e) => set('accountHolder', e.target.value)}
        />
      </Field>

      <div className={cardLabel}>Privzete vrednosti računa</div>

      <Field
        label="Privzeti opis storitve"
        htmlFor="pDefaultDesc"
        error={errors.defaultDesc}
        hint="Predizpolni opis na vsakem novem računu."
      >
        <input
          id="pDefaultDesc"
          className={cls('defaultDesc')}
          type="text"
          placeholder="npr. Reševanje iz vode"
          value={form.defaultDesc}
          aria-invalid={invalid('defaultDesc')}
          onChange={(e) => set('defaultDesc', e.target.value)}
        />
      </Field>

      <div className={row2}>
        <Field label="Kraj izdaje" htmlFor="pPlaceOfIssue" error={errors.placeOfIssue}>
          <input
            id="pPlaceOfIssue"
            className={cls('placeOfIssue')}
            type="text"
            placeholder="Koper"
            value={form.placeOfIssue}
            aria-invalid={invalid('placeOfIssue')}
            onChange={(e) => set('placeOfIssue', e.target.value)}
          />
        </Field>
        <Field
          label="Naslednja številka računa"
          htmlFor="pNextInvoiceNumber"
          error={errors.nextInvoiceNumber}
          hint="Številka, ki jo bo dobil naslednji račun."
        >
          <input
            id="pNextInvoiceNumber"
            className={cls('nextInvoiceNumber')}
            type="text"
            placeholder="003/2026"
            value={form.nextInvoiceNumber}
            aria-invalid={invalid('nextInvoiceNumber')}
            onChange={(e) => set('nextInvoiceNumber', e.target.value)}
          />
        </Field>
      </div>

      {form.vatPayer === 'NE' && (
        <Field
          label="Klavzula DDV"
          htmlFor="pVatClause"
          error={errors.vatClause}
          hint="Natisnjena na vsakem računu kot razlog, da DDV ni obračunan."
        >
          <input
            id="pVatClause"
            className={cls('vatClause')}
            type="text"
            placeholder={DEFAULT_VAT_CLAUSE}
            value={form.vatClause}
            aria-invalid={invalid('vatClause')}
            onChange={(e) => set('vatClause', e.target.value)}
          />
        </Field>
      )}

      <div className={cardLabel}>Varnostna kopija</div>

      <div className={`${hint} mb-3`}>
        Podatki so shranjeni samo v tem brskalniku. Občasno prenesite kopijo, da jih ob
        zamenjavi naprave ne izgubite.
      </div>
      <button className={`${btn.outline} ${btnBlock}`} onClick={downloadBackup}>
        <DownloadIcon className="size-3.5" />
        Prenesi varnostno kopijo
      </button>
      <button
        className={`${btn.outline} ${btnBlock} mt-2`}
        onClick={() => fileInput.current?.click()}
      >
        <UploadIcon className="size-3.5" />
        Obnovi iz varnostne kopije
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={restoreBackup}
      />

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-fg">
        <span className="truncate font-mono">{user?.email}</span>
        <button className={`${btn.outline} ${btnSm}`} onClick={() => void signOut()}>
          Odjava
        </button>
      </div>
    </Sheet>
  );
}
