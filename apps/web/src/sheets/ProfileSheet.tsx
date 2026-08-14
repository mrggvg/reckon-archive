import { useState } from 'react';
import { POSTAL_CODE_LENGTH, TAX_NUMBER_LENGTH, fieldErrors, profileSchema } from '@reckon/shared';
import { useAuth } from '../auth/context';
import { Select } from '../components/Select';
import { Field, Sheet } from '../components/ui';
import { DEFAULT_VAT_CLAUSE } from '../lib/storage';
import type { Profile } from '../lib/types';
import type { OpenSheet } from '../lib/sheets';
import { activeBusiness } from '../lib/business';
import { fmtDMY } from '../lib/format';
import { useStore } from '../store/context';
import { btn, btnBlock, btnSm, cardLabel, hint, input } from '../styles/cx';

const digitsOnly = (value: string, max: number) => value.replace(/\D/g, '').slice(0, max);

/** Numbers live in the form as strings so a half-typed value isn't destroyed. */
type Draft = Omit<Profile, 'taxRate' | 'monthlyContribution'> & {
  taxRate: string;
  monthlyContribution: string;
};

export function ProfileSheet({
  onClose,
  openSheet,
}: {
  onClose: () => void;
  openSheet?: OpenSheet;
}) {
  const { data, update, toast } = useStore();
  const { user, signOut } = useAuth();
  const p = data.profile;

  const [form, setForm] = useState<Draft>({
    ...p,
    vatClause: p.vatClause || DEFAULT_VAT_CLAUSE,
    taxRate: String(p.taxRate ?? ''),
    monthlyContribution: String(p.monthlyContribution ?? ''),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) =>
      key in e ? Object.fromEntries(Object.entries(e).filter(([k]) => k !== key)) : e,
    );
  };

  const save = () => {
    const parsed = profileSchema.safeParse({
      ...form,
      taxRate: parseFloat(form.taxRate),
      monthlyContribution: parseFloat(form.monthlyContribution),
    });
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

  const cls = (key: keyof Draft) => input + (errors[key] ? ' border-destructive' : '');
  const invalid = (key: keyof Draft) => (errors[key] ? true : undefined);

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

      <div className="mb-4 grid grid-cols-1 gap-3 min-[520px]:grid-cols-2">
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
              Matična številka <span className="font-normal text-muted-fg">(neobvezno)</span>
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

      <div className="mb-4 grid grid-cols-1 gap-3 min-[520px]:grid-cols-2">
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
        <Field label="Način obdavčitve" htmlFor="pTaxSystem">
          <Select
            id="pTaxSystem"
            value={form.taxSystem}
            onChange={(v) => set('taxSystem', v as Profile['taxSystem'])}
            options={[
              { value: 'normiranec', label: 'Normiranec' },
              { value: 'dejanski', label: 'Dejanski stroški' },
            ]}
          />
        </Field>
      </div>

      <div className={cardLabel}>Dejavnost</div>

      {(() => {
        const business = activeBusiness(data.businesses);
        if (!business) {
          return (
            <div className="mb-4">
              <div className={hint}>
                Podatki o vpisu s.p. še niso vneseni. Z njimi se prispevki obračunajo od
                dneva začetka, dohodnina pa po dejanski stopnji vaše sheme.
              </div>
              <button
                className={`${btn.outline} ${btnSm} mt-2`}
                onClick={() => openSheet?.({ kind: 'business' })}
              >
                Registriraj dejavnost
              </button>
            </div>
          );
        }
        return (
          <div className="mb-4">
            <div className="text-sm font-semibold">{business.firma}</div>
            <div className={`${hint} mt-1`}>
              Vpis {fmtDMY(business.startedOn)}
              {business.closedOn ? ` · izbris ${fmtDMY(business.closedOn)}` : ' · aktivna'}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                className={`${btn.outline} ${btnSm}`}
                onClick={() => openSheet?.({ kind: 'business', editing: business })}
              >
                Uredi dejavnost
              </button>
              {business.closedOn && (
                <button
                  className={`${btn.outline} ${btnSm}`}
                  onClick={() => openSheet?.({ kind: 'business' })}
                >
                  Registriraj novo
                </button>
              )}
            </div>
          </div>
        );
      })()}

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
            Imetnik računa{' '}
            <span className="font-normal text-muted-fg">(neobvezno)</span>
          </>
        }
        htmlFor="pAccountHolder"
        error={errors.accountHolder}
        hint="Izpolnite, če TRR ni odprt na ime firme — npr. osebni račun. To ime gre v UPN QR kodo."
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

      <div className={cardLabel}>Rezervacija za dajatve</div>

      <div className="mb-4 grid grid-cols-1 gap-3 min-[520px]:grid-cols-2">
        <Field
          label="Stopnja dohodnine (%)"
          htmlFor="pTaxRate"
          error={errors.taxRate}
          hint="Za normirance je običajno 4 %."
        >
          <input
            id="pTaxRate"
            className={cls('taxRate')}
            type="number"
            min="0"
            max="100"
            step="0.5"
            inputMode="decimal"
            placeholder="4"
            value={form.taxRate}
            aria-invalid={invalid('taxRate')}
            onChange={(e) => set('taxRate', e.target.value)}
          />
        </Field>
        <Field
          label="Prispevki na mesec (€)"
          htmlFor="pMonthlyContribution"
          error={errors.monthlyContribution}
          hint="Znesek najdete na e-kartici eDavki."
        >
          <input
            id="pMonthlyContribution"
            className={cls('monthlyContribution')}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="651"
            value={form.monthlyContribution}
            aria-invalid={invalid('monthlyContribution')}
            onChange={(e) => set('monthlyContribution', e.target.value)}
          />
        </Field>
      </div>

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

      <div className="mb-4 grid grid-cols-1 gap-3 min-[520px]:grid-cols-2">
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
          hint="Številka, ki jo bo dobil naslednji račun. Predhodne morajo biti zabeležene."
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

      {/* Only meaningful while you aren't charging VAT. */}
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

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-fg">
        <span className="truncate font-mono">{user?.email}</span>
        <button className={`${btn.outline} ${btnSm}`} onClick={() => void signOut()}>
          Odjava
        </button>
      </div>
    </Sheet>
  );
}
