import { formatAddress } from '@reckon/shared';
import { fmtDMY, fmtMoney } from '../lib/format';
import { invoiceStatusComputed } from '../lib/invoice';
import { buildUpnQr } from '../lib/upn';
import type { Client, Invoice, Profile } from '../lib/types';

/**
 * The formal invoice document. Kept as-is from docs/example.html — same
 * structure, same print styling. Only the templating changed.
 */
export function Receipt({
  invoice,
  client,
  profile,
}: {
  invoice: Invoice;
  client: Client | undefined;
  profile: Profile;
}) {
  const status = invoiceStatusComputed(invoice);
  const periodLabel =
    invoice.periodStart === invoice.periodEnd
      ? fmtDMY(invoice.periodStart)
      : `${fmtDMY(invoice.periodStart)} - ${fmtDMY(invoice.periodEnd)}`;
  const qr = status !== 'paid' ? buildUpnQr(profile, invoice) : null;

  return (
    <div className="receipt">
      <div className="receipt-band">
        <div>
          <div className="doc-label">Račun za opravljene storitve</div>
          <h2>RAČUN</h2>
        </div>
        <div className="num-block">
          <div className="issuer-mark">Reckon</div>
          <div className="num-label">Številka</div>
          <div className="num">{invoice.number}</div>
        </div>
      </div>

      <div className="receipt-body">
        <div className="receipt-parties">
          <div className="party">
            <div className="label">Izvajalec</div>
            <div className="party-name">{profile.name || '—'}</div>
            <div className="party-line">{formatAddress(profile)}</div>
            <div className="party-line">
              <span className="k">Davčna številka:</span> {profile.taxNumber || '—'}
            </div>
            {profile.regNumber ? (
              <div className="party-line">
                <span className="k">Matična številka:</span> {profile.regNumber}
              </div>
            ) : null}
            <div className="party-line">
              <span className="k">Davčni zavezanec:</span> {profile.vatPayer || 'NE'}
            </div>
            <div className="party-line">
              <span className="k">TRR:</span> {profile.iban || '—'}
            </div>
          </div>
          <div className="party">
            <div className="label">Naročnik</div>
            <div className="party-name">{client ? client.name : '—'}</div>
            <div className="party-line">{client ? formatAddress(client) : ''}</div>
            <div className="party-line">
              <span className="k">Davčna številka:</span>{' '}
              {client ? client.taxNumber || '—' : '—'}
            </div>
          </div>
        </div>

        <div className="receipt-dates">
          {profile.placeOfIssue ? (
            <div className="dd">
              <div className="label">Kraj izdaje</div>
              <div className="val">{profile.placeOfIssue}</div>
            </div>
          ) : null}
          <div className="dd">
            <div className="label">Datum izdaje</div>
            <div className="val">{fmtDMY(invoice.issueDate)}</div>
          </div>
          <div className="dd">
            <div className="label">Rok plačila</div>
            <div className="val">{fmtDMY(invoice.dueDate)}</div>
          </div>
        </div>

        <div className="receipt-service">
          <div className="label">Podatki o storitvi</div>
          <div className="desc">{invoice.description || 'Storitve'}</div>
          <div className="row">
            <span className="k">Datum opravljene storitve</span>
            <span className="v">{periodLabel}</span>
          </div>
        </div>

        <div className="receipt-total-band">
          <span className="label">Skupaj za plačilo</span>
          <span className="amount">{fmtMoney(invoice.total)}</span>
        </div>

        {(profile.vatPayer || 'NE') === 'NE' && profile.vatClause ? (
          <div className="receipt-vat-clause">{profile.vatClause}</div>
        ) : null}

        <div className="receipt-pay">
          <div className="row">
            <span className="label">Način plačila</span>
            <span className="val">TRR / bančno nakazilo</span>
          </div>
          <div className="row">
            <span className="label">Plačilo na TRR</span>
            <span className="val">{profile.iban || '—'}</span>
          </div>
          {profile.accountHolder && profile.accountHolder !== profile.name ? (
            <div className="row">
              <span className="label">Imetnik računa</span>
              <span className="val">{profile.accountHolder}</span>
            </div>
          ) : null}
        </div>

        {qr ? (
          <div className="receipt-qr">
            <div className="receipt-qr-code">
              <svg
                viewBox={`0 0 ${qr.box} ${qr.box}`}
                xmlns="http://www.w3.org/2000/svg"
                shapeRendering="crispEdges"
              >
                <rect width="100%" height="100%" fill="#FFFFFF" />
                <path d={qr.path} fill="#000000" />
              </svg>
            </div>
            <div className="receipt-qr-txt">
              <div className="receipt-qr-label">Skeniraj za plačilo</div>
              <p className="hint">
                UPN QR koda — odpri mobilno banko in izberi &quot;Skeniraj QR&quot; za
                samodejno izpolnjen nalog.
              </p>
            </div>
          </div>
        ) : null}

        <div className="receipt-footer-note">
          Račun je izdan v elektronski obliki in je veljaven brez žiga in podpisa.
        </div>
      </div>

      <div className={'receipt-status-strip ' + status}>
        {status === 'paid'
          ? 'Plačano ' + fmtDMY(invoice.paidDate)
          : status === 'overdue'
            ? 'Zapadlo · Neplačano'
            : 'Neplačano'}
      </div>
    </div>
  );
}
