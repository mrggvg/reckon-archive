import { useState } from 'react';
import { useAuth } from '../auth/context';
import { Field, Sheet } from '../components/ui';
import { DEFAULT_VAT_CLAUSE } from '../lib/storage';
import type { Profile } from '../lib/types';
import { useStore } from '../store/context';

export function ProfileSheet({ onClose }: { onClose: () => void }) {
  const { data, update, toast } = useStore();
  const { user, signOut } = useAuth();
  const p = data.profile;

  const [form, setForm] = useState<Profile>({
    ...p,
    vatClause: p.vatClause ?? DEFAULT_VAT_CLAUSE,
  });

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = () => {
    update((d) => {
      d.profile = {
        ...form,
        name: form.name.trim(),
        address: form.address.trim(),
        taxNumber: form.taxNumber.trim(),
        regNumber: form.regNumber.trim(),
        iban: form.iban.trim(),
        defaultDesc: form.defaultDesc.trim(),
        lastInvoiceNumber: form.lastInvoiceNumber.trim(),
        placeOfIssue: form.placeOfIssue.trim(),
        vatClause: form.vatClause.trim(),
      };
    });
    toast('Profile saved');
    onClose();
  };

  return (
    <Sheet title="Your details" onClose={onClose}>
      <Field label="Full name" htmlFor="pName">
        <input
          id="pName"
          className="input"
          type="text"
          placeholder="e.g. Ana Novak s.p."
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
        />
      </Field>

      <Field label="Registered address" htmlFor="pAddress">
        <input
          id="pAddress"
          className="input"
          type="text"
          placeholder="Street, postal code, city"
          value={form.address}
          onChange={(e) => set('address', e.target.value)}
        />
      </Field>

      <div className="row2">
        <Field label="Tax number" htmlFor="pTax">
          <input
            id="pTax"
            className="input"
            type="text"
            placeholder="SI12345678"
            value={form.taxNumber}
            onChange={(e) => set('taxNumber', e.target.value)}
          />
        </Field>
        <Field label="Registration no." htmlFor="pReg">
          <input
            id="pReg"
            className="input"
            type="text"
            placeholder="matična številka"
            value={form.regNumber}
            onChange={(e) => set('regNumber', e.target.value)}
          />
        </Field>
      </div>

      <Field label="IBAN / TRR" htmlFor="pIban">
        <input
          id="pIban"
          className="input"
          type="text"
          placeholder="SI56 1234 5678 9012 345"
          value={form.iban}
          onChange={(e) => set('iban', e.target.value)}
        />
      </Field>

      <div className="row2">
        <Field
          label="Dohodnina rate to set aside (%)"
          htmlFor="pTaxRate"
          hint="4% is typical for normiranci (flat-rate) on invoiced income."
        >
          <input
            id="pTaxRate"
            className="input"
            type="number"
            min="0"
            max="100"
            step="0.5"
            placeholder="4"
            value={form.taxRate}
            onChange={(e) => set('taxRate', parseFloat(e.target.value) || 0)}
          />
        </Field>
        <Field label="VAT payer (davčni zavezanec)" htmlFor="pVat">
          <select
            id="pVat"
            className="select"
            value={form.vatPayer}
            onChange={(e) => set('vatPayer', e.target.value as Profile['vatPayer'])}
          >
            <option value="NE">NE</option>
            <option value="DA">DA</option>
          </select>
        </Field>
      </div>

      <div className="row2">
        <Field label="Taxation system" htmlFor="pTaxSystem">
          <select
            id="pTaxSystem"
            className="select"
            value={form.taxSystem}
            onChange={(e) => set('taxSystem', e.target.value as Profile['taxSystem'])}
          >
            <option value="normiranec">Normiranec (flat-rate)</option>
            <option value="dejanski">Dejanski stroški (actual costs)</option>
          </select>
        </Field>
        <Field label="Prispevki per month (€)" htmlFor="pMonthlyContribution">
          <input
            id="pMonthlyContribution"
            className="input"
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 651"
            value={form.monthlyContribution}
            onChange={(e) => set('monthlyContribution', parseFloat(e.target.value) || 0)}
          />
        </Field>
      </div>

      <div className="hint" style={{ marginBottom: 16 }}>
        Prispevki (PIZ, health, parental, employment) are paid monthly regardless of profit
        — check your eDavki e-kartica for your exact amount, it&apos;s lower in your first
        two years if you&apos;re newly registered.
      </div>

      <Field
        label="Default service description"
        htmlFor="pDefaultDesc"
        hint="Used to estimate what you owe FURS on paid invoices, and pre-fills each invoice's service line."
      >
        <input
          id="pDefaultDesc"
          className="input"
          type="text"
          placeholder="e.g. Reševanje iz vode"
          value={form.defaultDesc}
          onChange={(e) => set('defaultDesc', e.target.value)}
        />
      </Field>

      <Field
        label="Last invoice number already issued"
        htmlFor="pLastInvoiceNumber"
        hint="Set this if you've already issued invoices manually — new ones in the app will continue counting after it."
      >
        <input
          id="pLastInvoiceNumber"
          className="input"
          type="text"
          placeholder="e.g. 003/2026"
          value={form.lastInvoiceNumber}
          onChange={(e) => set('lastInvoiceNumber', e.target.value)}
        />
      </Field>

      <Field label="Place of issue (kraj izdaje)" htmlFor="pPlaceOfIssue">
        <input
          id="pPlaceOfIssue"
          className="input"
          type="text"
          placeholder="e.g. Koper"
          value={form.placeOfIssue}
          onChange={(e) => set('placeOfIssue', e.target.value)}
        />
      </Field>

      <Field
        label="VAT clause (DDV klavzula)"
        htmlFor="pVatClause"
        hint="Printed on every invoice when you're not a VAT payer. Not strictly required by law, but standard practice and expected by accountants."
      >
        <input
          id="pVatClause"
          className="input"
          type="text"
          placeholder={DEFAULT_VAT_CLAUSE}
          value={form.vatClause}
          onChange={(e) => set('vatClause', e.target.value)}
        />
      </Field>

      <button className="btn btn-primary btn-block" onClick={save}>
        Save
      </button>

      <div className="sheet-account">
        <span className="mono">{user?.email}</span>
        <button className="btn btn-outline btn-sm" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    </Sheet>
  );
}
