import { Sheet } from '../components/ui';
import { downloadBlob, toCsv } from '../lib/download';
import { fmtDMY, fmtHours, hoursBetween, todayIso } from '../lib/format';
import { useStore } from '../store/context';

export function TimesheetSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, toast } = useStore();
  const inv = data.invoices.find((i) => i.id === id);

  if (!inv) {
    return (
      <Sheet title="Working hours" onClose={onClose}>
        <p className="hint">That invoice no longer exists.</p>
      </Sheet>
    );
  }

  const client = data.clients.find((c) => c.id === inv.clientId);
  const sessions = inv.sessionIds
    .map((sid) => data.sessions.find((s) => s.id === sid))
    .filter((s) => s !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  const totalHours = sessions.reduce((sum, s) => sum + hoursBetween(s.start, s.end), 0);

  const downloadCsv = () => {
    const rows: (string | number)[][] = [
      ['Invoice', inv.number],
      ['Client', client ? client.name : ''],
      ['Period', `${inv.periodStart} to ${inv.periodEnd}`],
      [],
      ['Date', 'In', 'Out', 'Hours', 'Note'],
    ];
    sessions.forEach((s) => {
      rows.push([s.date, s.start, s.end, hoursBetween(s.start, s.end).toFixed(2), s.note]);
    });
    rows.push([]);
    rows.push(['Total hours', totalHours.toFixed(2)]);
    downloadBlob(
      toCsv(rows),
      `hours-${inv.number.replace('/', '-')}.csv`,
      'text/csv;charset=utf-8;',
    );
    toast('Timesheet downloaded');
  };

  return (
    <Sheet title="Working hours" onClose={onClose} printable>
      <div className="ts-doc">
        <div className="ts-doc-head">
          <div>
            <div className="ts-doc-label">Delovni list · Working hours</div>
            <div className="ts-doc-title">{client ? client.name : 'Unassigned'}</div>
          </div>
          <div className="ts-doc-ref">
            <div className="k">Ref. invoice</div>
            <div className="v mono">#{inv.number}</div>
          </div>
        </div>

        <div className="ts-doc-sub">
          <div>
            <span className="k">Contractor</span> {data.profile.name || '—'}
          </div>
          <div>
            <span className="k">Client</span> {client ? client.name : '—'}
            {client?.taxNumber ? ' · Davčna št. ' + client.taxNumber : ''}
          </div>
          <div>
            <span className="k">Period</span> {fmtDMY(inv.periodStart)} –{' '}
            {fmtDMY(inv.periodEnd)}
          </div>
        </div>

        <table className="ts-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>In</th>
              <th>Out</th>
              <th>Hours</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  style={{ color: 'var(--muted-fg)', textAlign: 'center', padding: 16 }}
                >
                  No sessions on this invoice — probably an imported/manual invoice.
                </td>
              </tr>
            ) : (
              sessions.map((s, i) => (
                <tr key={s.id}>
                  <td className="mono">{i + 1}</td>
                  <td>{fmtDMY(s.date)}</td>
                  <td className="mono">{s.start}</td>
                  <td className="mono">{s.end}</td>
                  <td className="mono">{fmtHours(hoursBetween(s.start, s.end))}</td>
                  <td>{s.note || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>Total</td>
              <td className="mono">{fmtHours(totalHours)}</td>
              <td />
            </tr>
          </tfoot>
        </table>

        <div className="ts-doc-foot">Generated {fmtDMY(todayIso())} · Reckon</div>
      </div>

      <div className="btn-row no-print" style={{ marginTop: 16 }}>
        <button className="btn btn-outline" onClick={() => window.print()}>
          Print / Save PDF
        </button>
        <button className="btn btn-primary" onClick={downloadCsv}>
          Download CSV
        </button>
      </div>
    </Sheet>
  );
}
