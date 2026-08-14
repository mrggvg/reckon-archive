import { DownloadIcon, PrinterIcon } from '../components/icons';
import { Sheet } from '../components/ui';
import { downloadBlob, toCsv } from '../lib/download';
import { fmtDMY, fmtHours, hoursBetween, todayIso } from '../lib/format';
import { useStore } from '../store/context';
import { btn, hint } from '../styles/cx';

export function TimesheetSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, toast } = useStore();
  const inv = data.invoices.find((i) => i.id === id);

  if (!inv) {
    return (
      <Sheet title="Delovni list" onClose={onClose}>
        <p className={hint}>Ta račun ne obstaja več.</p>
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
      ['Račun', inv.number],
      ['Stranka', client ? client.name : ''],
      ['Obdobje', `${inv.periodStart} – ${inv.periodEnd}`],
      [],
      ['Datum', 'Začetek', 'Konec', 'Ur', 'Opis'],
    ];
    sessions.forEach((s) => {
      rows.push([s.date, s.start, s.end, hoursBetween(s.start, s.end).toFixed(2), s.note]);
    });
    rows.push([]);
    rows.push(['Skupaj ur', totalHours.toFixed(2)]);
    downloadBlob(
      toCsv(rows),
      `hours-${inv.number.replace('/', '-')}.csv`,
      'text/csv;charset=utf-8;',
    );
    toast('Delovni list prenesen');
  };

  return (
    <Sheet title="Delovni list" onClose={onClose} printable>
      <div className="ts-doc">
        <div className="ts-doc-head">
          <div>
            <div className="ts-doc-label">Delovni list</div>
            <div className="ts-doc-title">{client ? client.name : 'Brez stranke'}</div>
          </div>
          <div className="ts-doc-ref">
            <div className="k">Račun št.</div>
            <div className="v font-mono">#{inv.number}</div>
          </div>
        </div>

        <div className="ts-doc-sub">
          <div>
            <span className="k">Izvajalec</span> {data.profile.name || '—'}
          </div>
          <div>
            <span className="k">Naročnik</span> {client ? client.name : '—'}
            {client?.taxNumber ? ' · Davčna št. ' + client.taxNumber : ''}
          </div>
          <div>
            <span className="k">Obdobje</span> {fmtDMY(inv.periodStart)} –{' '}
            {fmtDMY(inv.periodEnd)}
          </div>
        </div>

        <table className="ts-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Datum</th>
              <th>Začetek</th>
              <th>Konec</th>
              <th>Ur</th>
              <th>Opis</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  style={{ color: 'var(--muted-fg)', textAlign: 'center', padding: 16 }}
                >
                  Na tem računu ni povezanih ur — najbrž je bil uvožen.
                </td>
              </tr>
            ) : (
              sessions.map((s, i) => (
                <tr key={s.id}>
                  <td className="font-mono">{i + 1}</td>
                  <td>{fmtDMY(s.date)}</td>
                  <td className="font-mono">{s.start}</td>
                  <td className="font-mono">{s.end}</td>
                  <td className="font-mono">{fmtHours(hoursBetween(s.start, s.end))}</td>
                  <td>{s.note || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>Skupaj</td>
              <td className="font-mono">{fmtHours(totalHours)}</td>
              <td />
            </tr>
          </tfoot>
        </table>

        <div className="ts-doc-foot">Izdelano {fmtDMY(todayIso())} · Reckon</div>
      </div>

      <div className="no-print mt-4 flex flex-wrap gap-2 [&>button]:flex-1 mt-4">
        <button className={btn.outline} onClick={() => window.print()}>
          <PrinterIcon className="size-3.5" />
          Natisni / PDF
        </button>
        <button className={btn.primary} onClick={downloadCsv}>
          <DownloadIcon className="size-3.5" />
          Prenesi CSV
        </button>
      </div>
    </Sheet>
  );
}
