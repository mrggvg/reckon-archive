import { AlertIcon, FilePlusIcon } from './icons';
import { btn, btnBlock, hint } from '../styles/cx';

/**
 * Shown in place of figures that would be wrong.
 *
 * Invoice numbers run unbroken from 001 each year. If the next one is 003/2026
 * then 001 and 002 exist somewhere, and every total here — income, tax owed,
 * what's outstanding — is missing them. Better to say so than to quietly report
 * a smaller year than you had.
 */
export function InvoiceHistoryRequired({
  missing,
  onRecord,
}: {
  missing: string[];
  onRecord: (number: string) => void;
}) {
  return (
    <div className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-xs">
      <div className="mb-3 flex items-start gap-3 rounded-2xl border border-border bg-warning-bg p-4 text-sm leading-normal text-warning-fg">
        <AlertIcon className="mt-0.5 size-4 shrink-0" />
        <div>
          <strong className="mb-0.5 block">Pregled še ni popoln</strong>
          {missing.length === 1
            ? 'En račun je bil izdan izven aplikacije in še ni zabeležen.'
            : `${missing.length} računov je bilo izdanih izven aplikacije in še niso zabeleženi.`}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {missing.map((number) => (
          <button
            key={number}
            className={`${btn.outline} px-3 py-2 text-xs`}
            onClick={() => onRecord(number)}
          >
            <FilePlusIcon className="size-3.5" />
            <span className="font-mono">{number}</span>
          </button>
        ))}
      </div>

      <p className={`${hint} mb-3`}>
        Zaporedje številk se začne pri 001 vsako leto. Dokler manjkajo, bi bili
        prihodki, dajatve in odprte terjatve prenizko prikazani.
      </p>

      <button className={`${btn.primary} ${btnBlock}`} onClick={() => onRecord(missing[0]!)}>
        <FilePlusIcon className="size-3.5" />
        Zabeleži račun {missing[0]}
      </button>
    </div>
  );
}
