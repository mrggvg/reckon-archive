import { useRef, useState } from 'react';
import { Field, SectionHead, StatCard } from '../components/ui';
import { downloadBlob } from '../lib/download';
import { fmtHours, fmtMoney, hoursBetween, todayIso } from '../lib/format';
import { invoiceStatusComputed } from '../lib/invoice';
import type { OpenSheet } from '../lib/sheets';
import { normalize } from '../lib/storage';
import type { TabName } from '../lib/types';
import { useStore } from '../store/context';

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
    toast('Backup downloaded');
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
          !confirm('This will replace all current data in the app with the backup file. Continue?')
        ) {
          return;
        }
        replace(normalize(parsed));
        toast('Backup restored');
      } catch {
        toast('Could not read that file — is it a Reckon backup?');
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <>
      <SectionHead
        title="Overview"
        count={now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
      />

      {overdue.length > 0 && (
        <div className="banner danger">
          <div>
            <strong>
              {overdue.length} invoice{overdue.length === 1 ? '' : 's'} overdue
            </strong>
            {fmtMoney(overdueTotal)} total, past due date and still unpaid.
          </div>
          <button className="btn btn-sm" onClick={() => goTab('invoices')}>
            View
          </button>
        </div>
      )}

      <div className="highlight-box">
        <div className="stat-label">Est. tax due this month (FURS)</div>
        <div className="stat-value">{fmtMoney(taxDue)}</div>
        <div className="stat-change">
          based on {fmtMoney(paidThisMonth)} received this month · rate {rate}%
        </div>
      </div>

      <div className="stats-grid">
        <StatCard label="Paid this month" value={fmtMoney(paidThisMonth)} tone="primary" />
        <StatCard label="Outstanding" value={fmtMoney(outstanding)} />
        <StatCard label="Unbilled hours" value={fmtHours(unbilledHours)} />
        <StatCard label="Active clients" value={data.clients.length} />
      </div>

      <button className="card summary-link-card" onClick={() => goTab('tax')}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="card-label" style={{ marginBottom: 0 }}>
            Tax — {year}
          </span>
          <span style={{ color: 'var(--muted-fg)' }}>›</span>
        </div>
        <div
          className={
            'summary-value' +
            (balance > 0.005 ? ' behind' : balance < -0.005 ? ' ahead' : '')
          }
        >
          {balance > 0.005
            ? `${fmtMoney(balance)} behind`
            : balance < -0.005
              ? `${fmtMoney(Math.abs(balance))} ahead`
              : '€0.00'}
        </div>
        <div className="hint">
          {balance > 0.005
            ? "Estimated obligation is ahead of what you've logged as paid"
            : balance < -0.005
              ? "You've paid more than the running estimate — nice"
              : 'Tap to view dohodnina, prispevki, and payments'}
        </div>
      </button>

      <button className="more-toggle" onClick={() => setShowMore((v) => !v)}>
        <span>{showMore ? 'Hide tools & settings' : 'More tools & settings'}</span>
        <span>{showMore ? '▴' : '▾'}</span>
      </button>

      {showMore && (
        <>
          <QueryCard />

          <div className="card">
            <div className="card-label">Your details</div>
            <ProfileSummary />
            <button
              className="btn btn-outline btn-sm"
              style={{ marginTop: 12 }}
              onClick={() => openSheet({ kind: 'profile' })}
            >
              Edit details
            </button>
          </div>

          <div className="card">
            <div className="card-label">Backup &amp; restore</div>
            <div className="hint" style={{ marginBottom: 12 }}>
              Your data lives only in this browser. Download a backup now and then, so a
              cleared browser or new phone doesn&apos;t lose everything.
            </div>
            <button className="btn btn-outline btn-block" onClick={downloadBackup}>
              Download backup (JSON)
            </button>
            <button
              className="btn btn-outline btn-block"
              style={{ marginTop: 8 }}
              onClick={() => fileInput.current?.click()}
            >
              Restore from backup
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
      <div className="hint">
        No details yet — add your name, IBAN and tax number so invoices generate correctly.
      </div>
    );
  }
  return (
    <div style={{ fontSize: 13.5, color: 'var(--muted-fg)', lineHeight: 1.8 }}>
      <strong style={{ color: 'var(--fg)' }}>{p.name}</strong>
      <br />
      {p.address || '—'}
      <br />
      Tax no. <span className="mono">{p.taxNumber || '—'}</span> · VAT payer:{' '}
      <span className="mono">{p.vatPayer}</span>
      <br />
      TRR (IBAN) <span className="mono">{p.iban || '—'}</span>
      <br />
      Set-aside rate: <span className="mono">{p.taxRate || 0}%</span>
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
    <div className="card">
      <div className="card-label">Query hours &amp; earnings</div>
      <Field label="Client" htmlFor="qClient">
        <select
          id="qClient"
          className="select"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        >
          <option value="all">All clients</option>
          {data.clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="row2">
        <Field label="From" htmlFor="qFrom">
          <input
            id="qFrom"
            className="input"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label="To" htmlFor="qTo">
          <input
            id="qTo"
            className="input"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
      </div>
      <button className="btn btn-outline btn-block" onClick={run}>
        Run query
      </button>

      {result && (
        <div className="query-result">
          <div className="qrow">
            <span className="k">Hours logged</span>
            <span className="v">{fmtHours(result.totalHours)}</span>
          </div>
          <div className="qrow">
            <span className="k">— already invoiced</span>
            <span className="v">{fmtHours(result.billedHours)}</span>
          </div>
          <div className="qrow">
            <span className="k">— unbilled</span>
            <span className="v">{fmtHours(result.unbilledHours)}</span>
          </div>
          <div className="qrow">
            <span className="k">Invoices in range</span>
            <span className="v">{result.count}</span>
          </div>
          <div className="qrow">
            <span className="k">— paid</span>
            <span className="v">{fmtMoney(result.paidTotal)}</span>
          </div>
          <div className="qrow">
            <span className="k">— unpaid</span>
            <span className="v">{fmtMoney(result.unpaidTotal)}</span>
          </div>
          <div className="qrow total">
            <span className="k">Total invoiced</span>
            <span className="v">{fmtMoney(result.invoicedTotal)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
