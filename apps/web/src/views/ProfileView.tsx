import { useEffect, useRef, useState } from 'react';
import {
  POSTAL_CODE_LENGTH,
  TAX_NUMBER_LENGTH,
  fieldErrors,
  invoiceReadiness,
  profileSchema,
  suggestedContributionPayments,
  taxNumberSchema,
  type TaxProfileInput,
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
  SearchIcon,
  BillingIcon as PaymentIcon,
  SlidersIcon,
  UploadIcon,
  UserIcon,
} from '../components/icons';
import { Select } from '../components/Select';
import { Field, SectionHead } from '../components/ui';
import { ApiError } from '../lib/api';
import { downloadBlob } from '../lib/download';
import { failureMessage } from '../lib/failure';
import { resources } from '../lib/resources';
import { DateField } from '../components/DateField';
import { exportInvoicesCsv } from '../lib/exportInvoices';
import type { OpenSheet } from '../lib/sheets';
import { todayIso } from '../lib/format';
import { DEFAULT_VAT_CLAUSE, normalize } from '../lib/storage';
import type { Profile } from '../lib/types';
import { useStore } from '../store/context';
import { btn, btnBlock, btnSm, cardLabel, hint, input, row2 } from '../styles/cx';

/** The four groups, as the filing names them. */
const CONTRIBUTION_FIELDS = [
  { key: 'piz', label: 'PIZ', full: 'Pokojninsko in invalidsko' },
  { key: 'zzDo', label: 'ZZ + DO', full: 'Zdravstveno in dolgotrajna oskrba' },
  { key: 'stv', label: 'STV', full: 'Starševsko varstvo' },
  { key: 'zap', label: 'ZAP', full: 'Zaposlovanje' },
] as const;

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
  const [looking, setLooking] = useState(false);
  // The tax position is loaded and saved on its own: it describes what the
  // business owes, not what its invoices say.
  const [tax, setTax] = useState<TaxProfileInput | null>(null);
  const [taxDirty, setTaxDirty] = useState(false);
  // What the server said when it found nothing — which register it asked and
  // therefore what the absence means. Shown under the field, with somewhere
  // to go next.
  const [registryNote, setRegistryNote] = useState('');
  const asked = useRef('');

  // Read from the form, not the store, so the banner clears as you type.
  const readiness = invoiceReadiness(form);

  useEffect(() => {
    let cancelled = false;
    void resources.profile
      .tax()
      .then((t) => {
        if (!cancelled) setTax(t);
      })
      .catch(() => {
        /* the rest of the profile still works without it */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setTaxField = <K extends keyof TaxProfileInput>(
    key: K,
    value: TaxProfileInput[K],
  ) => {
    setTax((t) => (t ? { ...t, [key]: value } : t));
    setTaxDirty(true);
  };

  const saveTax = async () => {
    if (!tax) return;
    try {
      setTax(await resources.profile.saveTax(tax));
      setTaxDirty(false);
      toast('Davčni podatki shranjeni');
    } catch (err) {
      toast(failureMessage(err));
    }
  };

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

  /**
   * Fills the issuer's own details from the business register.
   *
   * Worth saying plainly: a one-person s.p. is usually not registered for VAT,
   * and VIES only knows those who are — so unless AJPES credentials are
   * configured this will often find nothing, and says so rather than pretending
   * the entity doesn't exist.
   */
  const lookUp = async (taxNumber: string, quiet = false) => {
    asked.current = taxNumber;
    setLooking(true);
    setRegistryNote('');
    try {
      const found = await resources.lookup.company(taxNumber);
      setForm((f) => ({
        ...f,
        name: found.name,
        street: found.street,
        postalCode: found.postalCode,
        city: found.city,
        // Only AJPES carries it; leave what's typed when VIES answered.
        regNumber: found.regNumber ?? f.regNumber,
      }));
      setErrors({});
      toast(found.source === 'ajpes' ? 'Podatki iz AJPES' : 'Podatki iz registra DDV');
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setRegistryNote(err.message);
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
    const complete = taxNumberSchema.safeParse(digits).success;
    if (complete && !form.name.trim() && asked.current !== digits) {
      void lookUp(digits, true);
    }
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
          label="Davčna številka"
          htmlFor="pTaxNumber"
          error={errors.taxNumber}
          hint={
            looking ? (
              'Iščem v registru …'
            ) : registryNote ? (
              <>
                {registryNote}. Podatke lahko prepišete iz{' '}
                <a
                  className="font-semibold text-primary underline underline-offset-2"
                  href="https://www.ajpes.si/prs/"
                  target="_blank"
                  rel="noreferrer"
                >
                  poslovnega registra AJPES
                </a>{' '}
                ali jih vnesete ročno.
              </>
            ) : (
              'Vnesite davčno številko in podatki se izpolnijo sami.'
            )
          }
        >
          <div className="relative">
            <input
              id="pTaxNumber"
              className={cls('taxNumber') + ' pr-11'}
              type="text"
              inputMode="numeric"
              maxLength={TAX_NUMBER_LENGTH}
              placeholder="82426490"
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
            label="Začetna številka računa"
            htmlFor="pNextInvoiceNumber"
            error={errors.nextInvoiceNumber}
            hint="Uporabi se, dokler v letu ni nobenega računa. Naprej se številke nadaljujejo od zadnjega računa v evidenci."
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

      {tax && (
        <Section
          icon={<PaymentIcon className="size-4" />}
          title="Davki in prispevki"
          description="Datum začetka dejavnosti in zavarovalna osnova poganjata izračun prispevkov; vrsta normiranca določa davčne stopnje."
        >
          <div className={row2}>
            <Field
              label="Začetek dejavnosti"
              htmlFor="pStart"
              hint="Z odločbe o vpisu; določa olajšavo na prispevke."
            >
              <DateField
                id="pStart"
                value={tax.businessStartDate ?? ''}
                onChange={(v) => setTaxField('businessStartDate', v || null)}
              />
            </Field>
            <Field
              label="Zavarovalna osnova (€)"
              htmlFor="pBase"
              hint="Polna mesečna osnova; FURS jo letno spremeni."
            >
              <input
                id="pBase"
                className={input}
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={tax.contributionBase}
                onChange={(e) =>
                  setTaxField('contributionBase', parseFloat(e.target.value) || 0)
                }
              />
            </Field>
          </div>

          <Field label="Vrsta normiranca" htmlFor="pKind">
            <Select
              id="pKind"
              value={tax.normiranecKind}
              onChange={(v) => setTaxField('normiranecKind', v as 'full' | 'part')}
              options={[
                { value: 'full', label: 'Polni normiranec' },
                { value: 'part', label: 'Popoldanski normiranec' },
              ]}
            />
          </Field>

          <div className={row2}>
            <Field
              label={
                <>
                  Uradna akontacija (€){' '}
                  <span className="font-normal text-muted-fg">(neobvezno)</span>
                </>
              }
              htmlFor="pInstallment"
              hint="Znesek z odločbe DD-IPDO. Le za primerjavo."
            >
              <input
                id="pInstallment"
                className={input}
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={tax.officialInstallment ?? ''}
                onChange={(e) =>
                  setTaxField(
                    'officialInstallment',
                    e.target.value === '' ? null : parseFloat(e.target.value),
                  )
                }
              />
            </Field>
            <Field label="Pogostost akontacije" htmlFor="pFreq">
              <Select
                id="pFreq"
                value={tax.officialInstallmentFrequency ?? ''}
                onChange={(v) =>
                  setTaxField(
                    'officialInstallmentFrequency',
                    v === '' ? null : (v as 'monthly' | 'quarterly'),
                  )
                }
                options={[
                  { value: '', label: 'Ni določena' },
                  { value: 'monthly', label: 'Mesečno' },
                  { value: 'quarterly', label: 'Četrtletno' },
                ]}
              />
            </Field>
          </div>

          {/*
            Confirmed once, used every month — including for months FURS has
            not yet filed, which is the whole point: being paid early should
            mean being able to pay early.
          */}
          <div className={cardLabel}>Računi za plačilo prispevkov</div>
          <p className={`${hint} mb-3`}>
            Preverite jih na svojem obračunu PODO-OPSVZ. FURS po sklicu ve, katero
            obveznost plačujete — napačen sklic pomeni, da denar pride, obveznost pa
            ostane odprta.
          </p>

          {CONTRIBUTION_FIELDS.map((g) => (
            <div className="mb-3 rounded-lg border border-border bg-bg p-3" key={g.key}>
              <div className="mb-2 text-xs font-semibold">
                {g.label}
                <span className="ml-1.5 font-normal text-muted-fg">{g.full}</span>
              </div>
              <div className={row2}>
                <Field label="Račun (IBAN)" htmlFor={`pa-${g.key}-iban`}>
                  <input
                    id={`pa-${g.key}-iban`}
                    className={input}
                    type="text"
                    value={tax.contributionAccounts[g.key].iban}
                    onChange={(e) =>
                      setTaxField('contributionAccounts', {
                        ...tax.contributionAccounts,
                        [g.key]: {
                          ...tax.contributionAccounts[g.key],
                          iban: e.target.value,
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Sklic" htmlFor={`pa-${g.key}-ref`}>
                  <input
                    id={`pa-${g.key}-ref`}
                    className={input}
                    type="text"
                    value={tax.contributionAccounts[g.key].reference}
                    onChange={(e) =>
                      setTaxField('contributionAccounts', {
                        ...tax.contributionAccounts,
                        [g.key]: {
                          ...tax.contributionAccounts[g.key],
                          reference: e.target.value,
                        },
                      })
                    }
                  />
                </Field>
              </div>
            </div>
          ))}

          {!Object.values(tax.contributionAccounts).some((a) => a.iban) && (
            <button
              className={`${btn.outline} ${btnSm} mb-4`}
              onClick={() =>
                setTaxField(
                  'contributionAccounts',
                  suggestedContributionPayments(form.taxNumber),
                )
              }
              disabled={!form.taxNumber}
            >
              Predlagaj običajne račune in sklice
            </button>
          )}

          <Field
            label="Sklic za dohodnino"
            htmlFor="pDohRef"
            hint="FURS po sklicu ve, katero obveznost plačujete — preverite ga na svojem obračunu."
          >
            <input
              id="pDohRef"
              className={input}
              type="text"
              placeholder="SI19 12345678-40002"
              value={tax.dohodninaReference}
              onChange={(e) => setTaxField('dohodninaReference', e.target.value)}
            />
          </Field>

          <button
            className={`${btn.outline} ${btnSm}`}
            onClick={() => void saveTax()}
            disabled={!taxDirty}
          >
            {taxDirty ? 'Shrani davčne podatke' : 'Davčni podatki shranjeni'}
          </button>
        </Section>
      )}

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
