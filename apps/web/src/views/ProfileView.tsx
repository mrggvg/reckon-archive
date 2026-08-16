import { useRef, useState } from 'react';
import {
  POSTAL_CODE_LENGTH,
  TAX_NUMBER_LENGTH,
  fieldErrors,
  invoiceReadiness,
  profileSchema,
} from '@reckon/shared';
import { useAuth } from '../auth/context';
import {
  AlertIcon,
  BillingIcon,
  CheckCircleIcon,
  DownloadIcon,
  FilePlusIcon,
  FileTextIcon,
  HardDriveIcon,
  InvoiceIcon,
  SignOutIcon,
  SlidersIcon,
  UploadIcon,
  UserIcon,
} from '../components/icons';
import { Select } from '../components/Select';
import { Field, SectionHead } from '../components/ui';
import { downloadBlob } from '../lib/download';
import { failureMessage } from '../lib/failure';
import { exportInvoicesCsv } from '../lib/exportInvoices';
import type { OpenSheet } from '../lib/sheets';
import { todayIso } from '../lib/format';
import { DEFAULT_VAT_CLAUSE, normalize } from '../lib/storage';
import type { Profile } from '../lib/types';
import { useStore } from '../store/context';
import { btn, btnBlock, btnSm, hint, input, row2 } from '../styles/cx';

const digitsOnly = (value: string, max: number) =>
  value.replace(/\D/g, '').slice(0, max);

/** Readiness reports the schema key; the inputs are prefixed to stay unique. */
const fieldId = (key: string) =>
  'p' + key.charAt(0).toUpperCase() + key.slice(1);

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-xs desk:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-fg">
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold tracking-tight">{title}</h3>
          <p className="mt-0.5 text-xs leading-normal text-muted-fg">
            {description}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

/**
 * The profile, as a screen of its own.
 *
 * There is more to fill in here than anywhere else in the app, and it all has
 * to be read together — so it takes the same place Ure or Računi do rather
 * than arriving as a panel over them.
 */
export function ProfileView({ openSheet }: { openSheet: OpenSheet }) {
  const { data, saveProfile, restore, toast } = useStore();
  const [saving, setSaving] = useState(false);
  const { user, signOut } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<Profile>({
    ...data.profile,
    vatClause: data.profile.vatClause || DEFAULT_VAT_CLAUSE,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Read from the form, not the store, so the banner clears as you type.
  const readiness = invoiceReadiness(form);

  const stored: Profile = {
    ...data.profile,
    vatClause: data.profile.vatClause || DEFAULT_VAT_CLAUSE,
  };
  const dirty = JSON.stringify(form) !== JSON.stringify(stored);

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) =>
      key in e
        ? Object.fromEntries(Object.entries(e).filter(([k]) => k !== key))
        : e,
    );
  };

  const save = async () => {
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      toast('Preverite označena polja');
      return;
    }
    setSaving(true);
    try {
      await saveProfile(parsed.data);
      toast('Podatki shranjeni');
    } catch (err) {
      toast(failureMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    toast(exportInvoicesCsv(data) ? 'Računi izvoženi' : 'Ni računov za izvoz');
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
        if (!parsed || typeof parsed !== 'object')
          throw new Error('bad format');
        if (
          !confirm(
            'To bo zamenjalo vse trenutne podatke z vsebino varnostne kopije. Nadaljujem?',
          )
        ) {
          return;
        }
        // Sent to the server as one transaction: the account comes back as
        // the file describes it, or not at all.
        const normalised = normalize(parsed);
        void restore(normalised)
          .then(() => {
            setForm({
              ...normalised.profile,
              vatClause: normalised.profile.vatClause || DEFAULT_VAT_CLAUSE,
            });
            toast('Podatki obnovljeni');
          })
          .catch((err: unknown) => toast(failureMessage(err)));
      } catch {
        toast('Datoteke ni bilo mogoče prebrati');
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  };

  const cls = (key: keyof Profile) =>
    input + (errors[key] ? ' border-destructive' : '');
  const invalid = (key: keyof Profile) => (errors[key] ? true : undefined);

  return (
    <>
      <SectionHead title="Profil" meta={form.name || 'podatki izdajatelja'}>
        <div className="flex shrink-0 gap-2">
          {dirty && (
            <button
              className={`${btn.outline} ${btnSm}`}
              onClick={() => setForm(stored)}
            >
              Razveljavi
            </button>
          )}
          <button
            className={`${btn.primary} ${btnSm}`}
            onClick={() => void save()}
            disabled={saving || !dirty}
          >
            Shrani
          </button>
        </div>
      </SectionHead>

      {readiness.ready ? (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-border bg-success-bg px-4 py-3 text-sm text-success-fg">
          <CheckCircleIcon className="size-4 shrink-0" />
          Podatki so popolni — račune je mogoče izstaviti.
        </div>
      ) : (
        <div className="mb-4 rounded-2xl border border-border bg-warning-bg p-4 text-warning-fg">
          <div className="flex items-start gap-3">
            <AlertIcon className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0">
              <strong className="block text-sm">Podatki še niso popolni</strong>
              <p className="mt-0.5 mb-0 text-xs leading-normal">
                Brez teh podatkov račun ne bi bil veljaven, zato ga ni mogoče
                izstaviti.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {readiness.missing.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    className="cursor-pointer rounded-md border border-border bg-card px-2 py-0.5 text-2xs font-semibold text-fg hover:bg-muted"
                    onClick={() =>
                      document.getElementById(fieldId(m.key))?.focus()
                    }
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <Section
        icon={<UserIcon className="size-4" />}
        title="Izdajatelj računa"
        description="Naziv in naslov, kot ju zahteva 82. člen ZDDV-1."
      >
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

        <Field
          label="Ulica in hišna številka"
          htmlFor="pStreet"
          error={errors.street}
        >
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

        <div className="grid grid-cols-[9rem_1fr] gap-3">
          <Field
            label="Poštna številka"
            htmlFor="pPostalCode"
            error={errors.postalCode}
          >
            <input
              id="pPostalCode"
              className={cls('postalCode')}
              type="text"
              inputMode="numeric"
              maxLength={POSTAL_CODE_LENGTH}
              placeholder="6000"
              autoComplete="postal-code"
              value={form.postalCode}
              aria-invalid={invalid('postalCode')}
              onChange={(e) =>
                set(
                  'postalCode',
                  digitsOnly(e.target.value, POSTAL_CODE_LENGTH),
                )
              }
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
      </Section>

      <Section
        icon={<FileTextIcon className="size-4" />}
        title="Registracija"
        description="Podatki iz odločbe AJPES in statusa pri FURS."
      >
        <div className={row2}>
          <Field
            label="Davčna številka"
            htmlFor="pTaxNumber"
            error={errors.taxNumber}
            hint={`${form.taxNumber.length}/${TAX_NUMBER_LENGTH} mest`}
          >
            <input
              id="pTaxNumber"
              className={cls('taxNumber')}
              type="text"
              inputMode="numeric"
              maxLength={TAX_NUMBER_LENGTH}
              placeholder="82426490"
              value={form.taxNumber}
              aria-invalid={invalid('taxNumber')}
              onChange={(e) =>
                set('taxNumber', digitsOnly(e.target.value, TAX_NUMBER_LENGTH))
              }
            />
          </Field>
          <Field
            label={
              <>
                Matična številka{' '}
                <span className="font-normal text-muted-fg">(neobvezno)</span>
              </>
            }
            htmlFor="pRegNumber"
            error={errors.regNumber}
          >
            <input
              id="pRegNumber"
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

        <Field label="Zavezanec za DDV" htmlFor="pVatPayer">
          <Select
            id="pVatPayer"
            value={form.vatPayer}
            onChange={(v) => set('vatPayer', v as Profile['vatPayer'])}
            options={[
              { value: 'NE', label: 'NE — nisem zavezanec' },
              { value: 'DA', label: 'DA — sem zavezanec' },
            ]}
          />
        </Field>

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
      </Section>

      <Section
        icon={<BillingIcon className="size-4" />}
        title="Plačilo"
        description="Račun, na katerega stranke nakažejo plačilo."
      >
        <div className={row2}>
          <Field
            label="TRR (IBAN)"
            htmlFor="pIban"
            error={errors.iban}
            hint="Natisnjen na računu in zapisan v UPN QR kodo."
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
            hint="Izpolnite, če TRR ni odprt na firmo — npr. osebni račun."
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
        </div>
      </Section>

      <Section
        icon={<SlidersIcon className="size-4" />}
        title="Privzete vrednosti računa"
        description="Predizpolnijo vsak nov račun; na računu jih še vedno lahko spremenite."
      >
        <Field
          label="Privzeti opis storitve"
          htmlFor="pDefaultDesc"
          error={errors.defaultDesc}
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
          <Field
            label="Kraj izdaje"
            htmlFor="pPlaceOfIssue"
            error={errors.placeOfIssue}
          >
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
      </Section>

      {/* On a desktop these live in the sidebar, always within reach. */}
      <div className="desk:hidden">
        <Section
          icon={<InvoiceIcon className="size-4" />}
          title="Uvoz in izvoz računov"
          description="Prenesite račune v preglednico ali zabeležite račun, ki ni bil izdan v aplikaciji."
        >
          <div className="flex flex-col gap-2 min-[520px]:flex-row">
            <button
              className={`${btn.outline} flex-1`}
              onClick={() => openSheet({ kind: 'importInvoice' })}
            >
              <FilePlusIcon className="size-3.5" />
              Uvozi račun
            </button>
            <button className={`${btn.outline} flex-1`} onClick={exportCsv}>
              <DownloadIcon className="size-3.5" />
              Izvozi račune (CSV)
            </button>
          </div>
        </Section>
      </div>

      <Section
        icon={<HardDriveIcon className="size-4" />}
        title="Varnostna kopija"
        description="Podatki so shranjeni samo v tem brskalniku. Občasno prenesite kopijo, da jih ob zamenjavi naprave ne izgubite."
      >
        <div className="flex flex-col gap-2 min-[520px]:flex-row">
          <button className={`${btn.outline} flex-1`} onClick={downloadBackup}>
            <DownloadIcon className="size-3.5" />
            Prenesi kopijo
          </button>
          <button
            className={`${btn.outline} flex-1`}
            onClick={() => fileInput.current?.click()}
          >
            <UploadIcon className="size-3.5" />
            Obnovi iz kopije
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={restoreBackup}
        />
      </Section>

      {/* Repeated at the foot of a long form, where the eye ends up. */}
      <div className="mb-4 flex flex-col gap-2 min-[520px]:flex-row-reverse">
        <button
          className={`${btn.primary} min-[520px]:w-40`}
          onClick={() => void save()}
          disabled={saving || !dirty}
        >
          {dirty ? 'Shrani' : 'Shranjeno'}
        </button>
        {dirty && (
          <button className={btn.outline} onClick={() => setForm(stored)}>
            Razveljavi spremembe
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <span className={`${hint} truncate font-mono`}>{user?.email}</span>
        <button
          className={`${btn.outline} ${btnSm} ${btnBlock} min-[520px]:w-auto`}
          onClick={() => void signOut()}
        >
          <SignOutIcon className="size-3.5" />
          Odjava
        </button>
      </div>
    </>
  );
}
