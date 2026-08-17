import { useEffect, useState } from 'react';
import { buildObligationQr } from '../lib/upn';
import type { Profile } from '../lib/types';

/**
 * A payment code for something the user owes, with the details beside it.
 *
 * The plain text is not a fallback for the impatient — it is the authoritative
 * version. FURS credits a payment by its reference, and a wrong reference fails
 * silently: the money leaves, the obligation stays open. So the reference is
 * always readable, and the code is a convenience on top of it.
 */
export function UpnQr({
  profile,
  amount,
  iban,
  reference,
  purpose,
  title,
  className = '',
}: {
  profile: Profile;
  amount: number;
  iban: string;
  reference: string;
  purpose: string;
  title: string;
  className?: string;
}) {
  const [enlarged, setEnlarged] = useState(false);
  const qr =
    iban && reference ? buildObligationQr({ profile, amount, iban, reference, purpose }) : null;

  useEffect(() => {
    if (!enlarged) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEnlarged(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enlarged]);

  return (
    <div
      className={
        'flex items-start gap-3 rounded-lg border border-border bg-card p-2.5 ' + className
      }
    >
      {qr ? (
        <button
          type="button"
          className="shrink-0 cursor-zoom-in rounded-md"
          onClick={() => setEnlarged(true)}
          aria-label={`Povečaj kodo za ${title}`}
          title="Klikni za večjo kodo"
        >
          <svg viewBox={`0 0 ${qr.box} ${qr.box}`} className="size-24" aria-hidden="true">
            <rect width={qr.box} height={qr.box} fill="#fff" />
            <path d={qr.path} fill="#000" />
          </svg>
        </button>
      ) : (
        <div className="flex size-24 shrink-0 items-center justify-center rounded-md border border-dashed border-input-border p-2 text-center text-2xs text-muted-fg">
          Brez računa in sklica ni kode
        </div>
      )}

      <dl className="min-w-0 flex-1 text-2xs">
        <dt className="text-muted-fg">Znesek</dt>
        <dd className="mb-1 font-mono font-semibold">{amount.toFixed(2)} EUR</dd>
        <dt className="text-muted-fg">Račun</dt>
        <dd className="mb-1 font-mono break-all">{iban || '—'}</dd>
        <dt className="text-muted-fg">Sklic</dt>
        <dd className="font-mono break-all">{reference || '—'}</dd>
      </dl>

      {/*
        A code at thumbnail size is decoration. Scanning one off a screen wants
        it as large as the screen allows, on white, with the details underneath
        so the transfer can still be checked against them.
      */}
      {enlarged && qr && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Koda za plačilo: ${title}`}
          onClick={() => setEnlarged(false)}
        >
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <svg
              viewBox={`0 0 ${qr.box} ${qr.box}`}
              className="mx-auto aspect-square w-full max-w-72"
              aria-hidden="true"
            >
              <rect width={qr.box} height={qr.box} fill="#fff" />
              <path d={qr.path} fill="#000" />
            </svg>

            <div className="mt-4 text-center">
              <div className="text-sm font-semibold">{title}</div>
              <div className="mt-1 font-mono text-2xl font-bold tracking-tight">
                {amount.toFixed(2)} EUR
              </div>
              <div className="mt-2 font-mono text-2xs break-all text-muted-fg">
                {iban}
              </div>
              <div className="font-mono text-2xs break-all text-muted-fg">{reference}</div>
              <p className="mt-3 text-2xs text-muted-fg">
                Dotaknite se kjerkoli, da zaprete.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
