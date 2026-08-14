import { useRef, useState } from 'react';
import {
  AlertIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  DownloadIcon,
  EditIcon,
  UploadIcon,
} from '../components/icons';
import { formatAddress } from '@reckon/shared';
import { Field, SectionHead, StatCard } from '../components/ui';
import { row2 } from '../styles/cx';
import { downloadBlob } from '../lib/download';
import { fmtHours, fmtMoney, hoursBetween, todayIso } from '../lib/format';
import { invoiceStatusComputed, missingInvoiceNumbers } from '../lib/invoice';
import { InvoiceHistoryRequired } from '../components/InvoiceHistoryRequired';
import type { OpenSheet } from '../lib/sheets';
import { normalize } from '../lib/storage';
import type { TabName } from '../lib/types';
import { useStore } from '../store/context';
import { btn, btnBlock, btnSm, card, cardLabel, hint } from '../styles/cx';
import { Select } from '../components/Select';
import { DateField } from '../components/DateField';

export function OverviewView({
  openSheet,
  goTab,
}: {
  openSheet: OpenSheet;
  goTab: (t: TabName) => void;
}) {
  const { data, replace, toast } = useStore();
  const [showMore, setShowMore] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const now = new Date();
  const monthKey = todayIso().slice(0, 7);
  const year = now.getFullYear();

  const paidThisMonth = data.invoices
    .filter((i) => i.status === 'paid' && i.paidDate?.startsWith(monthKey))
    .reduce((sum, i) => sum + i.total, 0);
  const outstanding = data.invoices
    .filter((i) => i.status !== 'paid')
    .reduce((sum, i) => sum + i.total, 0);
  const unbilledHours = data.sessions
    .filter((s) => !s.invoiced)
    .reduce((sum, s) => sum + hoursBetween(s.start, s.end), 0);
  const rate = data.profile.taxRate || 0;
  const taxDue = paidThisMonth * (rate / 100);

  const overdue = data.invoices.filter((i) => invoiceStatusComputed(i) === 'overdue');
  const overdueTotal = overdue.reduce((sum, i) => sum + i.total, 0);

  // Running tax balance for the year, mirrored on the Tax tab.
  const paidInYear = data.invoices
    .filter((i) => i.status === 'paid' && i.paidDate?.startsWith(String(year)))
    .reduce((sum, i) => sum + i.total, 0);
  const dohodninaEst = paidInYear * (rate / 100);
  const prispevkiDue = (data.profile.monthlyContribution || 0) * (now.getMonth() + 1);
  const paidTax = data.taxPayments
    .filter((p) => p.date?.startsWith(String(year)))
    .reduce((sum, p) => sum + p.amount, 0);
  const balance = dohodninaEst + prispevkiDue - paidTax;

  const downloadBackup = () => {
    downloadBlob(
      JSON.stringify(data, null, 2),
      `reckon-backup-${todayIso()}.json`,
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
        if (
          !confirm('To bo zamenjalo vse trenutne podatke z vsebino varnostne kopije. Nadaljujem?')
        ) {
          return;
        }
        replace(normalize(parsed));
        toast('Podatki obnovljeni');
      } catch {
        toast('Datoteke ni bilo mogoče prebrati — je to varnostna kopija Reckon?');
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  };

  const missing = missingInvoiceNumbers(data.profile.nextInvoiceNumber, data.invoices);

  return (
    <>
      <SectionHead
        title="Pregled"
        count={now.toLocaleDateString('sl-SI', { month: 'long', year: 'numeric' })}
      />

      {missing.length > 0 && (
        <InvoiceHistoryRequired
          missing={missing}
          onRecord={(number) => openSheet({ kind: 'importInvoice', prefillNumber: number })}
        />
      )}

      {missing.length === 0 && overdue.length > 0 && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-border bg-error-bg p-4 text-sm leading-normal text-error-fg">
          <AlertIcon className="mt-0.5 size-4 shrink-0" />
          <div className="flex-1">
            <strong className="mb-0.5 block">
              {overdue.length === 1 ? '1 zapadel račun' : `${overdue.length} zapadlih računov`}
            </strong>
            Skupaj {fmtMoney(overdueTotal)} po roku plačila in še neplačano.
          </div>
          <button
            className={`${btn.outline} ${btnSm} shrink-0 bg-card`}
            onClick={() => goTab('invoices')}
          >
            Poglej
          </button>
        </div>
      )}

      {missing.length === 0 && (
        <>
      <div className="mb-4 rounded-2xl border border-border bg-fg p-5 text-card">
        <div className="text-xs font-medium text-white/65">Ocenjena dajatev za ta mesec (FURS)</div>
        <div className="my-1 text-3xl font-bold leading-tight tracking-tight">
          {fmtMoney(taxDue)}
        </div>
        <div className="text-xs text-white/65">
          od {fmtMoney(paidThisMonth)} prejetih ta mesec · stopnja {rate} %
        </div>
      </div>

      <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4">
        <StatCard label="Prejeto ta mesec" value={fmtMoney(paidThisMonth)} tone="primary" />
        <StatCard label="Odprte terjatve" value={fmtMoney(outstanding)} />
        <StatCard label="Neobračunane ure" value={fmtHours(unbilledHours)} />
        <StatCard label="Število strank" value={data.clients.length} />
      </div>

        </>
      )}

      {missing.length === 0 && (
      <button className={`${card} block w-full cursor-pointer text-left`} onClick={() => goTab('tax')}>
        <div className="flex items-center justify-between">
          <span className={`${cardLabel} mb-0`}>Davki — {year}</span>
          <ChevronRightIcon className="size-4 text-muted-fg" />
        </div>
        <div
          className={
            'my-1.5 text-2xl font-bold ' +
            (balance > 0.005
              ? 'text-destructive'
              : balance < -0.005
                ? 'text-secondary'
                : '')
          }
        >
          {balance > 0.005
            ? `${fmtMoney(balance)} zaostanka`
            : balance < -0.005
              ? `${fmtMoney(Math.abs(balance))} vnaprej`
              : '€0.00'}
        </div>
        <div className={hint}>
          {balance > 0.005
            ? 'Ocenjena obveznost presega zabeležena plačila'
            : balance < -0.005
              ? 'Plačali ste več, kot znaša tekoča ocena'
              : 'Odprite za dohodnino, prispevke in plačila'}
        </div>
      </button>

      )}

      <button
        className="my-4 flex w-full cursor-pointer items-center justify-between border-y border-border bg-none px-1 py-3 text-sm font-semibold text-muted-fg"
        onClick={() => setShowMore((v) => !v)}
      >
        <span>{showMore ? 'Skrij orodja in nastavitve' : 'Več orodij in nastavitev'}</span>
        {showMore ? (
          <ChevronUpIcon className="size-4" />
        ) : (
          <ChevronDownIcon className="size-4" />
        )}
      </button>

      {showMore && (
        <>
          <QueryCard />

          <div className={card}>
            <div className={cardLabel}>Moji podatki</div>
            <ProfileSummary />
            <button
              className={`${btn.outline} ${btnSm} mt-3`}
              onClick={() => openSheet({ kind: 'profile' })}
            >
              <EditIcon className="size-3.5" />
              Uredi podatke
            </button>
          </div>

          <div className={card}>
            <div className={cardLabel}>Varnostna kopija</div>
            <div className={`${hint} mb-3`}>
              Podatki so shranjeni samo v tem brskalniku. Občasno prenesite varnostno
              kopijo, da jih ob zamenjavi naprave ali brisanju podatkov ne izgubite.
            </div>
            <button className={`${btn.outline} ${btnBlock}`} onClick={downloadBackup}>
              <DownloadIcon className="size-3.5" />
              Prenesi varnostno kopijo (JSON)
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
              style={{ display: 'none' }}
              onChange={restoreBackup}
            />
          </div>
        </>
      )}
    </>
  );
}

function ProfileSummary() {
  const { data } = useStore();
  const p = data.profile;
  if (!p.name) {
    return (
      <div className={hint}>
        Podatki še niso vneseni — dodajte ime, IBAN in davčno številko, da bodo računi
        pravilni.
      </div>
    );
  }
  return (
    <div className="text-sm leading-loose text-muted-fg">
      <strong className="text-fg">{p.name}</strong>
      <br />
      {formatAddress(p) || '—'}
      <br />
      Davčna št. <span className="font-mono">{p.taxNumber || '—'}</span> · Zavezanec za DDV:{' '}
      <span className="font-mono">{p.vatPayer}</span>
      <br />
      TRR <span className="font-mono">{p.iban || '—'}</span>
      <br />
      Stopnja odvajanja: <span className="font-mono">{p.taxRate || 0} %</span>
    </div>
  );
}

function QueryCard() {
  const { data } = useStore();
  const [clientId, setClientId] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [result, setResult] = useState<null | {
    totalHours: number;
    billedHours: number;
    unbilledHours: number;
    count: number;
    paidTotal: number;
    unpaidTotal: number;
    invoicedTotal: number;
  }>(null);

  const run = () => {
    const sessions = data.sessions.filter((s) => {
      if (clientId !== 'all' && s.clientId !== clientId) return false;
      if (from && s.date < from) return false;
      if (to && s.date > to) return false;
      return true;
    });
    const totalHours = sessions.reduce((sum, s) => sum + hoursBetween(s.start, s.end), 0);
    const billedHours = sessions
      .filter((s) => s.invoiced)
      .reduce((sum, s) => sum + hoursBetween(s.start, s.end), 0);

    const invoices = data.invoices.filter((inv) => {
      if (clientId !== 'all' && inv.clientId !== clientId) return false;
      if (from && inv.issueDate < from) return false;
      if (to && inv.issueDate > to) return false;
      return true;
    });
    const invoicedTotal = invoices.reduce((sum, i) => sum + i.total, 0);
    const paidTotal = invoices
      .filter((i) => i.status === 'paid')
      .reduce((sum, i) => sum + i.total, 0);

    setResult({
      totalHours,
      billedHours,
      unbilledHours: totalHours - billedHours,
      count: invoices.length,
      paidTotal,
      unpaidTotal: invoicedTotal - paidTotal,
      invoicedTotal,
    });
  };

  return (
    <div className={card}>
      <div className={cardLabel}>Poizvedba po urah in zaslužku</div>
      <Field label="Stranka" htmlFor="qClient">
        <Select
          id="qClient"
          value={clientId}
          onChange={setClientId}
          options={[
            { value: 'all', label: 'Vse stranke' },
            ...data.clients.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
      </Field>
      <div className={row2}>
        <Field label="Od" htmlFor="qFrom">
          <DateField
          id="qFrom"
          value={from}
          onChange={setFrom}
        />
        </Field>
        <Field label="Do" htmlFor="qTo">
          <DateField
          id="qTo"
          value={to}
          onChange={setTo}
        />
        </Field>
      </div>
      <button className={`${btn.outline} ${btnBlock}`} onClick={run}>
        Poišči
      </button>

      {result && (
        <div className="mt-4 border-t border-dashed border-input-border pt-4">
          <div className="flex justify-between py-1.5 text-sm">
            <span className="text-muted-fg">Zabeležene ure</span>
            <span className="font-mono font-semibold">{fmtHours(result.totalHours)}</span>
          </div>
          <div className="flex justify-between py-1.5 text-sm">
            <span className="text-muted-fg">— že zaračunano</span>
            <span className="font-mono font-semibold">{fmtHours(result.billedHours)}</span>
          </div>
          <div className="flex justify-between py-1.5 text-sm">
            <span className="text-muted-fg">— neobračunano</span>
            <span className="font-mono font-semibold">{fmtHours(result.unbilledHours)}</span>
          </div>
          <div className="flex justify-between py-1.5 text-sm">
            <span className="text-muted-fg">Računi v obdobju</span>
            <span className="font-mono font-semibold">{result.count}</span>
          </div>
          <div className="flex justify-between py-1.5 text-sm">
            <span className="text-muted-fg">— plačano</span>
            <span className="font-mono font-semibold">{fmtMoney(result.paidTotal)}</span>
          </div>
          <div className="flex justify-between py-1.5 text-sm">
            <span className="text-muted-fg">— neplačano</span>
            <span className="font-mono font-semibold">{fmtMoney(result.unpaidTotal)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-border pt-2.5 py-1.5 text-sm font-bold">
            <span className="text-muted-fg">Skupaj zaračunano</span>
            <span className="font-mono font-semibold">{fmtMoney(result.invoicedTotal)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
